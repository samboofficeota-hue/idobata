# サービス構造の全体像（現状）

> 2026年4月のGoogle Cloud撤退（Cloud Run → Vercel / Railway 移行）完了後の構成を記述したものです。セットアップ手順は含みません。

## 概要

本プロジェクトは以下のサービス・リポジトリで構成されています。

| コンポーネント | ホスティング先 | 役割 |
|---|---|---|
| frontend（利用者向けサイト） | Vercel | 一般利用者向けUI（React/Vite SPA） |
| admin（管理画面） | Vercel | 運営者向け管理UI（React/Vite SPA） |
| idea-discussion/backend | Railway | メインAPIサーバー（Node.js/Express） |
| python-service | Railway | 埋め込み生成・クラスタリング用サービス（FastAPI） |
| MongoDB | Railway（Volume付きサービス） | メインデータストア |
| policy-edit（backend/frontend/mcp） | 未デプロイ（ローカルのみ） | GitHub連携ポリシー編集機能。本番稼働はしていない |

GitHubリポジトリ: `samboofficeota-hue/idobata`（`main`ブランチ = 本番相当）

## アーキテクチャ図

```
┌───────────────────────────────────────────────────────────┐
│                          GitHub                             │
│  samboofficeota-hue/idobata (main)                          │
└───────────────────────────────────────────────────────────┘
        │ push                          │ push
        ▼                               ▼
┌─────────────────────┐        ┌──────────────────────────┐
│   Vercel             │        │   Railway                 │
│  ・frontend          │◀──────▶│  ・idea-discussion/backend │
│  ・admin              │  REST  │    (Node.js/Express + WS) │
│    （各々独立デプロイ）│  /Socket.IO│  ・python-service          │
└─────────────────────┘        │    (FastAPI, 埋め込み/分析)│
                                 │  ・MongoDB（Volume）       │
                                 └──────────────────────────┘
                                              │
                                              ▼
                                 ┌──────────────────────────┐
                                 │ 外部AI API                │
                                 │ ・Anthropic API (Claude)  │
                                 │ ・OpenAI API              │
                                 └──────────────────────────┘
```

## 各コンポーネントの詳細

### 1. frontend（Vercel）

- Vite + React のSPA。`frontend/vercel.json` でSPAルーティング（全パスを`index.html`に書き換え）を設定。
- APIとの通信先はビルド時環境変数 `VITE_API_BASE_URL` でRailway上のbackendを指す。
- サーバレス（Vercelのグローバルエッジ配信）のため、専用の常時稼働サーバーは存在しない。

### 2. admin（Vercel）

- frontendと同様にVite + ReactのSPA。運営者向け機能（テーマ管理、質問生成、意見サマリー編集など）を提供。
- 同じRailway backendに `VITE_API_BASE_URL` 経由で接続。テーマ削除許可などの管理者向けフラグ（`VITE_ALLOW_DELETE_THEME`）を持つ。

### 3. idea-discussion/backend（Railway）

- Node.js（Express 5）+ Socket.IO によるメインAPIサーバー。1プロセスで以下を兼務：
  - REST API（`/api/themes`, `/api/auth`, `/api/questions` 等、多数のルート）
  - Socket.IOによるリアルタイム通信（チャット等）
  - `node-cron` による日次バッチ処理（`dailyBatchProcessor`、`BATCH_SCHEDULE`で制御）
- 認証はJWT（`JWT_SECRET`, `JWT_EXPIRES_IN`）+ bcrypt、パスワードには`PASSWORD_PEPPER`を付加。
- LLM呼び出しは `services/llmService.js` が担い、Anthropic API（`@anthropic-ai/sdk`、既定モデル `claude-sonnet-4-6`）を使用。`ANTHROPIC_API_KEY`未設定時はエラーを返す設計。OpenAI SDKも依存関係に含まれる（`OPENAI_API_KEY`）。
- MongoDBへは Mongoose 経由で接続。接続オプションはコード内で明示的に設定：
  - `maxPoolSize: 10` / `minPoolSize: 2`（同時接続コネクションプール）
  - `connectTimeoutMS: 30000`、`serverSelectionTimeoutMS: 10000`、`socketTimeoutMS: 45000`
  - `maxIdleTimeMS: 60000`、`heartbeatFrequencyMS: 10000`
  - これらはCloud Run時代に最適化されたままの値で、Railway移行後も変更されていない。
- CORS許可オリジンは `IDEA_CORS_ORIGIN`（カンマ区切り）で制御。コード内のフォールバック値にはCloud Run時代のURLが残っているが、実運用は環境変数側（Vercel本番URL）で上書きされている。
- コンテナは`node:20-alpine`ベース。ポートはRailwayが注入する`PORT`（`server.js`は`process.env.PORT || 3000`）。ヘルスチェックは`/api/health`。
- 主要環境変数: `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PASSWORD_PEPPER`, `IDEA_CORS_ORIGIN`, `PYTHON_SERVICE_URL`, `API_BASE_URL`, `ALLOW_DELETE_THEME`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `BATCH_SCHEDULE`

### 4. python-service（Railway / FastAPI）

- 役割：意見・課題文の埋め込み生成（OpenAI Embeddings API）とクラスタリング（scikit-learn: KMeans / Agglomerative）。
- ベクトルストアとして **ChromaDB** をローカルパーシステントモードで使用（`/data/chroma`、Railway Volumeにマウント）。コレクション名 `problems_solutions`。
- backendの`PYTHON_SERVICE_URL`経由で idea-discussion/backend から呼び出される内部サービス（利用者から直接は叩かれない想定）。
- ヘルスチェック `/health`。CORSは現状 `allow_origins=["*"]`（全許可）。

### 5. MongoDB（Railway）

- Railwayの `idobata-backend` プロジェクト内でVolume付きサービスとして稼働（Atlasではなく自前ホスト、イメージ`mongo:8.0`。ダッシュボード上でマイナーアップデート`8.3.7`が提供されているが未適用）。
- backendから`MONGODB_URI`で接続。ユーザー・テーマ・質問・意見・ポリシードラフト等のデータを格納。

### 6. policy-edit（未稼働）

- GitHubリポジトリブラウジング＋MCPベースのチャットボットによるポリシー編集機能一式（backend: Express + Drizzle ORM + PostgreSQL、frontend、MCPサーバー）がリポジトリ内には存在するが、**現時点でRailwayへのデプロイは完了していない**。
- 理由：DockerfileがリポジトリルートをビルドコンテキストとするためRailwayの自動検出と相性が悪く、対応が保留中。
- PostgreSQL自体はRailway上に追加済みだが、上記backendが未接続のため待機状態。
- そのため現状の本番トラフィックには関与しておらず、DBはMongoDBのみが稼働中と考えて差し支えない。

## AI API（Anthropic / OpenAI）の同時実行・制限に関する留意点

- **backend → Anthropic API**：アプリケーション側で明示的な同時実行制御があるのは`workers/linkingWorker.js`のみ。`SharpQuestion`ごとにProblem/Solutionとの関連付けをLLMで判定する処理で、`p-limit`により**同時実行数10**（`DEFAULT_CONCURRENCY_LIMIT = 10`）に制限している。他のLLM呼び出し箇所（`questionGenerator`, `solutionIdeasGenerator`, `policyGenerator`, `digestGenerator`, `reportGenerator`, `extractionWorker`, `chatController`, `debateAnalysisGenerator`, `questionVisualReportGenerator`等、`callLLM`の全呼び出し元）には独自の同時実行数制限は実装されておらず、基本的に逐次（for文で1件ずつawait）またはリクエスト単位（チャットの都度呼び出し）で実行される。
- **Anthropic SDKのデフォルト挙動に依存**：`llmService.js`はSDK（`@anthropic-ai/sdk` v0.98.0）の設定をほぼ上書きしていないため、以下はSDKの既定値がそのまま適用される。
  - タイムアウト：`DEFAULT_TIMEOUT = 600000ms`（10分）
  - リトライ：`maxRetries`既定値 `2`回（429/5xx等はSDK内部で指数バックオフの上で自動リトライ）
  - つまり、Anthropic側のレート制限（429 Too Many Requests）に対する**アプリケーション独自のリトライ/バックオフ処理は実装されていない**。SDKの自動リトライで吸収できない場合はエラーがそのまま呼び出し元まで伝播する。
- **Anthropic APIのレート制限自体（RPM/TPM等の枠）はAnthropic契約プラン側の設定であり、リポジトリ内には記載がない**（Anthropic Console側のUsage limitsで確認が必要）。
- **python-service → OpenAI API（Embeddings）**：`app/main.py`は`OpenAI()`クライアントをデフォルト設定のまま使用しており、同時実行数の制限や独自リトライ処理はコード上に見当たらない。OpenAI SDK自体の既定リトライ（2回）に依存する。呼び出しは埋め込み生成・クラスタリングのリクエスト単位で、backendからの`PYTHON_SERVICE_URL`経由の呼び出し頻度に比例する。
- **まとめ**：LLM呼び出しの並列度を明示的に絞っているのは「質問と意見/課題のリンク付け」処理（同時10）だけで、それ以外は事実上「同時に来たリクエスト数 = 同時に発生するAPI呼び出し数」になる。アクセス集中時にAnthropic/OpenAI側のレート制限に達した場合の挙動は、各SDKの既定リトライ（2回）に任されており、それを超えるとエラーがユーザー側に返る設計。

## 同時接続・リソースに関する留意点

- Vercel（frontend/admin）はサーバレスのCDN配信のため、専有メモリやプロセス数といった概念自体が存在しない（Vercel側のプラン上限に従う）。
- Railway（backend/python-service/MongoDB/Postgres）は各サービスがコンテナとして常時稼働する方式。CPU/メモリの割当量やインスタンス数はRailwayダッシュボード側（Settings → Scale）の設定であり、リポジトリ内には記載がない。ダッシュボード確認値は以下の通り。

  | サービス | リージョン | Replica数 | CPU上限 | メモリ上限 |
  |---|---|---|---|---|
  | idea-discussion/backend（`idobata-backend`） | Southeast Asia（Singapore） | 1 | 8 vCPU | 8 GB |
  | python-service（`idobata-python-service`） | Southeast Asia（Singapore） | 1 | 8 vCPU | 8 GB |
  | MongoDB | Southeast Asia（Singapore） | 1 | 8 vCPU | 8 GB |
  | Postgres（policy-edit用、未接続） | Southeast Asia（Singapore） | 1 | 8 vCPU | 8 GB |

  - 4サービスとも**CPU/メモリの上限は現在契約プランの上限値（8 vCPU/8GB）ぴったり**まで使い切っており、これ以上の垂直スケールはプランのアップグレードなしには不可。
  - 全サービスReplica数は**1**（水平スケールなし）。MongoDB・Postgresは「Volumeがアタッチされているため複数Replica不可」、backend・python-serviceは「マルチリージョンReplicaはPro plan限定」という理由でいずれも単一インスタンス構成。
  - リージョンは4サービスとも**Singaporeに統一済み**（元々MongoDBとpython-serviceはCalifornia〈US West〉に配置されており、backend/Postgresとリージョンが分裂していたが、手動でSingaporeに変更・再デプロイして解消した）。これによりbackend ⇄ MongoDB間の主要経路が太平洋を跨がなくなり、DB接続レイテンシが改善している。
  - つまり、backend/python-serviceそれぞれの処理能力上限は「1台・最大8 vCPU・8GBメモリ」であり、これを超える負荷（同時接続数やLLM呼び出しの滞留によるメモリ増）が来た場合はスケールアウトではなくこの1インスタンス内で捌ききる必要がある構成。
- アプリケーションコード側で明示されている同時実行の制御は、backendのMongoDB接続プール（`maxPoolSize: 10`）と、AI API呼び出しの一部（`linkingWorker`の`p-limit(10)`、前セクション「AI API（Anthropic / OpenAI）の同時実行・制限に関する留意点」参照）のみ。Express/Socket.IO自体には接続数上限の設定はなく、上記のRailwayインスタンスのリソース上限（8 vCPU/8GB・単一Replica）に依存する。
- python-serviceのChromaDBはシングルプロセス・パーシステントモードのため、水平スケール（複数インスタンス化）には対応していない構成。
