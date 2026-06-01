# Kitchen AI 仕様書

## 目的

固定カメラで食材の入庫・使用を自動検知し、在庫データベースを更新する。登録済みの家族構成、嗜好、栄養目標、現在の在庫から1週間の献立をAIで生成し、管理画面から献立、レシピ、在庫を確認できるようにする。

## 対象ユーザー

- 家庭でまとめ買いをし、冷蔵庫・常温・冷凍の在庫を管理したい人
- 家族の好みや栄養を踏まえて1週間の献立を短時間で決めたい人
- 調理時の食材消費を手入力せず、カメラで在庫へ反映したい人

## MVP スコープ

### 1. 食材登録

- 固定カメラの動画をブラウザで取得する。
- 一定間隔でフレームを抽出し、APIへ送信する。
- 検出対象エリア、設置場所、明るさ、カメラ角度をキャリブレーション設定として保存する。
- カメラは冷蔵庫前に固定し、上から下向きに通過する食材を読み取る運用を第一想定にする。
- 入庫と使用は同じカメラを使い、画面上のモード切り替えで判別する。
- API側で Computer Vision 信号、OpenAI/Azure OpenAI の画像認識信号、LLM構造化を統合する境界を用意する。
- 現時点の実装は `mock` プロバイダ。画像ハッシュから食材候補、数量、単位、保管場所、期限目安、信頼度を返す。
- 信頼度が閾値以上の場合、在庫へ自動登録または加算する。
- 同一食材・同一モードはトラッキングIDで集約し、指定秒数内の連続フレームは重複として扱う。

### 2. 食材使用

- カメラ画面で「使用」モードに切り替える。
- 検出された食材が在庫にあれば数量を差し引く。
- 管理画面でその日使用した食材の残量を入力し、在庫数量を補正できる。
- 数量が0に更新された場合は使い切りとして在庫から削除する。
- 在庫に存在しない場合は確認が必要な検出として履歴に残す。

### 3. 献立生成

- 登録済みの家族構成、アレルギー、苦手、好み、栄養目標、最大調理時間を参照する。
- 在庫量、期限注意食材、レシピの必要材料、調理時間、タグをスコアリングする。
- 7日分の朝・昼・夜を生成する。
- 在庫カバー率と買い足しリストを算出する。
- 生成結果はAPIの状態に保存する。

### 4. レシピ管理

- 献立からレシピ詳細へ遷移できる。
- レシピには材料、手順、人数、調理時間、栄養目安、AI要約、Web検索リンクを保持する。
- レシピ検索元は優先サイトと除外サイトを設定できる。
- MVPではローカルのレシピカタログをWeb調査候補として扱う。
- 本番では検索APIまたはレシピ提供APIを接続し、出典URL、取得日時、利用条件を保存する。

### 5. 管理画面

- カメラ、献立、レシピ、在庫、家族設定のタブを提供する。
- 在庫の手動追加・削除を提供する。
- 在庫の残量を入力して、使用後の数量を補正できる。
- 認識信頼度が低い候補を確認キューとして表示し、採用または却下できる。
- 在庫は常温、冷蔵、冷凍で絞り込める。
- カメラ画面で検出エリアをプレビューし、トラッキング中の食材とフレーム数を表示する。
- 期限注意、買い足し件数、在庫数、鮮度スコアを表示する。
- アクティビティログに検出、在庫変更、献立生成を残す。

## データモデル

### IngredientStock

- `id`: 在庫ID
- `name`: 表示名
- `canonicalName`: 食材正規化キー
- `category`: 食材カテゴリ
- `quantity`, `unit`: 数量と単位
- `storage`: `pantry` / `fridge` / `freezer`
- `expiresAt`: 期限
- `source`: `camera` / `manual` / `seed`
- `confidence`: 認識信頼度
- `status`: `ok` / `use-soon` / `expired`

### FamilyProfile

- `members`: 家族構成
- `allergies`, `dislikes`: アレルギーと苦手
- `favoriteStyles`, `nutritionGoals`: 好みと栄養目標
- `recipeSourcePreferences.preferredSites`: 優先するレシピ検索元
- `recipeSourcePreferences.blockedSites`: 除外するレシピ検索元
- `maxCookingMinutes`, `weeklyBudgetYen`: 調理時間と週予算

### VisionDetection

- `mode`: `intake` / `consume`
- `label`, `canonicalName`, `category`
- `quantity`, `unit`, `confidence`
- `trackId`, `frameCount`: 同一商品の連続検出集約情報
- `action`: `added` / `increased` / `consumed` / `removed` / `ignored_duplicate` / `needs_review`
- `pipeline.cvSignal`: CV側の検出説明
- `pipeline.llmSignal`: LLM側の候補説明
- `pipeline.fusionNote`: 統合判定説明

### CameraCalibration

- `placement`: `bag_station` / `fridge_front` / `countertop` / `unknown`
- `lighting`: `dim` / `normal` / `bright`
- `perspective`: `top_down` / `front` / `angled`
- `regionOfInterest`: 検出対象エリア。画面比率で `x`, `y`, `width`, `height` を保存する
- `stabilityFrames`: 安定判定に必要な連続フレーム数
- `duplicateWindowMs`: 同一トラックへ集約する時間

### VisionTrack

- `id`: トラッキングID
- `mode`, `label`, `canonicalName`
- `firstSeenAt`, `lastSeenAt`
- `frameCount`, `bestConfidence`
- `status`: `observing` / `committed` / `needs_review` / `ignored`

### MealPlan

- `generatedAt`
- `coveragePercent`
- `days[7]`
- `shoppingList`
- `summary`

### ReviewQueueItem

- `detection`: 確認対象の検出結果
- `reason`: 確認が必要な理由
- `status`: `pending` / `approved` / `rejected`
- `createdAt`, `resolvedAt`: 作成日時と解決日時

### 永続化

- `data/kitchen.sqlite` にSQLite形式で保存する。
- 旧JSONデータ `data/kitchen.json` が存在し、SQLiteに状態がない場合は初回起動時に取り込む。

## API

- `GET /api/state`: 全体状態を取得
- `PATCH /api/family`: 家族設定を保存
- `POST /api/inventory`: 在庫を手動追加
- `PATCH /api/inventory/:id`: 在庫を更新
- `DELETE /api/inventory/:id`: 在庫を削除
- `POST /api/vision/scan`: 動画フレームから食材を判定し、入庫または使用を反映
- `PATCH /api/camera/calibration`: カメラ設置、検出エリア、集約設定を保存
- `POST /api/review/:id/approve`: 確認キューの候補を採用して在庫へ反映
- `POST /api/review/:id/reject`: 確認キューの候補を却下
- `POST /api/meal-plan/generate`: 1週間献立を生成
- `GET /api/recipes/:id`: レシピ詳細を取得

## 本番AI設計

### 画像認識パイプライン

1. フレーム抽出: 2から3秒間隔、ブレ検出、重複フレーム除外
2. CV前処理: 背景差分、動体検出、商品領域候補、色・輪郭・バーコード候補
3. OpenAI/Azure OpenAI画像認識: 食材名、数量、パッケージ表記、消費期限候補を抽出
4. フュージョン: CV候補、LLM候補、過去在庫、直近検出、信頼度を統合
5. 自動反映: 閾値以上はDB更新、閾値未満は確認キュー

### レシピ調査

1. 献立候補を生成
2. Web検索APIまたはレシピAPIで候補レシピを取得
3. 材料、手順、調理時間、栄養、出典URLを構造化
4. 在庫との一致率、家族条件、栄養目標で再ランキング
5. 管理画面でレシピ詳細を表示

## 非機能要件

- カメラ映像は原則ローカル処理し、APIへ送るフレームは必要最小限にする。
- 食材認識の根拠と信頼度を保存する。
- レシピ出典と取得元を保存する。
- 家族情報と食材履歴は個人情報として扱う。
- クラウド同期を前提に、端末内SQLiteとクラウドDBの同期境界を分ける。
- 本番では認証、権限、ログ保持期間、データ削除機能を追加する。
