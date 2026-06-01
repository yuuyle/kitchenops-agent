param(
  [string]$ResourceGroupName = "rg-kitchenops-agent-canadacentral",
  [string]$Location = "canadacentral",
  [string]$AppServicePlanName = "asp-kitchenops-agent-canadacentral",
  [string]$WebAppName = "kitchenops-agent-yuuya-20260601",
  [string]$Sku = "B1",
  [string]$Runtime = "NODE:24-lts"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
  throw "Azure CLI is not installed. Install it locally or run this script in Azure Cloud Shell."
}

function Invoke-Az {
  param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Arguments
  )

  & az @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Azure CLI command failed: az $($Arguments -join ' ')"
  }
}

function Invoke-AzOutput {
  param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Arguments
  )

  $output = & az @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Azure CLI command failed: az $($Arguments -join ' ')"
  }

  return $output
}

Write-Host "Checking Azure CLI account..."
Invoke-Az account show --output table

Write-Host "Checking Web App name availability: $WebAppName"
$nameAvailabilityChecked = $false
try {
  $subscriptionId = (Invoke-AzOutput account show --query id --output tsv).Trim()
  $availabilityBody = @{
    name = $WebAppName
    type = "Microsoft.Web/sites"
  } | ConvertTo-Json -Compress
  $availability = Invoke-AzOutput rest `
    --method post `
    --url "https://management.azure.com/subscriptions/$subscriptionId/providers/Microsoft.Web/checknameavailability?api-version=2024-04-01" `
    --body $availabilityBody `
    --output json | ConvertFrom-Json
  $nameAvailabilityChecked = $true
} catch {
  Write-Warning "Could not check Web App name availability with this Azure CLI. Continuing; az webapp create will validate the name."
}

if ($nameAvailabilityChecked -and -not $availability.nameAvailable) {
  throw "Web App name '$WebAppName' is not available. Re-run with -WebAppName '<another-unique-name>'. Reason: $($availability.message)"
}

Write-Host "Creating resource group: $ResourceGroupName ($Location)"
Invoke-Az group create `
  --name $ResourceGroupName `
  --location $Location `
  --output table

Write-Host "Creating Linux App Service Plan: $AppServicePlanName ($Sku)"
Invoke-Az appservice plan create `
  --name $AppServicePlanName `
  --resource-group $ResourceGroupName `
  --location $Location `
  --is-linux `
  --sku $Sku `
  --output table

Write-Host "Creating Web App: $WebAppName ($Runtime)"
try {
  Invoke-Az webapp create `
    --resource-group $ResourceGroupName `
    --plan $AppServicePlanName `
    --name $WebAppName `
    --runtime $Runtime `
    --output table
} catch {
  if ($Runtime -eq "NODE:24-lts") {
    Write-Host "Node 24 runtime was not accepted. Retrying with NODE:22-lts..."
    $Runtime = "NODE:22-lts"
    Invoke-Az webapp create `
      --resource-group $ResourceGroupName `
      --plan $AppServicePlanName `
      --name $WebAppName `
      --runtime $Runtime `
      --output table
  } else {
    throw
  }
}

$appSettings = @(
  "NODE_ENV=production",
  "KITCHEN_DATA_DIR=/home/data/kitchenops-agent",
  "WEBSITES_ENABLE_APP_SERVICE_STORAGE=true",
  "SCM_DO_BUILD_DURING_DEPLOYMENT=false",
  "ENABLE_ORYX_BUILD=false"
)

if ($Runtime -eq "NODE:22-lts") {
  $appSettings += "NODE_OPTIONS=--experimental-sqlite"
}

Write-Host "Configuring app settings..."
$appSettingsArgs = @(
  "webapp",
  "config",
  "appsettings",
  "set",
  "--resource-group",
  $ResourceGroupName,
  "--name",
  $WebAppName,
  "--settings"
) + $appSettings + @("--output", "table")
Invoke-Az @appSettingsArgs

Write-Host "Configuring startup command..."
Invoke-Az webapp config set `
  --resource-group $ResourceGroupName `
  --name $WebAppName `
  --startup-file "npm start" `
  --output table

Write-Host "Enabling HTTPS only..."
Invoke-Az webapp update `
  --resource-group $ResourceGroupName `
  --name $WebAppName `
  --https-only true `
  --output table

Write-Host "Enabling basic publishing credentials for GitHub Actions publish profile deploy..."
Invoke-Az resource update `
  --resource-group $ResourceGroupName `
  --namespace Microsoft.Web `
  --resource-type basicPublishingCredentialsPolicies `
  --parent "sites/$WebAppName" `
  --name scm `
  --set properties.allow=true `
  --output table

Invoke-Az resource update `
  --resource-group $ResourceGroupName `
  --namespace Microsoft.Web `
  --resource-type basicPublishingCredentialsPolicies `
  --parent "sites/$WebAppName" `
  --name ftp `
  --set properties.allow=true `
  --output table

$publishProfilePath = Join-Path (Get-Location) "$WebAppName.PublishSettings"
Write-Host "Downloading publish profile to: $publishProfilePath"
Invoke-Az webapp deployment list-publishing-profiles `
  --resource-group $ResourceGroupName `
  --name $WebAppName `
  --xml > $publishProfilePath

Write-Host ""
Write-Host "Created Azure Web App."
Write-Host "URL: https://$WebAppName.azurewebsites.net"
Write-Host "Publish profile: $publishProfilePath"
Write-Host ""
Write-Host "Next: copy the publish profile XML into GitHub Actions secret AZURE_WEBAPP_PUBLISH_PROFILE."
