# Azure OpenAI / Azure AI Vision 詳細設定手順

目的: Azure Portalで Azure OpenAI と Azure AI Vision を作成し、App Service の環境変数に設定して、管理画面の Microsoft AI 連携状態を `Ready` にする。

## 重要な現状

- Azure App Service は稼働済み
- `/api/integrations` は応答済み
- 現時点では Azure OpenAI / Azure AI Vision の環境変数が未設定のため `configured=0`
- アプリ側には接続状態表示と環境変数の受け口がある
- ただし、Azure OpenAI / Azure AI Vision の実API呼び出し実装はまだ未完了

つまり、この手順で完了するのは「Azure AIリソースを作成し、App Serviceから設定値を読める状態にする」こと。実際の画像認識処理をAzure APIへ差し替える作業は別タスク。

## 作成するもの

| 用途 | Azureリソース | 取得する値 |
| --- | --- | --- |
| 献立生成・認識結果の構造化 | Azure OpenAI | endpoint, key, deployment name, api version |
| 食材画像の候補抽出 | Azure AI Vision または Azure AI services | endpoint, key |

## Foundryで「エージェント」を作る必要があるか

結論: 今回は作らない。

Azure AI Foundry には「Agent」「Project」「Model deployment」など複数の入口があるが、このアプリで必要なのは Azure OpenAI の `deployment name`。
Foundry Agent Service の新しいエージェントを作ると、別のエージェント実行基盤やツール設定の話になり、今回のApp Serviceアプリから呼び出す設定とは別物になる。

今回やること:

```text
Azure AI Foundry または Azure Portal
→ Project / Resource を選ぶ
→ Models + endpoints または Model catalog
→ gpt-4o-mini などを Deploy
→ deployment name を控える
```

やらないこと:

```text
Agents
→ New agent
→ Instructions / tools を設定
```

これは今回のアプリでは不要。

## 推奨名

既存App Serviceと区別しやすい名前にする。

```text
Resource Group: rg-kitchenops-agent-canadacentral
Azure OpenAI resource name: oai-kitchenops-agent-20260601
Azure OpenAI deployment name: gpt-4o-mini-kitchenops
Azure AI Vision resource name: vision-kitchenops-agent-20260601
```

Azure OpenAI のリージョンは、Portalで作成可能かつモデルをデプロイできるリージョンを選ぶ。Canada Centralに表示されない場合は `East US` など、Portalで選べるリージョンを使う。App Serviceと同じリージョンでなくてもよい。

Azure AI Vision は `Canada Central` または `East US` で作成できる方を選ぶ。

## 1. Azure OpenAIリソースを作る

### Portal手順

1. Azure Portalを開く
2. 上部検索で `Azure OpenAI` を検索
3. `Azure OpenAI` を選択
4. `Create` / `作成` を押す
5. Basicsで以下を入力

```text
Subscription: 現在使っているサブスクリプション
Resource group: rg-kitchenops-agent-canadacentral
Region: East US など、作成可能なリージョン
Name: oai-kitchenops-agent-20260601
Pricing tier: Standard S0
```

6. `Review + create`
7. `Create`

### endpoint と key の取得

作成後、Azure OpenAIリソースを開く。

1. 左メニューの `Resource Management`
2. `Keys and Endpoint`
3. 以下を控える

```text
AZURE_OPENAI_ENDPOINT = Endpoint
AZURE_OPENAI_API_KEY = KEY 1 または KEY 2
```

例:

```text
AZURE_OPENAI_ENDPOINT=https://oai-kitchenops-agent-20260601.openai.azure.com/
AZURE_OPENAI_API_KEY=<KEY 1>
```

## 2. Azure OpenAIでモデルをデプロイする

Azure OpenAIでは、APIで使う名前はモデル名ではなく「デプロイ名」。ここがOpenAI APIとの大きな違い。

### Azure AI Foundryの現在の画面での目安

画面の表記は更新されることがある。以下のどれかの流れになっていれば正しい。

#### パターンA: Models + endpoints から作る

1. Azure AI Foundry portal を開く
2. 対象の Project を選ぶ。Projectがなければ作成する
3. 左メニューで `Models + endpoints` を開く
4. `Deploy model` または `+ Deploy` を押す
5. `Deploy base model` を選ぶ
6. `gpt-4o-mini` などを選択
7. Deployment name に以下を入力

```text
gpt-4o-mini-kitchenops
```

8. Deployment type は、迷ったら `Standard` または `Global Standard` を選ぶ
9. Deploy / Create

#### パターンB: Model catalog から作る

1. Azure AI Foundry portal を開く
2. `Model catalog` を開く
3. `gpt-4o-mini` を検索
4. `Use this model` または `Deploy` を押す
5. 接続先の Azure OpenAI / Azure AI Foundry resource を選ぶ
6. Deployment name に以下を入力

```text
gpt-4o-mini-kitchenops
```

7. Deploy / Create

#### パターンC: Azure OpenAIリソースのDeploymentsから作る

1. Azure Portalで Azure OpenAIリソースを開く
2. `Go to Azure AI Foundry portal` を押す
3. `Deployments` または `Models + endpoints` を開く
4. `Deploy model`
5. モデルを選択
   - まずは `gpt-4o-mini` を推奨
   - 表示されなければ `gpt-4o` など、利用可能なモデルを選ぶ
6. Deployment name に以下を入力

```text
gpt-4o-mini-kitchenops
```

7. Deploy

控える値:

```text
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini-kitchenops
AZURE_OPENAI_API_VERSION=2024-10-21
```

API versionはAzure Portal / Foundryのコードサンプルに表示される値を使ってもよい。迷ったらまず `2024-10-21` を設定する。

### AZURE_OPENAI_API_VERSION はどこで見るか

画面上で専用項目として表示されないことが多い。次のどちらかで確認する。

#### 見方A: Foundryのコード表示を見る

1. Azure AI Foundry portal を開く
2. デプロイしたモデル、または Playground / Chat 画面を開く
3. `View code` / `コードの表示` / `Get code` のようなボタンを押す
4. REST または JavaScript / Python のサンプル内にある `api-version` を見る

例:

```text
.../openai/deployments/gpt-4o-mini-kitchenops/chat/completions?api-version=2024-10-21
```

この場合:

```text
AZURE_OPENAI_API_VERSION=2024-10-21
```

#### 見方B: 見つからなければこの値でよい

Azure OpenAIリソースのendpointが以下の形式なら:

```text
https://<resource-name>.openai.azure.com/
```

まずはこの値を使う。

```text
AZURE_OPENAI_API_VERSION=2024-10-21
```

Azure AI Foundryプロジェクトのendpointが以下の形式なら:

```text
https://<resource-name>.services.ai.azure.com/
```

疎通確認スクリプトでは自動でFoundry推論ルートを使う。明示するなら:

```text
AZURE_OPENAI_API_VERSION=2024-05-01-preview
AZURE_OPENAI_USE_FOUNDRY_INFERENCE=true
```

今回のApp Service設定では、迷ったら `2024-10-21` を設定しておけば、接続状態表示には十分。

## 3. Azure AI Visionリソースを作る

Azure AI Vision単体、または Azure AI services のマルチサービスリソースを使う。どちらでも endpoint と key が取れればよい。

### Portal手順

1. Azure Portalを開く
2. 上部検索で `Computer Vision` または `Azure AI services` を検索
3. `Computer Vision` を選ぶ
4. `Create` / `作成` を押す
5. Basicsで以下を入力

```text
Subscription: 現在使っているサブスクリプション
Resource group: rg-kitchenops-agent-canadacentral
Region: Canada Central または East US
Name: vision-kitchenops-agent-20260601
Pricing tier: Free F0 が選べれば F0、なければ Standard S1
```

6. `Review + create`
7. `Create`

### endpoint と key の取得

作成後、Visionリソースを開く。

1. 左メニューの `Resource Management`
2. `Keys and Endpoint`
3. 以下を控える

```text
AZURE_AI_VISION_ENDPOINT = Endpoint
AZURE_AI_VISION_API_KEY = KEY 1 または KEY 2
```

例:

```text
AZURE_AI_VISION_ENDPOINT=https://vision-kitchenops-agent-20260601.cognitiveservices.azure.com/
AZURE_AI_VISION_API_KEY=<KEY 1>
```

## 4. App Serviceに環境変数を設定する

APIキーはGitHubやZennに貼らない。ローカルPowerShellで直接App Serviceへ設定する。

App Serviceへ入れる前に疎通確認する場合は、まず `.env.azure-ai.local.example` をコピーしてローカル専用ファイルを作る。

```powershell
Copy-Item .env.azure-ai.local.example .env.azure-ai.local
```

`.env.azure-ai.local` にAzure Portalから取得した値を入れる。このファイルは `.gitignore` の `*.local` によりコミット対象外。

```text
AZURE_OPENAI_ENDPOINT=https://oai-kitchenops-agent-20260601.openai.azure.com/
AZURE_OPENAI_API_KEY=<Azure OpenAI KEY 1>
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini-kitchenops
AZURE_OPENAI_API_VERSION=2024-10-21

AZURE_AI_VISION_ENDPOINT=https://vision-kitchenops-agent-20260601.cognitiveservices.azure.com/
AZURE_AI_VISION_API_KEY=<Azure AI Vision KEY 1>
AZURE_AI_VISION_API_VERSION=2024-02-01
```

Azure OpenAI v1 のフルURLを使う場合は、endpointに以下の形式を入れても疎通確認スクリプトは対応する。

```text
AZURE_OPENAI_ENDPOINT=https://<resource-name>.openai.azure.com/openai/v1/chat/completions
AZURE_OPENAI_DEPLOYMENT=<deployment-name>
```

疎通確認:

```powershell
npm run test:azure-ai
```

または任意のenvファイルを指定する。

```powershell
node scripts/test-azure-ai-connectivity.mjs --env .env.azure-ai.local
```

期待:

- Azure OpenAI が `kitchenops-ok` を返す
- Azure AI Vision がサンプル画像のcaptionまたはtagsを返す

疎通確認が通ったら、App Serviceへ設定する。

```powershell
.\scripts\azure-configure-ai-settings.ps1 `
  -AzureOpenAiEndpoint "https://oai-kitchenops-agent-20260601.openai.azure.com/" `
  -AzureOpenAiApiKey "<Azure OpenAI KEY 1>" `
  -AzureOpenAiDeployment "gpt-4o-mini-kitchenops" `
  -AzureOpenAiApiVersion "2024-10-21" `
  -AzureAiVisionEndpoint "https://vision-kitchenops-agent-20260601.cognitiveservices.azure.com/" `
  -AzureAiVisionApiKey "<Azure AI Vision KEY 1>"
```

スクリプトは設定後に Web App を再起動する。再起動したくない場合だけ `-SkipRestart` を付ける。

## 5. 直接Azure CLIで設定する場合

補助スクリプトを使わない場合は以下。

```powershell
az webapp config appsettings set `
  --resource-group rg-kitchenops-agent-canadacentral `
  --name kitchenops-agent-yuuya-20260601 `
  --settings `
    "AZURE_OPENAI_ENDPOINT=https://oai-kitchenops-agent-20260601.openai.azure.com/" `
    "AZURE_OPENAI_API_KEY=<Azure OpenAI KEY 1>" `
    "AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini-kitchenops" `
    "AZURE_OPENAI_API_VERSION=2024-10-21" `
    "AZURE_AI_VISION_ENDPOINT=https://vision-kitchenops-agent-20260601.cognitiveservices.azure.com/" `
    "AZURE_AI_VISION_API_KEY=<Azure AI Vision KEY 1>" `
    "VISION_PROVIDER=azure-openai"
```

設定後に再起動する。

```powershell
az webapp restart `
  --resource-group rg-kitchenops-agent-canadacentral `
  --name kitchenops-agent-yuuya-20260601
```

## 6. 確認

```powershell
Invoke-RestMethod https://kitchenops-agent-yuuya-20260601.azurewebsites.net/api/integrations
```

期待:

```text
Azure OpenAI: configured=true
Azure AI Vision: configured=true
OpenAI API: configured=false
```

OpenAI APIは今回は不要。Azure OpenAIを優先する。

## 7. うまくいかない場合

### Azure OpenAIが作成できない

- Azure OpenAIはサブスクリプションやリージョンによって作成できないことがある
- `East US` など、Portalで作成可能なリージョンを試す
- モデルが表示されない場合は別リージョンまたは別モデルを試す

### deployment name が分からない

Azure AI Foundry portal の `Deployments` に表示されている名前が deployment name。
モデル名 `gpt-4o-mini` ではなく、作成時に自分で付けた `gpt-4o-mini-kitchenops` のような名前を使う。

### `/api/integrations` が `configured=false` のまま

- App Serviceの環境変数名が間違っていないか確認
- Web Appを再起動したか確認
- endpointの末尾 `/` はあってもなくても基本的には問題ない
- APIキーを余計な引用符つきで入れていないか確認

## 8. 注意

- APIキーはGitHub、Zenn、チャットに貼らない
- GitHub Actions secretに入れる必要はない。App Service の環境変数でよい
- 現在のアプリは Microsoft AI の接続状態表示まで実装済み
- Azure OpenAI / Azure AI Vision の実プロバイダ実装は次の開発タスク

## 参考

- Azure OpenAIリソース作成とモデルデプロイ: https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/create-resource
- Azure OpenAIのendpoint/key/deployment確認: https://learn.microsoft.com/en-us/azure//ai-services/openai/use-your-data-quickstart
- Azure AI services / Visionリソース作成: https://learn.microsoft.com/en-us/azure/ai-services/multi-service-resource
