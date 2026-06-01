# Azure App Service デプロイ手順

対象: Microsoft Agent Hackathon 提出用の成果物URL作成  
推奨構成: Azure App Service / Linux / Node.js 24

## 0. Canada Central でCLI作成する場合

App Service Plan の作成で `Total VMs: 0` のクォータエラーが出る場合は、作成できるリージョンに寄せる。現時点では `Canada Central` を優先する。

このリポジトリでは以下の名前で作成する。

- Resource Group: `rg-kitchenops-agent-canadacentral`
- App Service Plan: `asp-kitchenops-agent-canadacentral`
- Web App: `kitchenops-agent-yuuya-20260601`
- Region: `canadacentral`
- SKU: `B1`

ローカルに Azure CLI が入っている場合:

```powershell
az login
.\scripts\azure-create-app-service.ps1
```

Azure CLI がない場合は、Azure Portal の Cloud Shell を PowerShell で開き、同じ内容を実行する。

Web App 名が既に使われている場合だけ、別名で実行する。

```powershell
.\scripts\azure-create-app-service.ps1 -WebAppName "kitchenops-agent-yuuya-20260601-2"
```

スクリプト実行後、同じフォルダに出力される `.PublishSettings` ファイルの中身を GitHub Actions secret `AZURE_WEBAPP_PUBLISH_PROFILE` に登録する。

## 1. Azure側で作るもの

### Resource Group

- 例: `rg-kitchenops-agent-hackathon`
- Region: `Japan East`

### App Service Plan

- OS: Linux
- SKU: Basic B1 以上を推奨
- 短期ハッカソン提出なら B1 で十分

### Web App

- Runtime stack: Node 24 LTS
- Publish: Code
- App name例: `kitchenops-agent-<unique>`
- Startup Command: 空欄でよい。`package.json` の `npm start` が使われる。

## 2. App Service の環境変数

Azure Portal の Web App > Settings > Environment variables に設定する。

必須:

- `NODE_ENV=production`
- `KITCHEN_DATA_DIR=/home/data/kitchenops-agent`

Microsoft AI 接続:

- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_DEPLOYMENT`
- `AZURE_OPENAI_API_VERSION`
- `AZURE_AI_VISION_ENDPOINT`
- `AZURE_AI_VISION_API_KEY`
- `VISION_PROVIDER=azure-openai`

任意フォールバック:

- `OPENAI_API_KEY`

## 3. GitHub Secrets

GitHub repository > Settings > Secrets and variables > Actions に追加する。

- `AZURE_WEBAPP_PUBLISH_PROFILE`

Publish Profile は Azure Portal の Web App 画面から Download publish profile で取得する。

## 4. GitHub Actions の修正

[`.github/workflows/azure-app-service.yml`](../.github/workflows/azure-app-service.yml) の `AZURE_WEBAPP_NAME` を実際の Web App 名に変更する。

```yaml
env:
  AZURE_WEBAPP_NAME: kitchenops-agent-xxxx
```

## 5. デプロイ

手動実行:

1. GitHub Actions を開く
2. `Deploy KitchenOps Agent to Azure App Service` を選択
3. `Run workflow`

提出タグで実行:

```bash
git tag hackathon-submission-2026-06-01
git push origin hackathon-submission-2026-06-01
```

## 6. 動作確認

Azure URL で以下を確認する。

- `/` が管理画面を表示する
- `/api/health` が `{ ok: true }` を返す
- `/api/integrations` で Azure OpenAI / Azure AI Vision の設定状態を確認できる
- 献立生成ボタンが動く
- カメラが使えない環境でもデモ用スキャンが動く

## 7. ハッカソン提出前の注意

- 審査期間中、少なくとも 2026-06-18 までは App Service を停止しない
- 認証を入れる場合は審査員用ログイン情報を提出フォームに書く
- GitHub リポジトリは公開にする
- 提出時点のタグURLを控える
