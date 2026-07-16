# MIRAGE MARKET

> Wear What Cannot Exist.

MIRAGE MARKET は、現実には作れないアクセサリーを世界観から生成し、架空通貨で購入し、自分の写真へ試着できる空想のマーケットです。

OpenAI Build Week 2026 の **Apps for your life** トラック向けMVPです。

## 体験

1. 店名、世界観、雰囲気を入力する
2. GPT-5.6 が3つの架空アクセサリーを構造化生成する
3. GPT Image 2 が商品画像を個別生成する
4. ショップを公開し、別の匿名ユーザーが Mirage で購入する
5. 購入品を自分の写真へ GPT Image 2 で試着する

現実のお金、商品の製造、配送は発生しません。

## 技術構成

- React 19 + Vite + TypeScript
- Cloudflare Workers + Hono
- Cloudflare D1（ユーザー、セッション、ショップ、商品、購入、試着）
- Cloudflare R2（商品画像、非公開の元写真、試着結果）
- OpenAI Responses API (`gpt-5.6`)
- OpenAI Image API (`gpt-image-2`)
- OpenAI Moderation API (`omni-moderation-latest`)
- Zod による入力検証

フロントとAPIは同一Workerへデプロイされます。OpenAI APIキーはWorker環境だけに置き、ブラウザへ渡しません。

## ローカル起動

必要環境: Node.js 20以降、npm

```bash
npm install
npm run db:migrate:local
npm run dev
```

表示されたローカルURLを開きます。ポートを固定する場合:

```bash
npm run dev -- --port 4179
```

### OpenAI APIキー

ローカルでは、Git管理外の `.env.local` に設定します。

```dotenv
OPENAI_API_KEY=your_key_here
```

キーが未設定、レート制限中、またはローカルで請求上限に達している場合は、審査・UI確認を止めないためサンプル商品とデモ画像へフォールバックします。`APP_ENV=production` では Moderation API の障害を安全側に失敗させます。

## Cloudflareへデプロイ

1. D1 と R2 を作成します。

```bash
npx wrangler d1 create mirage-market-db
npx wrangler r2 bucket create mirage-market-images
```

2. `wrangler.jsonc` の `database_id` を発行された値へ変更します。
3. マイグレーションを適用します。

```bash
npx wrangler d1 migrations apply mirage-market-db --remote
```

4. Secrets を登録します。

```bash
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put SESSION_SECRET
```

5. `wrangler.jsonc` の `APP_ENV` を `production` に変更し、デプロイします。

```bash
npm run deploy
```

## 検証

```bash
npm run typecheck
npm test
npm run build
```

ローカルD1/R2を使ったブラウザ確認では、以下を通過しています。

- 匿名セッションと初期残高 1,000 Mirage
- 世界観から3商品を生成・D1保存
- 商品ごとの独立画像生成・R2保存・再試行
- 公開Slug発行と公開ショップ表示
- 購入後の残高減算（1,000 → 700）
- 購入者だけに写真アップロードUIを表示

## プライバシーと安全性

- 元写真は公開URLを持たないR2キーへ保存
- JPEG / PNG / WebP、10MB以下だけを許可
- 購入履歴があるユーザーだけ試着可能
- 画像モデレーション後に試着生成
- 成功後に元写真を削除し、試着結果は本人セッションだけに配信
- Base64画像やAPIキーをログへ出さない
- 状態変更APIでOriginを検証
- 商品画像は最大3回、試着は1日3回まで

## Codexを使った開発

CodexにMVP設計書を渡し、次の作業を一つの開発セッションで進めました。

- Cloudflare統合アーキテクチャの実装
- D1スキーマ、Hono API、R2メディア認可
- OpenAIの構造化出力・画像生成・画像編集・Moderation連携
- Reactの作成、公開、購入、試着フロー
- 型検査、単体テスト、ビルド、ローカルD1マイグレーション
- Playwrightによる実ブラウザ操作と視覚確認
- 実APIの429・請求上限を発見し、デモを止めない診断可能なフォールバックを追加

設計上の中心は、Cloudflareの部品数を増やすことではなく、**存在しないアクセサリーが自分の身体に現れる瞬間を安定して見せること**です。

## 現在の制約

- ローカルのデモ画像はフォールバック用のSVGです。OpenAI利用枠を有効にするとGPT Image 2へ切り替わります。
- 試着の人物同一性や細部は生成モデルの出力に依存します。
- 24時間経過した失敗元写真の定期削除、Turnstile、総量レート制限はMVP後の候補です。

## License

[MIT](./LICENSE)
