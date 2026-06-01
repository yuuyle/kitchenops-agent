# 開発タスク

## 2026-06-01 AI実装更新

- [x] `/api/vision/scan` に Azure AI Vision + Azure OpenAI の実API判定経路を追加
- [x] 固定カメラのキャプチャ画像を Azure AI Vision で解析し、caption/tags/objects を取得
- [x] Azure AI Vision の解析結果を Azure OpenAI に渡し、既存在庫カタログの `canonicalName` へ正規化
- [x] AI判定結果の `cvSignal` / `llmSignal` / `fusionNote` を検出履歴に保存
- [x] Azure AI 未設定時やAI判定失敗時は既存デモ候補へフォールバック
- [x] ローカルで実AIスキャン疎通確認済み: バナナ画像 -> `canonicalName=banana`
- [x] `npm run build` / `npm run lint` 成功
- [x] GitHub Actions で Azure App Service に実AIスキャン実装をデプロイ
- [x] 公開URLで画像入力から Azure AI Vision + Azure OpenAI の実動作確認
- [x] App Service の起動猶予 `WEBSITES_CONTAINER_START_TIME_LIMIT=600` を設定

## 完了済み

- [x] React + TypeScript + Vite のフロントエンドを作成
- [x] Express API サーバーを追加
- [x] JSON永続化のキッチンDBを追加
- [x] 食材在庫モデル、家族設定、レシピ、献立、検出履歴の共通型を定義
- [x] 固定カメラ画面を作成
- [x] `getUserMedia` で動画を取得
- [x] 動画フレームを定期的に抽出して `/api/vision/scan` に送信
- [x] 入庫モードで食材の追加・加算を実装
- [x] 使用モードで食材の差し引き・削除を実装
- [x] 重複検出の抑制を実装
- [x] 1週間献立生成APIを実装
- [x] 在庫カバー率と買い足しリストを算出
- [x] 献立、レシピ、在庫、家族設定の管理画面を実装
- [x] 在庫の手動追加・削除を実装
- [x] アクティビティログを実装
- [x] 仕様書を作成
- [x] 本番AI接続前提の境界を定義
- [x] SQLite へ永続化を移行
- [x] 既存JSONデータからSQLiteへの初回移行を実装
- [x] 食材の確認キューを追加
- [x] 確認キューの採用・却下APIを追加
- [x] 確認キューの採用・却下UIを追加
- [x] 冷蔵庫・冷凍庫・常温棚ごとの表示フィルタを追加
- [x] カメラ位置キャリブレーション画面を追加
- [x] カメラ設定保存APIを追加
- [x] 同一商品のトラッキングIDを導入
- [x] 複数フレームを1つの食材トラックへ集約
- [x] 使用後の残量入力UIを追加
- [x] レシピ検索元の優先・除外サイト設定を追加
- [x] Azure App Service / Linux / Node.js 24 をデプロイ先に決定
- [x] App Service向け本番起動スクリプトを追加
- [x] ExpressでReactビルド成果物を本番配信
- [x] Azure App Service用GitHub Actions雛形を追加
- [x] Azureデプロイ手順を作成
- [x] Canada Central向けAzure CLI作成スクリプトを追加
- [x] Azure App Service に実デプロイして成果物URLを作成
- [x] Azure公開URLの `/api/health` と `/api/integrations` を確認
- [x] Azure公開URLでデモ食材スキャンAPIを確認
- [x] Azure公開URLで献立生成APIを確認
- [x] カメラなしで審査員が確認できるデモ用サンプル入力を追加
- [x] Azure OpenAI / Azure AI Vision / OpenAI API の接続状態APIを追加
- [x] Microsoft AI 連携状態を管理画面に表示
- [x] 提出用URLと審査員向け試用手順を整理
- [x] Zenn記事ドラフトを作成
- [x] アーキテクチャ図のMermaid案を作成
- [x] 3分デモ動画台本を作成
- [x] 公開アプリのAPI動作確認メモを作成
- [x] Azure OpenAI / Azure AI Vision App Service設定用スクリプトを作成
- [x] Azure OpenAI / Azure AI Vision リソース作成手順を詳細化
- [x] Azure AI Foundryでエージェント作成が不要なことを手順に追記
- [x] Azure OpenAI / Azure AI Vision ローカル疎通確認スクリプトを作成
- [x] Azure OpenAI / Azure AI Vision のローカル疎通確認に成功
- [x] Azure OpenAI リソースを作成し、App Service環境変数へ設定
- [x] Azure AI Vision リソースを作成し、App Service環境変数へ設定
- [x] 公開アプリの `/api/integrations` で Azure OpenAI / Azure AI Vision が `configured=true` になることを確認

## 次に実装するべきこと

- [ ] クラウド同期を追加
- [ ] クラウド同期用の最小アカウント/端末紐付けを追加
- [ ] GitHub公開リポジトリを作成して提出タグを切る
- [ ] OpenAI 画像認識プロバイダを実装
- [ ] Azure OpenAI 画像認識プロバイダを実装
- [ ] 画像認識プロバイダの選択、フェイルオーバー、信頼度比較を実装
- [ ] 食材そのものの画像認識精度を優先して改善
- [ ] 安定フレーム数に達してから在庫反映する認識ゲートを実装
- [ ] 同一食材を複数個連続登録した後の重複確認UIを実装
- [ ] バーコード・OCR・賞味期限読み取りを追加
- [ ] CV前処理をWeb Workerまたはバックエンド処理へ分離
- [ ] レシピ検索APIを接続
- [ ] レシピ出典URL、取得日時、ライセンス情報を保存
- [ ] 日本食品標準成分表ベースの栄養計算データを接続
- [ ] 献立生成に買い物予算と調理負荷の平準化を追加
- [ ] 調理開始時の食材使用候補を献立と照合
- [ ] モバイルでのカメラ権限・横向き表示を検証
- [ ] E2Eテストを追加

## 本番マイルストーン

### M1: 家庭内MVP

- カメラ入庫と使用削除のデモ運用
- 手動補正できる在庫画面
- 1週間献立とレシピ閲覧
- SQLiteでローカル保存

### M2: AI認識強化

- CV前処理
- LLM画像認識
- OCRとバーコード
- 信頼度統合
- 確認キュー

### M3: 献立品質向上

- Webレシピ調査
- 栄養計算
- 家族の履歴学習
- 余り食材の優先消費
- 買い物リスト自動生成

### M4: 運用化

- 認証
- クラウドDB
- クラウド同期
- バックアップ
- デバイス設定
- 監査ログ
- プライバシー設定
