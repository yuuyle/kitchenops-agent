param(
  [string]$ResourceGroupName = "rg-kitchenops-agent-canadacentral",
  [string]$WebAppName = "kitchenops-agent-yuuya-20260601",
  [Parameter(Mandatory = $true)]
  [string]$AzureOpenAiEndpoint,
  [Parameter(Mandatory = $true)]
  [string]$AzureOpenAiApiKey,
  [Parameter(Mandatory = $true)]
  [string]$AzureOpenAiDeployment,
  [string]$AzureOpenAiApiVersion = "2024-10-21",
  [Parameter(Mandatory = $true)]
  [string]$AzureAiVisionEndpoint,
  [Parameter(Mandatory = $true)]
  [string]$AzureAiVisionApiKey,
  [string]$VisionProvider = "azure-openai",
  [switch]$SkipRestart
)

$ErrorActionPreference = "Stop"

function Get-AzCommand {
  $command = Get-Command az -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $candidatePaths = @(
    "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd",
    "C:\Program Files (x86)\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"
  )

  foreach ($candidatePath in $candidatePaths) {
    if (Test-Path $candidatePath) {
      return $candidatePath
    }
  }

  throw "Azure CLI is not installed or was not found in PATH."
}

$az = Get-AzCommand

function Invoke-Az {
  param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Arguments
  )

  & $az @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Azure CLI command failed: az $($Arguments -join ' ')"
  }
}

Write-Host "Checking Azure CLI account..."
Invoke-Az account show --output table

Write-Host "Setting Azure AI app settings on $WebAppName..."
Invoke-Az webapp config appsettings set `
  --resource-group $ResourceGroupName `
  --name $WebAppName `
  --settings `
    "AZURE_OPENAI_ENDPOINT=$AzureOpenAiEndpoint" `
    "AZURE_OPENAI_API_KEY=$AzureOpenAiApiKey" `
    "AZURE_OPENAI_DEPLOYMENT=$AzureOpenAiDeployment" `
    "AZURE_OPENAI_API_VERSION=$AzureOpenAiApiVersion" `
    "AZURE_AI_VISION_ENDPOINT=$AzureAiVisionEndpoint" `
    "AZURE_AI_VISION_API_KEY=$AzureAiVisionApiKey" `
    "VISION_PROVIDER=$VisionProvider" `
  --output none

if (-not $SkipRestart) {
  Write-Host "Restarting $WebAppName..."
  Invoke-Az webapp restart `
    --resource-group $ResourceGroupName `
    --name $WebAppName `
    --output none
}

Write-Host ""
Write-Host "Azure AI settings were applied."
Write-Host "Verify with:"
Write-Host "Invoke-RestMethod https://$WebAppName.azurewebsites.net/api/integrations"
