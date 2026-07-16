\# MIRAGE MARKET



\## ハッカソン用MVP実装設計 v0.2



\### Cloudflare Workers / D1 / R2版



\*\*プロジェクト名:\*\* Imaginary Accessory Shop

\*\*サービス名:\*\* MIRAGE MARKET

\*\*タグライン:\*\* Wear What Cannot Exist.

\*\*設計日:\*\* 2026年7月16日

\*\*MVP完成条件:\*\* 空想アクセサリーを生成し、公開ショップで購入し、自分の写真に試着できる。



\---



\# 0. v0.1からの主な変更



| 領域     | v0.1                    | v0.2                             |

| ------ | ----------------------- | -------------------------------- |

| フロント公開 | Firebase Hosting        | Cloudflare Workers Static Assets |

| API    | Cloud Run + Fastify     | Cloudflare Worker + Hono         |

| DB     | Firestore               | Cloudflare D1                    |

| 画像保存   | Firebase Storage        | Cloudflare R2                    |

| 匿名認証   | Firebase Anonymous Auth | 署名付き匿名セッションCookie                |

| デプロイ   | フロントとAPIを分離             | 1プロジェクト、1デプロイ                    |

| API通信  | CORSが必要                 | 同一オリジン、CORS不要                    |

| 購入処理   | Firestore Transaction   | D1 `batch()`                     |

| 写真公開制御 | Storage Rules           | Worker経由の認可                      |

| 画像生成   | APIサーバーで同期              | Workerで同期、商品ごとに独立実行              |



Cloudflare公式のReactテンプレートは、React SPA、Worker API、Viteプラグインを同じプロジェクトに生成する。静的ルートはSPAとして処理し、APIのみWorkerへ流せるため、今回の小型MVPに合っている。



\---



\# 1. MVPのコア体験



\## ショップ作成者



```text

世界観を入力

&#x20; ↓

商品コンセプトを3点生成

&#x20; ↓

商品画像を3点生成

&#x20; ↓

ショップを公開

```



\## 訪問者



```text

公開ショップを訪問

&#x20; ↓

架空通貨Mirageで商品を購入

&#x20; ↓

自分の写真をアップロード

&#x20; ↓

購入したアクセサリーを試着

&#x20; ↓

結果画像を保存

```



\## ハッカソンで最も重要な瞬間



> 現実には存在できない商品が、ユーザー自身の写真に現れる瞬間。



ショップ編集機能より、\*\*試着結果の成功率とデモの安定性を優先する。\*\*



\---



\# 2. 採用技術



| 領域      | 技術                        |

| ------- | ------------------------- |

| フロント    | React + Vite + TypeScript |

| UI      | Tailwind CSS              |

| 画面遷移    | React Router              |

| API     | Cloudflare Workers + Hono |

| DB      | Cloudflare D1             |

| 画像保存    | Cloudflare R2             |

| 匿名セッション | HttpOnly署名Cookie          |

| テキスト生成  | OpenAI Responses API      |

| 商品画像    | OpenAI Image API          |

| 試着画像    | OpenAI Image Edit API     |

| 安全確認    | OpenAI Moderation API     |

| デプロイ    | Cloudflare Workers        |

| ローカル開発  | Cloudflare Vite Plugin    |

| 入力検証    | Zod                       |



Cloudflare Vite Pluginを使うと、ローカルでもWorkersランタイムとBindingのエミュレーションを利用できる。



\---



\# 3. システム構成



```text

ブラウザ

&#x20; │

&#x20; ├─ React SPA

&#x20; │

&#x20; └─ /api/\* リクエスト

&#x20;        ↓

Cloudflare Worker

&#x20; ├─ 匿名セッション認証

&#x20; ├─ 入力検証

&#x20; ├─ OpenAI API呼び出し

&#x20; ├─ D1への保存

&#x20; └─ R2への画像保存

&#x20;        │

&#x20;        ├─ D1

&#x20;        │   ├─ users

&#x20;        │   ├─ sessions

&#x20;        │   ├─ shops

&#x20;        │   ├─ accessories

&#x20;        │   ├─ purchases

&#x20;        │   └─ try\_ons

&#x20;        │

&#x20;        └─ R2

&#x20;            ├─ products/

&#x20;            ├─ try-on-source/

&#x20;            └─ try-on-result/

```



\## 設計方針



\* フロントとAPIを同一ドメインに置く

\* OpenAI APIキーはWorkerのSecretだけに保存する

\* R2バケットは原則非公開

\* 商品画像もWorkerのメディアルートから配信する

\* 元写真は試着成功後に削除する

\* AI処理は商品ごとの独立リクエストにする

\* 1件失敗しても、残りの生成結果を失わない



\---



\# 4. 画面遷移



```text

\[01 トップ]

&#x20;  ↓

\[02 ショップ作成]

&#x20;  ↓

\[03 商品コンセプト確認]

&#x20;  ↓

\[04 商品画像生成]

&#x20;  ↓

\[05 ショッププレビュー]

&#x20;  ↓

\[06 公開ショップ]

&#x20;  ↓

\[07 商品詳細・購入]

&#x20;  ↓

\[08 写真アップロード]

&#x20;  ↓

\[09 試着生成中]

&#x20;  ↓

\[10 試着結果]

```



\---



\## 01. トップ



\### 表示



\* MIRAGE MARKETロゴ

\* `Wear What Cannot Exist.`

\* サービス説明

\* 「ショップを作る」

\* 「サンプルショップを見る」

\* サンプル商品3点



\---



\## 02. ショップ作成



\### 入力項目



\* ショップ名

\* 世界観

\* 雰囲気タグ、最大3個

\* 商品カテゴリ



\### MVPカテゴリ



\* イヤリング

\* ネックレス

\* ヘッドアクセサリー



\### 入力制限



| 項目    | 制限       |

| ----- | -------- |

| ショップ名 | 2〜30文字   |

| 世界観   | 10〜300文字 |

| タグ    | 最大3個     |

| カテゴリ  | 3種類固定    |



\---



\## 03. 商品コンセプト確認



3商品について以下を表示する。



\* 商品名

\* カテゴリ

\* 一言説明

\* 商品の物語

\* 価格

\* 「現実に作れない特徴」



\### 操作



\* テキストを編集

\* 3商品すべてを再生成

\* 商品画像生成へ進む



個別のテキスト再生成はP1とする。



\---



\## 04. 商品画像生成



商品カードごとに独立して生成する。



```text

商品A  \[生成中]

商品B  \[完成]

商品C  \[失敗・再試行]

```



ブラウザから3本のAPIリクエストを並列送信する。各Workerは1枚だけ処理するため、1リクエスト内で3枚の画像を抱え込まない。



\---



\## 05. ショッププレビュー



\### 編集可能



\* ショップ名

\* ショップ説明

\* 商品名

\* 一言説明

\* 価格

\* 商品画像の再生成



\### 編集しない



\* 自由レイアウト

\* フォント選択

\* 商品追加

\* 商品削除

\* 高度な画像編集



\---



\## 06. 公開ショップ



URL形式:



```text

/shops/{shareSlug}

```



表示内容:



\* 店名

\* 世界観

\* 商品3点

\* 販売数

\* 所持Mirage

\* 架空商品であることの表示



注意書き:



> このショップの商品はすべて架空です。現実のお金、商品の製造、配送は発生しません。



\---



\## 07. 商品詳細・購入



表示内容:



\* 大きな商品画像

\* 名前

\* 説明

\* 物語

\* 価格

\* 現在残高

\* 購入後残高



購入後:



```text

購入しました

&#x20; ↓

\[いま身につけてみる]

```



\---



\## 08. 写真アップロード



\### 対応形式



\* JPEG

\* PNG

\* WebP

\* 10MB以下



OpenAIのモデレーションモデルはテキストと画像を扱い、画像上限は20MBだが、MIRAGE MARKET側では通信と保存負荷を抑えるため10MBに制限する。



\### 表示する案内



\* 顔と装着部位が見える写真を推奨

\* 1人だけ写っている写真を推奨

\* 他人の写真は許可なく使用しない

\* 元写真は試着成功後に削除する



\---



\## 09. 試着生成中



表示例:



```text

欠けた月の耳飾りを装着しています



\[✓] 写真を確認

\[✓] 商品を取り出す

\[●] 現実の物理法則を一部解除中

```



\---



\## 10. 試着結果



表示内容:



\* 試着画像

\* 商品名

\* ショップ名

\* 保存

\* 同じ商品でもう一度試す

\* ショップへ戻る



元写真を削除した後の再生成では、再度写真選択を求める。



\---



\# 5. プロジェクト構造



```text

mirage-market/

├─ src/

│  ├─ app/

│  │  ├─ router.tsx

│  │  └─ providers.tsx

│  ├─ pages/

│  │  ├─ HomePage.tsx

│  │  ├─ CreateShopPage.tsx

│  │  ├─ CollectionPage.tsx

│  │  ├─ ShopPreviewPage.tsx

│  │  ├─ PublicShopPage.tsx

│  │  ├─ TryOnPage.tsx

│  │  └─ TryOnResultPage.tsx

│  ├─ components/

│  │  ├─ AccessoryCard.tsx

│  │  ├─ GenerationStatus.tsx

│  │  ├─ PurchaseDialog.tsx

│  │  ├─ PhotoDropzone.tsx

│  │  └─ MirageBalance.tsx

│  ├─ features/

│  │  ├─ shops/

│  │  ├─ accessories/

│  │  ├─ purchases/

│  │  └─ try-ons/

│  ├─ lib/

│  │  ├─ api.ts

│  │  ├─ validation.ts

│  │  └─ image.ts

│  └─ styles/

│

├─ worker/

│  ├─ index.ts

│  ├─ app.ts

│  ├─ env.ts

│  ├─ middleware/

│  │  ├─ session.ts

│  │  ├─ origin-check.ts

│  │  └─ error-handler.ts

│  ├─ routes/

│  │  ├─ session.ts

│  │  ├─ shops.ts

│  │  ├─ accessories.ts

│  │  ├─ purchases.ts

│  │  ├─ try-ons.ts

│  │  └─ media.ts

│  ├─ services/

│  │  ├─ openai-text.ts

│  │  ├─ openai-image.ts

│  │  ├─ moderation.ts

│  │  ├─ sessions.ts

│  │  ├─ r2.ts

│  │  └─ purchases.ts

│  ├─ repositories/

│  │  ├─ users.ts

│  │  ├─ shops.ts

│  │  ├─ accessories.ts

│  │  ├─ purchases.ts

│  │  └─ try-ons.ts

│  ├─ prompts/

│  │  ├─ collection.ts

│  │  ├─ product-image.ts

│  │  └─ try-on.ts

│  └─ schemas/

│     ├─ collection.ts

│     ├─ shop.ts

│     └─ try-on.ts

│

├─ migrations/

│  └─ 0001\_initial.sql

├─ scripts/

│  └─ seed-demo.ts

├─ public/

├─ wrangler.jsonc

├─ vite.config.ts

└─ package.json

```



\---



\# 6. Cloudflare初期設定



\## プロジェクト作成



```bash

npm create cloudflare@latest -- mirage-market --framework=react

cd mirage-market

npm install hono zod

```



この公式テンプレートは`src/`、`worker/index.ts`、`vite.config.ts`、`wrangler.jsonc`を含む構成を生成する。



\## D1作成



```bash

npx wrangler d1 create mirage-market-db

```



\## R2作成



```bash

npx wrangler r2 bucket create mirage-market-images

```



\## Secrets



```bash

npx wrangler secret put OPENAI\_API\_KEY

npx wrangler secret put SESSION\_SECRET

```



`SESSION\_SECRET`は十分に長いランダム文字列とする。



\---



\# 7. wrangler.jsonc



```json

{

&#x20; "$schema": "node\_modules/wrangler/config-schema.json",

&#x20; "name": "mirage-market",

&#x20; "main": "worker/index.ts",

&#x20; "compatibility\_date": "2026-07-16",



&#x20; "assets": {

&#x20;   "not\_found\_handling": "single-page-application"

&#x20; },



&#x20; "d1\_databases": \[

&#x20;   {

&#x20;     "binding": "DB",

&#x20;     "database\_name": "mirage-market-db",

&#x20;     "database\_id": "REPLACE\_WITH\_DATABASE\_ID",

&#x20;     "migrations\_dir": "migrations"

&#x20;   }

&#x20; ],



&#x20; "r2\_buckets": \[

&#x20;   {

&#x20;     "binding": "IMAGES",

&#x20;     "bucket\_name": "mirage-market-images"

&#x20;   }

&#x20; ],



&#x20; "vars": {

&#x20;   "APP\_ENV": "production",

&#x20;   "OPENAI\_TEXT\_MODEL": "gpt-5.6",

&#x20;   "OPENAI\_IMAGE\_MODEL": "gpt-image-2",

&#x20;   "MAX\_SHOPS\_PER\_USER": "3",

&#x20;   "MAX\_IMAGE\_RETRIES": "2",

&#x20;   "MAX\_TRY\_ONS\_PER\_DAY": "3"

&#x20; },



&#x20; "observability": {

&#x20;   "enabled": true

&#x20; }

}

```



OpenAIの現行モデルガイドでは、`gpt-5.6`がフラッグシップ用のエイリアスとして案内されている。



OpenAI呼び出しはSDKではなく標準の`fetch()`で実装する。これにより、初期MVPでは`nodejs\_compat`を不要にする。



\---



\# 8. D1スキーマ



\## migrations/0001\_initial.sql



```sql

PRAGMA foreign\_keys = ON;



CREATE TABLE users (

&#x20; id TEXT PRIMARY KEY,

&#x20; display\_name TEXT NOT NULL DEFAULT 'Mirage Visitor',

&#x20; balance INTEGER NOT NULL DEFAULT 1000 CHECK (balance >= 0),

&#x20; created\_at INTEGER NOT NULL DEFAULT (unixepoch()),

&#x20; updated\_at INTEGER NOT NULL DEFAULT (unixepoch())

);



CREATE TABLE sessions (

&#x20; id TEXT PRIMARY KEY,

&#x20; user\_id TEXT NOT NULL,

&#x20; expires\_at INTEGER NOT NULL,

&#x20; created\_at INTEGER NOT NULL DEFAULT (unixepoch()),

&#x20; FOREIGN KEY (user\_id) REFERENCES users(id) ON DELETE CASCADE

);



CREATE TABLE shops (

&#x20; id TEXT PRIMARY KEY,

&#x20; owner\_user\_id TEXT NOT NULL,

&#x20; name TEXT NOT NULL,

&#x20; description TEXT NOT NULL,

&#x20; theme\_prompt TEXT NOT NULL,

&#x20; mood\_tags\_json TEXT NOT NULL DEFAULT '\[]',

&#x20; share\_slug TEXT UNIQUE,

&#x20; status TEXT NOT NULL DEFAULT 'draft'

&#x20;   CHECK (status IN ('draft', 'published')),

&#x20; sales\_count INTEGER NOT NULL DEFAULT 0,

&#x20; created\_at INTEGER NOT NULL DEFAULT (unixepoch()),

&#x20; updated\_at INTEGER NOT NULL DEFAULT (unixepoch()),

&#x20; published\_at INTEGER,

&#x20; FOREIGN KEY (owner\_user\_id) REFERENCES users(id)

);



CREATE TABLE accessories (

&#x20; id TEXT PRIMARY KEY,

&#x20; shop\_id TEXT NOT NULL,

&#x20; name TEXT NOT NULL,

&#x20; category TEXT NOT NULL

&#x20;   CHECK (category IN ('earrings', 'necklace', 'headpiece')),

&#x20; short\_description TEXT NOT NULL,

&#x20; lore TEXT NOT NULL,

&#x20; impossible\_feature TEXT NOT NULL,

&#x20; price INTEGER NOT NULL CHECK (price BETWEEN 100 AND 1000),

&#x20; image\_prompt TEXT NOT NULL,

&#x20; placement\_instruction TEXT NOT NULL,

&#x20; image\_r2\_key TEXT,

&#x20; generation\_status TEXT NOT NULL DEFAULT 'pending'

&#x20;   CHECK (

&#x20;     generation\_status IN

&#x20;     ('pending', 'generating', 'completed', 'failed')

&#x20;   ),

&#x20; generation\_attempts INTEGER NOT NULL DEFAULT 0,

&#x20; sort\_order INTEGER NOT NULL,

&#x20; created\_at INTEGER NOT NULL DEFAULT (unixepoch()),

&#x20; updated\_at INTEGER NOT NULL DEFAULT (unixepoch()),

&#x20; FOREIGN KEY (shop\_id) REFERENCES shops(id) ON DELETE CASCADE

);



CREATE TABLE purchases (

&#x20; id TEXT PRIMARY KEY,

&#x20; buyer\_user\_id TEXT NOT NULL,

&#x20; shop\_id TEXT NOT NULL,

&#x20; accessory\_id TEXT NOT NULL,

&#x20; accessory\_name\_snapshot TEXT NOT NULL,

&#x20; price\_snapshot INTEGER NOT NULL,

&#x20; created\_at INTEGER NOT NULL DEFAULT (unixepoch()),

&#x20; FOREIGN KEY (buyer\_user\_id) REFERENCES users(id),

&#x20; FOREIGN KEY (shop\_id) REFERENCES shops(id),

&#x20; FOREIGN KEY (accessory\_id) REFERENCES accessories(id),

&#x20; UNIQUE (buyer\_user\_id, accessory\_id)

);



CREATE TABLE try\_ons (

&#x20; id TEXT PRIMARY KEY,

&#x20; user\_id TEXT NOT NULL,

&#x20; accessory\_id TEXT NOT NULL,

&#x20; source\_r2\_key TEXT,

&#x20; result\_r2\_key TEXT,

&#x20; status TEXT NOT NULL DEFAULT 'uploaded'

&#x20;   CHECK (

&#x20;     status IN

&#x20;     ('uploaded', 'moderating', 'generating', 'completed', 'failed')

&#x20;   ),

&#x20; error\_code TEXT,

&#x20; generation\_attempts INTEGER NOT NULL DEFAULT 0,

&#x20; source\_deleted\_at INTEGER,

&#x20; created\_at INTEGER NOT NULL DEFAULT (unixepoch()),

&#x20; completed\_at INTEGER,

&#x20; FOREIGN KEY (user\_id) REFERENCES users(id),

&#x20; FOREIGN KEY (accessory\_id) REFERENCES accessories(id)

);



CREATE INDEX idx\_sessions\_user ON sessions(user\_id);

CREATE INDEX idx\_sessions\_expiry ON sessions(expires\_at);

CREATE INDEX idx\_shops\_owner ON shops(owner\_user\_id);

CREATE INDEX idx\_shops\_slug ON shops(share\_slug);

CREATE INDEX idx\_accessories\_shop ON accessories(shop\_id);

CREATE INDEX idx\_purchases\_buyer ON purchases(buyer\_user\_id);

CREATE INDEX idx\_try\_ons\_user ON try\_ons(user\_id);

```



D1はSQLiteのクエリエンジンとSQLセマンティクスを利用し、Worker BindingからPrepared Statementで操作できる。



\---



\# 9. 匿名セッション



\## Cookie形式



```text

\_\_Host-mm\_session={sessionId}.{signature}

```



\## Cookie属性



```text

HttpOnly

Secure

SameSite=Lax

Path=/

Max-Age=2592000

```



\## 初回アクセス



```text

1\. Cookieが存在しない

2\. userIdとsessionIdをcrypto.randomUUID()で生成

3\. usersへ初期残高1000で登録

4\. sessionsへ登録

5\. sessionIdをHMAC-SHA256で署名

6\. Cookieを返す

```



\## 毎リクエスト



```text

1\. Cookieを分割

2\. SESSION\_SECRETで署名を再計算

3\. 署名を検証

4\. sessionsの期限を確認

5\. userIdをHono Contextへ格納

```



\## セキュリティ



状態を変更するPOST、PATCH、DELETEでは、次を確認する。



\* セッションCookie

\* `Origin`が自サービスと一致

\* `Content-Type`

\* Zodによる入力検証

\* 所有者IDまたは購入履歴



本格的なGoogleログインはMVP後とする。



\---



\# 10. R2画像設計



\## キー構造



```text

products/{shopId}/{accessoryId}.webp



try-on-source/{userId}/{tryOnId}/source.jpg



try-on-result/{userId}/{tryOnId}/result.webp



share/{tryOnId}.webp

```



\## 公開範囲



| 種類    |        公開 | 配信方法         |

| ----- | --------: | ------------ |

| 商品画像  |         可 | Worker経由     |

| 元写真   |        不可 | Worker内部のみ   |

| 試着結果  |      本人のみ | 認証済みWorker経由 |

| シェア画像 | ユーザー操作後のみ | 公開Worker経由   |



R2はWorker Bindingから`put()`、`get()`、`delete()`で操作でき、認可ロジックをWorker側へ置ける。



\## アップロード方法



ブラウザからWorkerへ`multipart/form-data`で送信し、WorkerからR2へ保存する。



10MBの写真を何度も`arrayBuffer()`へ展開せず、可能な箇所はStreamのままR2へ渡す。Workersのメモリ制限を踏まえ、大きな画像を複製しない。



\## 元写真削除



```text

試着成功

&#x20; ↓

結果画像をR2へ保存

&#x20; ↓

try\_onsをcompletedへ更新

&#x20; ↓

元写真をR2から削除

&#x20; ↓

source\_r2\_keyをNULLへ更新

```



生成失敗時は再試行のため一時的に保持し、24時間後の削除処理はMVP後に追加する。



\---



\# 11. API一覧



| Method | Endpoint                     | 用途          |

| ------ | ---------------------------- | ----------- |

| POST   | `/api/session/bootstrap`     | 匿名ユーザー作成    |

| GET    | `/api/me`                    | 残高・ユーザー情報   |

| POST   | `/api/shops/generate`        | 店と商品案を生成    |

| GET    | `/api/shops/:id/draft`       | 自分の下書き取得    |

| PATCH  | `/api/shops/:id`             | ショップ編集      |

| POST   | `/api/accessories/:id/image` | 商品画像生成      |

| POST   | `/api/shops/:id/publish`     | ショップ公開      |

| GET    | `/api/public/shops/:slug`    | 公開ショップ取得    |

| POST   | `/api/purchases`             | 商品購入        |

| GET    | `/api/purchases`             | 自分の購入品      |

| POST   | `/api/try-ons`               | 写真アップロードと試着 |

| GET    | `/api/try-ons/:id`           | 試着結果取得      |

| DELETE | `/api/try-ons/:id`           | 試着結果削除      |

| GET    | `/media/products/\*`          | 商品画像        |

| GET    | `/media/try-ons/\*`           | 本人用試着画像     |



\---



\# 12. 商品コンセプト生成



\## Endpoint



```text

POST /api/shops/generate

```



\## Request



```json

{

&#x20; "shopName": "月裏感情装具店",

&#x20; "theme": "月の裏側で、失くした気持ちを装具に変える店",

&#x20; "moodTags": \["幻想的", "切ない", "宇宙"],

&#x20; "categories": \["earrings", "necklace", "headpiece"]

}

```



\## Response



```json

{

&#x20; "shop": {

&#x20;   "id": "shop\_xxx",

&#x20;   "name": "月裏感情装具店",

&#x20;   "description": "失くした気持ちを、身につけられる形に。"

&#x20; },

&#x20; "accessories": \[

&#x20;   {

&#x20;     "id": "acc\_xxx",

&#x20;     "name": "欠けた月の耳飾り",

&#x20;     "category": "earrings",

&#x20;     "shortDescription": "思い出すたび、片方だけ光る。",

&#x20;     "lore": "月の裏側に落ちた記憶から作られた耳飾り。",

&#x20;     "impossibleFeature": "小さな月が耳の周囲を公転する",

&#x20;     "price": 300,

&#x20;     "generationStatus": "pending"

&#x20;   }

&#x20; ]

}

```



\## OpenAI利用



\* Responses API

\* モデル: `gpt-5.6`

\* Structured Outputs

\* JSON Schema

\* `strict: true`



Structured Outputsは、JSON Schemaへ準拠した応答を`strict: true`で要求できる。



\## 生成ルール



各商品は必ず次を満たす。



1\. 身につける部位が明確

2\. 一目でアクセサリーと分かる

3\. 現実には不可能な特徴を1つ以上持つ

4\. 3商品で不可能性が重複しない

5\. 実在ブランドを含まない

6\. 既存キャラクターを含まない

7\. 一般向けとして安全

8\. 価格は200〜500 Mirage



\---



\# 13. 商品画像生成



\## Endpoint



```text

POST /api/accessories/:id/image

```



\## 処理



```text

1\. 商品所有者を確認

2\. 再生成回数を確認

3\. generation\_statusをgeneratingへ変更

4\. OpenAI Image APIを呼ぶ

5\. Base64画像をデコード

6\. R2へ保存

7\. image\_r2\_keyを更新

8\. generation\_statusをcompletedへ変更

```



\## 推奨設定



```json

{

&#x20; "model": "gpt-image-2",

&#x20; "size": "1024x1024",

&#x20; "quality": "medium",

&#x20; "output\_format": "webp",

&#x20; "output\_compression": 85

}

```



`gpt-image-2`は現行のGPT Imageモデルとして画像生成と編集に対応し、サイズ、品質、出力形式、圧縮を指定できる。WebP出力も利用できる。一方、透明背景には現時点で対応していない。



\## 商品画像プロンプト



```text

Create a premium product photograph of a fictional wearable accessory.



Product name:

欠けた月の耳飾り



Category:

A matching pair of earrings.



Visual concept:

Miniature crescent moons orbit around each earring.

The moons float without visible supports.



Requirements:

\- the item must clearly read as wearable jewelry

\- show the complete pair

\- centered product composition

\- dark neutral background

\- no person

\- no hands

\- no packaging

\- no logos

\- no written text

\- physically impossible but visually believable

\- suitable as a reference image for virtual try-on

```



\## 失敗処理



| エラー                | 処理              |

| ------------------ | --------------- |

| 429                | 数秒後に1回だけ再試行     |

| 5xx                | 1回だけ再試行         |

| moderation\_blocked | 自動再試行しない        |

| タイムアウト             | failedとして再試行ボタン |

| 画像不正               | failedとしてログ保存   |



OpenAIは一時的な429や5xxでは再試行が適切だが、ユーザー入力由来の画像生成エラーでは入力変更なしの自動再試行を避けるよう案内している。



\---



\# 14. 架空通貨購入



\## Endpoint



```text

POST /api/purchases

```



\## Request



```json

{

&#x20; "accessoryId": "acc\_xxx"

}

```



\## D1処理



購入IDを冪等性キーとして使う。



```ts

const purchaseId = crypto.randomUUID();



await env.DB.batch(\[

&#x20; env.DB.prepare(`

&#x20;   INSERT OR IGNORE INTO purchases (

&#x20;     id,

&#x20;     buyer\_user\_id,

&#x20;     shop\_id,

&#x20;     accessory\_id,

&#x20;     accessory\_name\_snapshot,

&#x20;     price\_snapshot

&#x20;   )

&#x20;   SELECT

&#x20;     ?,

&#x20;     ?,

&#x20;     a.shop\_id,

&#x20;     a.id,

&#x20;     a.name,

&#x20;     a.price

&#x20;   FROM accessories a

&#x20;   JOIN users u ON u.id = ?

&#x20;   WHERE a.id = ?

&#x20;     AND u.balance >= a.price

&#x20; `).bind(

&#x20;   purchaseId,

&#x20;   userId,

&#x20;   userId,

&#x20;   accessoryId

&#x20; ),



&#x20; env.DB.prepare(`

&#x20;   UPDATE users

&#x20;   SET

&#x20;     balance = balance - (

&#x20;       SELECT price\_snapshot

&#x20;       FROM purchases

&#x20;       WHERE id = ?

&#x20;     ),

&#x20;     updated\_at = unixepoch()

&#x20;   WHERE id = ?

&#x20;     AND EXISTS (

&#x20;       SELECT 1

&#x20;       FROM purchases

&#x20;       WHERE id = ?

&#x20;     )

&#x20; `).bind(

&#x20;   purchaseId,

&#x20;   userId,

&#x20;   purchaseId

&#x20; ),



&#x20; env.DB.prepare(`

&#x20;   UPDATE shops

&#x20;   SET sales\_count = sales\_count + 1

&#x20;   WHERE id = (

&#x20;     SELECT shop\_id

&#x20;     FROM purchases

&#x20;     WHERE id = ?

&#x20;   )

&#x20; `).bind(purchaseId),



&#x20; env.DB.prepare(`

&#x20;   SELECT balance

&#x20;   FROM users

&#x20;   WHERE id = ?

&#x20; `).bind(userId)

]);

```



D1の`batch()`はSQLトランザクションとして実行され、途中のステートメントが失敗した場合はシーケンス全体がロールバックされる。



\## 二重購入対策



```sql

UNIQUE (buyer\_user\_id, accessory\_id)

```



同じ商品を何度も買う体験はMVPでは不要とする。



\---



\# 15. 試着処理



\## Endpoint



```text

POST /api/try-ons

Content-Type: multipart/form-data

```



\## FormData



```text

accessoryId

photo

```



\## 処理フロー



```text

1\. セッションを確認

2\. 購入履歴を確認

3\. ファイル形式と容量を確認

4\. 元写真をR2へ非公開保存

5\. try\_onsレコードを作成

6\. 写真をModeration APIへ送信

7\. 商品画像と人物写真をR2から取得

8\. OpenAI Image Edit APIを呼ぶ

9\. 試着結果をR2へ保存

10\. 元写真を削除

11\. completedへ更新

12\. 結果IDを返す

```



\## 試着画像設定



```json

{

&#x20; "model": "gpt-image-2",

&#x20; "size": "1024x1536",

&#x20; "quality": "medium",

&#x20; "output\_format": "webp",

&#x20; "output\_compression": 88

}

```



`gpt-image-2`は編集時に複数の入力画像を扱え、入力画像を自動的に高忠実度で処理する。ただし、人物の同一性や細部が完全に固定される保証はない。



\## 試着プロンプト



```text

Edit the first image by adding the fictional accessory

shown in the second reference image.



Accessory:

欠けた月の耳飾り



Placement:

Attach one matching earring naturally to each visible ear.

The miniature moons should float gently around the ears.



Preserve the first image:

\- preserve the person's identity

\- preserve facial features

\- preserve expression

\- preserve skin tone

\- preserve hairstyle

\- preserve clothing

\- preserve body shape

\- preserve the background

\- preserve the original camera angle

\- preserve the original lighting



Do not:

\- beautify the person

\- change age

\- change gender presentation

\- add makeup

\- add other jewelry

\- replace clothing

\- add text or logos



The result should look like the same person is genuinely

wearing an impossible accessory.

```



\---



\# 16. AI処理の待ち時間設計



画像生成は複雑な場合、最大2分程度かかることがある。



Cloudflare WorkersのHTTPリクエストには、クライアントが接続を維持している間、ハードな実行時間上限はない。ネットワーク待機を含むWall TimeとCPU Timeは別に扱われる。



そのためMVPでは、次の単純構成を採用する。



```text

ブラウザがPOST

&#x20; ↓

WorkerがOpenAI応答を待つ

&#x20; ↓

R2とD1へ保存

&#x20; ↓

結果を返す

```



\## ブラウザ側



\* AbortControllerの上限を150秒

\* 生成中は画面遷移警告

\* ボタン連打を無効化

\* 失敗時は再試行

\* 商品画像3点は別リクエスト



\## Worker側



API呼び出し前にD1へ`generating`を保存する。



Workerが途中で切断された場合でも、次回アクセス時に古い`generating`状態を検出し、`failed`へ戻せる。



\## MVP後



アクセス増加後は、画像生成処理をCloudflare WorkflowsまたはQueuesへ移す。MVPではCloudflare部品を増やしすぎない。



\---



\# 17. 安全性とプライバシー



\## テキスト



以下をModeration APIへ送る。



\* 店名

\* 世界観

\* 商品追加指示



\## 画像



以下をModeration APIへ送る。



\* 試着元写真

\* 必要に応じて公開予定の試着結果



`omni-moderation-latest`はテキストと画像入力に対応する。



\## ユーザー表示



拒否理由の詳細分類は直接表示せず、次のようにする。



> この内容では生成できませんでした。表現または画像を変更して、もう一度お試しください。



\## 写真



\* 元写真は公開しない

\* R2の公開バケットを使用しない

\* 成功後に元写真を削除

\* 結果画像も本人のみ閲覧可能

\* シェア操作時だけ公開コピーを作る

\* ログへ画像本体やBase64を出さない



\---



\# 18. 費用暴走防止



\## MVP上限



| 操作         |       上限 |

| ---------- | -------: |

| 1ユーザーのショップ |       3店 |

| 1店の商品      |      3商品 |

| 商品画像の再生成   |      各2回 |

| 1日の試着      |       3回 |

| 写真容量       |     10MB |

| 同時生成       | 商品画像3本まで |



\## Worker側で必ず確認する



\* ブラウザ表示だけで制限しない

\* D1上の回数を確認する

\* OpenAI API呼び出し直前に再確認

\* 所有者または購入者であることを確認



\## 公開後の追加候補



\* Cloudflare Turnstile

\* IP単位レート制限

\* 管理者用の生成停止フラグ

\* 1日総生成回数の上限



\---



\# 19. Day 1 / Day 2 / Day 3



\## Day 1



\### 世界観が商品データになるまで



1\. Cloudflare Reactプロジェクト作成

2\. Hono API構築

3\. D1とR2のBinding

4\. マイグレーション実行

5\. 匿名セッション

6\. ショップ作成フォーム

7\. Responses API接続

8\. 商品コンセプト3点生成

9\. D1へ下書き保存



\### Day 1完了条件



> 世界観を入力すると、商品名、説明、価格、物語を持つ3商品が表示される。



\---



\## Day 2



\### 商品画像とショップ公開



1\. 商品画像生成API

2\. R2保存

3\. 個別生成ステータス

4\. 個別再試行

5\. ショッププレビュー

6\. シェアSlug生成

7\. 公開ショップページ

8\. Mirage残高表示

9\. D1購入処理

10\. 購入完了画面



\### Day 2完了条件



> シークレットウィンドウからショップを訪問し、商品をMirageで購入できる。



\---



\## Day 3



\### 写真への試着とデモ安定化



1\. 写真アップロードUI

2\. ファイル検証

3\. 非公開R2保存

4\. 画像モデレーション

5\. Image Edit API

6\. 試着結果保存

7\. 元写真削除

8\. 結果表示

9\. 保存機能

10\. スマホ表示調整

11\. エラー表示

12\. デモ用サンプルデータ

13\. デモ動画収録



\### Day 3完了条件



> 購入した空想アクセサリーを、自分の写真に装着できる。



\---



\# 20. 実装優先順位



\## P0



\* 匿名セッション

\* ショップ作成

\* 商品案3点生成

\* 商品画像生成

\* ショップ公開

\* 架空通貨購入

\* 写真アップロード

\* 試着生成

\* 結果表示



\## P1



\* 商品画像の個別再生成

\* 試着画像保存

\* 販売数表示

\* シェア画像

\* Turnstile

\* 写真適性判定



\## P2



\* AI店主

\* 店舗デザイン選択

\* コレクション一覧

\* お気に入り

\* コメント

\* 店同士のコラボ

\* Googleログイン

\* Cloudflare Workflows化



\---



\# 21. デモ用プレゼン原稿



\## 0:00〜0:20



「アクセサリーを作るには、材料、技術、お金、そして物理法則が必要です。」



「でも、想像することには、そのどれも必要ありません。」



「MIRAGE MARKETは、現実には作れないアクセサリーを作り、売り、買い、身につけられる空想のマーケットです。」



\---



\## 0:20〜0:50



ショップ作成画面へ入力する。



```text

月裏感情装具店



月の裏側で、

失くした気持ちを

アクセサリーに変えて売る店

```



「商品の形ではなく、まず店の世界観を入力します。」



生成する。



\---



\## 0:50〜1:20



3商品を表示する。



「AIが世界観から、商品名、物語、値段、商品画像を作ります。」



「こちらは『欠けた月の耳飾り』。小さな月が耳の周囲を公転します。」



「この市場では、現実に作れないことが商品の魅力になります。」



\---



\## 1:20〜1:45



公開ショップを別ユーザーで開き、購入する。



「訪問者は、現実のお金ではなく、架空通貨Mirageで商品を購入します。」



「買うのは物体ではありません。商品の物語と、それを身につけた自分の姿です。」



\---



\## 1:45〜2:15



写真を選択し、試着結果を表示する。



結果表示後、1〜2秒止める。



「現実には製造できなくても、身につけた自分を見ることはできます。」



\---



\## 2:15〜2:35



「実物を作る技術がなくても、商品を買うお金がなくても、誰もがデザイナー、店主、コレクターになれます。」



「MIRAGE MARKETは、想像したものに、居場所と値札と持ち主を与える場所です。」



「Wear What Cannot Exist.」



\---



\# 22. デモ耐久策



\## 必ず準備するもの



\* 生成済みショップ

\* 購入済み匿名セッション

\* 試着成功済み画像

\* 30秒程度の録画

\* デモ写真2枚

\* 商品画像3点

\* OpenAI API残高確認

\* Cloudflare本番URL確認



\## デモ中に生成が長引いた場合



> 画像生成には少し時間がかかるため、同じ入力から事前に生成した結果へ切り替えます。



生成済みショップへ移動し、そのまま物語を続ける。



\---



\# 23. 最終受け入れ条件



\## ショップ



\* \[ ] 世界観を入力できる

\* \[ ] 3商品のJSONが生成される

\* \[ ] 3商品をD1へ保存できる

\* \[ ] 商品画像を個別生成できる

\* \[ ] 公開Slugが発行される

\* \[ ] 別ブラウザで閲覧できる



\## 購入



\* \[ ] 初期残高が1000 Mirage

\* \[ ] 購入後に残高が減る

\* \[ ] 残高不足では購入できない

\* \[ ] 二重購入できない

\* \[ ] リロード後も購入履歴が残る



\## 試着



\* \[ ] 購入商品だけ試着できる

\* \[ ] 写真が公開URLにならない

\* \[ ] 10MB超を拒否する

\* \[ ] 商品が指定部位へ現れる

\* \[ ] 結果画像を本人が閲覧できる

\* \[ ] 成功後に元写真が削除される

\* \[ ] 失敗時にやり直せる



\## セキュリティ



\* \[ ] OpenAI APIキーがフロントにない

\* \[ ] R2バケットが直接公開されていない

\* \[ ] 他人の下書きを取得できない

\* \[ ] 他人の試着画像を取得できない

\* \[ ] 状態変更APIでOriginを確認する



\---



\# 24. v0.2の最終判断



Cloudflare版では、MIRAGE MARKETに必要なものを次の4層へ収める。



```text

Workers

&#x20; アプリとAPI



D1

&#x20; 店、商品、購入、残高



R2

&#x20; 商品画像、人物写真、試着結果



OpenAI API

&#x20; 世界観、商品、画像、試着

```



Cloudflareらしい機能を数多く使うこと自体は目的にしない。



ハッカソンで見せるべきものは、



> 「Cloudflareを使いました」ではなく、

> 「存在しないアクセサリーが、自分の身体に現れました」



という瞬間である。
