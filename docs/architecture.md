# KitchenOps Agent アーキテクチャ図

Zenn記事には以下の Mermaid 図を画像化、または Mermaid 対応環境でそのまま貼り付ける。

```mermaid
flowchart LR
  user[利用者 / 審査員] --> browser[Browser UI]

  subgraph Browser UI
    camera[固定カメラ画面\n入庫 / 使用モード]
    demo[デモ入力\nカメラなし確認]
    stock[在庫ダッシュボード\n残量補正]
    plan[献立管理\n1週間プラン]
    recipe[レシピ詳細\n出典設定]
    family[家族 / 施設条件]
  end

  browser --> camera
  browser --> demo
  browser --> stock
  browser --> plan
  browser --> recipe
  browser --> family

  camera --> api[Express API on Azure App Service]
  demo --> api
  stock --> api
  plan --> api
  recipe --> api
  family --> api

  subgraph Agent Layer
    vision[Vision Scan Agent\nフレーム集約 / 重複抑制]
    fusion[Confidence Fusion\nCV候補 + AI候補 + LLM統合]
    planner[Inventory Action Planner\n登録 / 加算 / 使用 / 削除]
    meal[Meal Planning Agent\n在庫 / 好み / 栄養 / 予算]
    review[Human-in-the-loop\n確認キュー]
  end

  api --> vision
  vision --> fusion
  fusion --> planner
  fusion --> review
  api --> meal

  subgraph Microsoft Azure
    appservice[Azure App Service\nLinux Node.js]
    aivision[Azure AI Vision\n画像候補抽出]
    azureopenai[Azure OpenAI / Microsoft AI\n構造化・献立生成]
    futuredb[Azure SQL / Cosmos DB\n将来のクラウド同期]
  end

  api --- appservice
  fusion -. 接続境界 / 環境変数 .-> aivision
  fusion -. 接続境界 / 環境変数 .-> azureopenai
  meal -. 接続境界 / 環境変数 .-> azureopenai

  subgraph Data
    sqlite[SQLite\nローカル永続化]
    json[JSON fallback\nApp Service互換]
    inventory[在庫 / 期限 / 数量]
    detections[検出履歴 / Track ID]
    meals[献立 / 買い足し]
    profile[家族・施設プロファイル]
  end

  planner --> sqlite
  meal --> sqlite
  review --> sqlite
  sqlite --> inventory
  sqlite --> detections
  sqlite --> meals
  sqlite --> profile
  sqlite -. 実行環境により .-> json
  sqlite -. 将来拡張 .-> futuredb
```

## 図で強調すること

- 観測、判断、記憶、行動、自己補正を持つ Agentic AI として説明する
- Azure App Service で実行されていることを明示する
- Azure AI Vision / Azure OpenAI は接続境界と画面上の状態表示を実装済みであることを説明する
- 認識が不確実な場合は確認キューへ回し、現場運用を止めない設計であることを示す
- クラウド同期は Azure SQL / Cosmos DB へ拡張する構成として示す
