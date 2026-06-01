# 動作確認メモ

## 2026-06-01 AI実APIスキャン確認

| 項目 | 結果 | メモ |
| --- | --- | --- |
| ローカル `/api/vision/scan` 実AI経路 | OK | バナナ画像URLを送信し、Azure AI Vision + Azure OpenAI で `canonicalName=banana` |
| Azure AI Vision | OK | caption/tags/objects に `banana`, `fruit`, `food`, `Banana` を取得 |
| Azure OpenAI | OK | Vision signals を `バナナ -> banana` に正規化 |
| `npm run build` | OK | client / server production build 成功 |
| `npm run lint` | OK | ESLint 成功 |
| Azure App Service デプロイ | OK | `hackathon-submission-ai-2026-06-01` タグで GitHub Actions 成功 |
| 公開URL `/api/state` | OK | `visionProvider=azure-ready` |
| 公開URL `/api/vision/scan` 実AI経路 | OK | バナナ画像URLを送信し、Azure AI Vision + Azure OpenAI で `canonicalName=banana` |

次の確認: 公開URL上のブラウザ画面で、実カメラ入力から同じAI経路が動くことを確認する。

確認日: 2026-06-01
対象URL: https://kitchenops-agent-yuuya-20260601.azurewebsites.net

## 確認済み

| 項目 | 結果 | メモ |
| --- | --- | --- |
| `GET /` | OK | HTMLが200で返る |
| `GET /api/health` | OK | `{"ok":true,"service":"kitchen-ai","port":8080}` |
| `GET /api/integrations` | OK | 3件返る。現時点の configured は 0 |
| `POST /api/vision/scan` | OK | デモ入力 `milk` で `canonicalName=milk`, `confidence=0.92` |
| `POST /api/meal-plan/generate` | OK | 献立生成成功。確認時点の coverage は 88 |
| Azure OpenAI ローカル疎通 | OK | `kitchenops-ok` を返す |
| Azure AI Vision ローカル疎通 | OK | サンプル画像のcaption/tagsを返す |
| App Service AI設定 | OK | `/api/integrations` で Azure OpenAI / Azure AI Vision が `configured=true` |

## 未確認 / 未完了

- Azure OpenAI / Azure AI Vision を使った実プロバイダ実装
- ブラウザでの全画面手動確認
- スマートフォン実機でのカメラ権限確認
- GitHub公開リポジトリURL
- 提出タグURL
- Zenn公開記事URL
- デモ動画URL

## 現状の読み方

公開アプリとしての起動、主要API、デモ入力、献立生成は動作確認済み。
ただし Microsoft AI は接続状態表示と設定境界までで、Azure OpenAI / Azure AI Vision の実接続は未完了。
