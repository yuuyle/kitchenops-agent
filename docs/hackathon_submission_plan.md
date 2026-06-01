# Microsoft Agent Hackathon 提出計画

作成日: 2026-05-31  
対象: Microsoft Agent Hackathon powered by Tokyo Electron Device  
応募ページ: https://zenn.dev/hackathons/microsoft-agent-hackathon-2026

## 1. 読み取った必須条件

### 締切・審査

- 申込・提出締切: 2026-06-01 23:59
- 審査期間: 2026-06-02 から 2026-06-09
- 最終審査進出通知: 2026-06-10
- 最終審査会・表彰式: 2026-06-18
- 最終審査は企業部門5チーム、個人部門5チームの計10チームが登壇

### 技術要件

- 必須: Microsoft Azure アプリケーション実行基盤、または Copilot Studio の利用
- 必須: Microsoft AI 技術を1つ以上利用
- 例:
  - Azure App Service
  - Azure Container Apps
  - Azure Functions
  - Azure OpenAI / Microsoft Foundry
  - Azure AI Vision
  - Azure AI Agent Service / Semantic Kernel
- 推奨利用として Azure Cosmos DB、GitHub、Microsoft Entra ID などが挙げられている

### 提出物

- 成果物URL
  - 審査員が実際に触れるWebアプリURL
  - 認証ありの場合は審査員用ログイン情報または試用方法が必要
- Zennブログ記事
  - 実装上の工夫
  - アーキテクチャ
  - プロンプトの工夫
  - 3分程度のデモ動画埋め込みが必須
  - アーキテクチャ図の埋め込みが必須
- GitHubリポジトリURL
  - 任意だが提出推奨
  - 公開状態
  - 提出時点の状態を 2026-06-18 まで保持
  - 継続開発する場合は提出締切前のタグURLを提出

### 審査基準

- ビジネスインパクト
  - 業務課題を的確に捉え、効率化や新規性などの価値を生むか
- アプローチの有効性
  - Agentic AI としての振る舞い、アーキテクチャが課題解決に有効か
- 完成度・実現性
  - 安定動作、導入コスト、運用性が考慮されているか

## 2. 提出コンセプト

### 推奨タイトル

KitchenOps Agent: 冷蔵庫前カメラで食材在庫と献立を自律運用するAIエージェント

### 入賞向けの見せ方

現在のアプリは家庭向けに見えるが、ハッカソンの評価軸は「業務現場の課題解決」なので、提出時は以下の業務課題として語る。

- 小規模飲食店、保育施設、介護施設、社員食堂では、食材在庫・期限・献立・買い足しが属人化しやすい
- 手入力の在庫管理は続かない
- 食品ロス、発注漏れ、栄養バランス、調理負荷が同時に発生する
- KitchenOps Agent は、固定カメラで食材の入庫・使用を観測し、在庫DBを更新し、1週間の献立と買い足しを提案する

### Agentic AI として強調するポイント

- 観測: 冷蔵庫前カメラから食材通過を検出
- 判断: CV信号、Azure AI Vision、Azure OpenAI の認識結果を統合
- 記憶: 在庫、期限、家族/施設条件、レシピソース設定を保存
- 行動: 在庫登録、使用反映、確認キュー作成、献立生成、買い足しリスト作成
- 自己補正: 信頼度が低い候補は確認キューへ回し、残量入力で現場補正できる

## 3. 入賞のための差別化

### 技術差別化

- 固定カメラ前を通すだけの連続登録UX
- 同一商品のトラッキングIDとフレーム集約
- 確認キューによる Human-in-the-loop
- 残量補正による現実運用への接続
- Azure AI Vision + Azure OpenAI による認識統合
- SQLiteローカル保存からクラウド同期へ拡張可能な構成

### ストーリー差別化

「献立AI」だけでは弱い。  
「現場の食材オペレーションを観測から計画まで閉じるエージェント」として打ち出す。

### デモ差別化

3分動画では機能説明よりも、以下のストーリーを見せる。

1. 買ってきた食材を冷蔵庫前カメラに通す
2. 在庫が自動更新される
3. 認識が曖昧なものは確認キューへ入る
4. 1週間の献立と買い足しリストを生成する
5. 調理時に食材を使用モードで通す
6. 使用後の残量を補正する
7. 食品ロスと献立作成時間を削減できる、と締める

## 4. 提出までの実施タスク

### P0: 提出必須対応

- [x] Azureデプロイ先を決める
  - 採用: Azure App Service / Linux / Node.js 24
  - 理由: React + Express + Node の現構成を最短で公開URL化できる
- [x] Azure App Service 向け本番起動構成を追加
  - `npm run build`
  - `npm start`
  - Express が React `dist` と `/api/*` を同時配信
- [x] GitHub Actions の App Service デプロイ雛形を追加
  - `.github/workflows/azure-app-service.yml`
- [x] Azureデプロイ手順を作成
  - `docs/azure_app_service_deployment.md`
- [x] Microsoft AI 技術を実装上またはデモ上で明示する
  - 最低ライン: Azure OpenAI / Azure AI Vision の接続境界と設定UIを実装
  - 可能なら実APIで1枚の食材画像認識を動かす
- [x] 成果物URLを作る
  - Azure上にデプロイ
  - 審査期間中 2026-06-18 まで落とさない
- [ ] Zenn記事を書く
  - ドラフト: `docs/zenn_article_draft.md`
- [ ] 3分デモ動画を作る
  - 台本: `docs/demo_video_script.md`
- [x] アーキテクチャ図を作る
  - Mermaid案: `docs/architecture.md`
- [ ] GitHub公開リポジトリを用意する
- [ ] 提出時点タグを切る
  - 例: `hackathon-submission-2026-06-01`

### P1: 入賞確率を上げる実装

- [x] Azure OpenAI / Azure AI Vision の接続状態表示を追加
- [ ] Azure OpenAI / Azure AI Vision 実プロバイダを追加
- [ ] Mock Vision と Azure Vision の切り替え表示を追加
- [ ] 認識結果に「CV候補」「AI Vision候補」「LLM統合結果」を表示
- [ ] 安定フレーム数に達してから在庫反映する認識ゲートを実装
- [ ] 同一食材を複数個連続登録した後の重複確認UIを実装
- [ ] クラウド同期のデモ実装または設計を追加
  - 時間が少ない場合は Cosmos DB / Azure SQL の将来構成を記事と図で明示
- [x] デモ用のサンプル動画または画像投入モードを追加
  - 審査員がカメラなしでも動作確認できるようにする

### P2: 記事・動画の完成度

- [x] Zenn記事タイトルを作る
- [x] 冒頭に業務課題とインパクトを置く
- [x] アーキテクチャ図を埋め込む
- [ ] プロンプト設計を載せる
- [x] Human-in-the-loop の設計を載せる
- [x] 失敗時の運用、信頼度、残量補正を載せる
- [ ] 3分動画をYouTube等へ限定公開でアップロード
- [ ] 記事に動画を埋め込む

## 5. Zenn記事構成案

### タイトル案

冷蔵庫前カメラで食材在庫と献立を自律運用する KitchenOps Agent

### 見出し案

1. なぜ作ったか: 食材管理は「手入力」が最大の失敗要因
2. 解く業務課題: 小規模施設・飲食現場の在庫、期限、献立、買い足し
3. KitchenOps Agent の体験
4. アーキテクチャ
5. Agentic AI としての設計
6. 画像認識パイプライン
7. Human-in-the-loop: 確認キューと残量補正
8. 献立生成とレシピ検索元制御
9. Azure / Microsoft AI の使いどころ
10. 苦労した点
11. 今後: クラウド同期、栄養計算、実店舗/施設導入

### 記事で必ず言うこと

- これは単なる献立生成ではなく、食材オペレーションを自律的に回すエージェントである
- 認識の不確実性は避けず、確認キューと残量補正で運用に落とす
- 現場導入では「100%自動」より「止まらない補正可能性」が重要

## 6. 3分動画構成

### 0:00-0:20 課題

- 食材在庫は手入力が続かない
- 期限切れ、買い忘れ、献立作成の負荷が起きる

### 0:20-0:50 解決策

- 冷蔵庫前カメラに通すだけで在庫化
- AIが献立と買い足しを作る

### 0:50-1:30 入庫デモ

- カメラ画面
- 登録モード
- 自動検出
- トラッキング表示
- 確認キュー

### 1:30-2:05 献立デモ

- 1週間献立生成
- レシピ詳細
- 買い足しリスト

### 2:05-2:35 使用デモ

- 使用モード
- 使用検出
- 残量入力
- 在庫更新

### 2:35-3:00 アーキテクチャと締め

- Azure App Service / Azure OpenAI / Azure AI Vision / DB
- 食品ロス削減、献立作成時間削減、現場運用に効くと締める

## 7. アーキテクチャ図に入れる要素

- Browser UI
  - Camera Capture
  - Inventory Dashboard
  - Meal Plan Dashboard
  - Review Queue
- Backend API
  - Vision Scan API
  - Inventory API
  - Meal Plan API
  - Recipe Settings API
- Agent Layer
  - Frame aggregation
  - Confidence fusion
  - Inventory action planner
  - Meal planning agent
- Microsoft / Azure
  - Azure App Service or Container Apps
  - Azure AI Vision
  - Azure OpenAI / Microsoft Foundry
  - Azure Cosmos DB or Azure SQL
- Data
  - Inventory
  - Detections
  - Review Queue
  - Meal Plans
  - Family / Facility Profile

## 8. 提出前チェックリスト

- [x] Azure URLでアプリを開ける
- [x] 審査員がログインなし、または提出情報だけで試せる
- [x] カメラがなくてもデモできるサンプル入力がある
- [x] Microsoft AI 技術の利用箇所が記事と画面で明確
- [ ] Zenn記事に3分動画が埋め込まれている
- [x] Zenn記事にアーキテクチャ図が埋め込まれている
- [ ] GitHubリポジトリが公開されている
- [ ] 提出タグが作成されている
- [x] READMEに起動手順、環境変数、Azure構成がある
- [ ] 2026-06-18 までアプリURLを維持する

## 9. 直近の作業順

締切が近いため、以下の順番で進める。

1. [完了] Azureデプロイ方針を確定
2. [完了] デモ用サンプル入力モードを実装
3. [完了] Azure AI Vision / Azure OpenAI の設定枠を実装
4. [完了] Zenn記事ドラフト作成
5. [完了] アーキテクチャ図作成
6. [完了] 動画台本作成
7. 動画収録
8. [完了] Azureデプロイ
9. READMEと提出タグ整理
10. 提出フォーム入力

## 10. リスクと対策

### リスク: Azure実API接続が間に合わない

対策:
- 設定UIとプロバイダ境界は実装する
- 動画・記事ではAzure AI Vision / Azure OpenAI接続構成を明示
- ただし提出要件上は実際に Microsoft AI 技術を使う必要があるため、最低でもAzure OpenAIのテキスト構造化APIだけは通す

### リスク: カメラ環境が審査員側で使えない

対策:
- サンプルフレーム投入モードを用意
- 3分動画で実運用デモを見せる

### リスク: 家庭向けに見えてビジネスインパクトが弱い

対策:
- 小規模飲食店、保育施設、介護施設、社員食堂の食材運用に寄せて説明する
- 食品ロス、棚卸、献立作成、発注漏れを定量的に語る

### リスク: 完成度不足に見える

対策:
- 認識が曖昧なケースを隠さず、確認キューと残量補正を「運用設計」として見せる
- AzureデプロイURL、README、Zenn記事、動画、アーキ図を揃える
