# Kitchen AI

固定カメラで食材の入庫・使用を検知し、在庫から1週間の献立を生成する管理アプリのMVPです。

## 起動

```bash
npm install
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:8787

## 本番ビルド

```bash
npm run build
$env:NODE_ENV='production'; npm start
```

- App Service では `npm start` で `dist-server/server/index.js` を起動します。
- Express が `/api/*` と React の `dist` を同時に配信します。

## 実装済み

- カメラ映像の取得
- 動画フレームの自動スキャン
- カメラなしで動作確認できるデモ用サンプル入力
- カメラ位置キャリブレーション
- 同一商品のトラッキング集約
- 食材の自動登録、加算、使用、削除
- 使用後の残量入力
- 在庫の手動追加・削除
- 家族設定
- レシピ検索元の優先・除外設定
- 1週間の献立生成
- レシピ詳細表示
- 買い足しリスト
- アクティビティログ
- Azure OpenAI / Azure AI Vision / OpenAI API の接続状態表示

## ドキュメント

- [仕様書](docs/specification.md)
- [開発タスク](docs/tasks.md)
- [Azure App Service デプロイ手順](docs/azure_app_service_deployment.md)
- [ハッカソン提出計画](docs/hackathon_submission_plan.md)

## データ保存

API起動時に `data/kitchen.sqlite` を作成し、在庫・家族設定・献立・ログを保存します。旧バージョンの `data/kitchen.json` がある場合は初回起動時にSQLiteへ取り込みます。

## AI接続

現在はAPIキーなしで動く `mock` 認識です。管理画面のカメラタブでは、カメラなしで使えるデモ用サンプル入力と、Azure OpenAI / Azure AI Vision / OpenAI API の接続状態を確認できます。本番化では `server/ai.ts` の `scanFrame` と `generateMealPlan` を画像認識プロバイダ、Webレシピ検索、栄養計算サービスへ差し替えます。

Azure App Service 提出では、以下の環境変数を設定します。

- `NODE_ENV=production`
- `KITCHEN_DATA_DIR=/home/data/kitchenops-agent`
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_DEPLOYMENT`
- `AZURE_OPENAI_API_VERSION`
- `AZURE_AI_VISION_ENDPOINT`
- `AZURE_AI_VISION_API_KEY`
