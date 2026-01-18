# サービス構造の全体像

## 概要

このプロジェクトは以下の4つの主要なサービスを使用しています：

1. **GitHub** - ソースコード管理とCI/CD
2. **Google Cloud** - フロントエンドと一部のバックエンドサービス
3. **Railway** - バックエンドAPIサーバー（メイン）
4. **MongoDB** - データベース（MongoDB AtlasまたはRailwayのMongoDB）

## アーキテクチャ図

```
┌─────────────────────────────────────────────────────────────┐
│                        GitHub                                │
│  - ソースコード管理                                          │
│  - 自動デプロイトリガー                                      │
│  - リポジトリ: samboofficeota-hue/idobata                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ push/merge
                            ▼
        ┌───────────────────────────────────────┐
        │      Railway (バックエンドAPI)        │
        │  - ルートディレクトリ:                │
        │    idea-discussion/backend            │
        │  - ポート: 3000 (自動設定)            │
        │  - ヘルスチェック: /api/health        │
        │  - 設定ファイル: railway.json         │
        └───────────────────────────────────────┘
                            │
                            │ 接続
                            ▼
        ┌───────────────────────────────────────┐
        │         MongoDB (データベース)       │
        │  - MongoDB Atlas または              │
        │  - RailwayのMongoDB                   │
        └───────────────────────────────────────┘
                            ▲
                            │ 接続
        ┌───────────────────────────────────────┐
        │   Google Cloud (フロントエンド)      │
        │  - Cloud Run: フロントエンド          │
        │  - Cloud Build: CI/CD                │
        │  - ポート: 8080                       │
        └───────────────────────────────────────┘
```

## 各サービスの詳細

### 1. GitHub

**役割**:
- ソースコードのバージョン管理
- RailwayとGoogle Cloudへの自動デプロイトリガー
- プルリクエストとコードレビュー

**リポジトリ**:
- `samboofficeota-hue/idobata`

**主要なブランチ**:
- `main`: 本番環境用

**デプロイフロー**:
- `main`ブランチへのpush/merge → RailwayとGoogle Cloudが自動デプロイ

### 2. Railway

**役割**:
- バックエンドAPIサーバーのホスティング
- Node.js/Expressアプリケーションの実行
- メインのバックエンドサービス

**プロジェクトURL**:
- https://railway.com/project/28737e38-8afa-49c4-9da3-05576dadfa78?environmentId=f54cffc6-6201-429f-af34-485175f6db41

**設定**:
- **ルートディレクトリ**: `idea-discussion/backend`
- **Dockerfile**: `idea-discussion/backend/Dockerfile`
- **railway.json**: `idea-discussion/backend/railway.json`
- **ポート**: Railwayが自動設定（通常3000）
- **スタートコマンド**: `node server.js`
- **ヘルスチェック**: `/api/health`

**環境変数**:
- `NODE_ENV=production`
- `PORT=3000` (Railwayが自動設定)
- `MONGODB_URI`: MongoDB接続文字列
- `JWT_SECRET`: JWT認証用シークレット
- `JWT_EXPIRES_IN=24h`
- `PASSWORD_PEPPER`: パスワードハッシュ用
- `IDEA_CORS_ORIGIN`: CORS許可オリジン
- `PYTHON_SERVICE_URL`: PythonサービスURL
- `API_BASE_URL`: APIベースURL
- `ALLOW_DELETE_THEME=true`
- `OPENROUTER_API_KEY`: OpenRouter APIキー

**デプロイ方法**:
- GitHubへのpushで自動デプロイ
- Railwayダッシュボードから手動デプロイも可能

### 3. Google Cloud

**役割**:
- フロントエンドアプリケーションのホスティング
- Cloud BuildによるCI/CD
- Cloud Runでのコンテナ実行

**サービス**:
- **Cloud Run**: フロントエンドサービス
- **Cloud Build**: ビルドとデプロイの自動化

**設定ファイル**:
- `cloudbuild.yaml`: フロントエンド、管理画面、Pythonサービス用の統合ビルド設定
- `cloudbuild-frontend.yaml`: フロントエンド専用ビルド設定（オプション）
- `cloudbuild-backend.yaml`: バックエンド用ビルド設定（**使用停止** - Railwayに移行済み）

**ポート**:
- 8080 (Cloud Runの標準ポート)

**現在の状況**:
- フロントエンドは正常に動作
- **バックエンドはRailwayに完全移行済み**（Cloud Runでのデプロイは停止）
  - Cloud Runの8080問題とビルドコンテキストの問題を回避
  - Railwayが正常に動作しているため、Cloud Runでのバックエンドデプロイは不要

### 4. MongoDB

**役割**:
- アプリケーションデータの永続化
- ユーザー、テーマ、質問、意見などのデータストレージ

**オプション**:
- **MongoDB Atlas**: クラウドホスト型MongoDB（推奨）
- **Railway MongoDB**: Railwayが提供するMongoDBサービス

**接続方法**:
- `MONGODB_URI`環境変数で接続文字列を指定
- RailwayのMongoDBを使用する場合: `MONGODB_URI=${{MongoDB.MONGO_URL}}`

## デプロイフロー

### Railwayへのデプロイ

1. **GitHubへのpush**
   ```bash
   git add .
   git commit -m "Update backend"
   git push origin main
   ```

2. **Railwayが自動検出**
   - GitHub webhookがRailwayに通知
   - Railwayがリポジトリをクローン

3. **ビルドプロセス**
   - ルートディレクトリ `idea-discussion/backend` に移動
   - `railway.json`を読み込み
   - `Dockerfile`を使用してDockerイメージをビルド
   - `production`ステージをビルド

4. **デプロイ**
   - ビルドされたイメージをデプロイ
   - 環境変数を注入
   - `node server.js`でアプリケーションを起動
   - ヘルスチェック `/api/health` を実行

### Google Cloudへのデプロイ

1. **GitHubへのpush**
   - 同様にGitHubにpush

2. **Cloud Buildが自動検出**
   - GitHub webhookがCloud Buildに通知
   - `cloudbuild-frontend.yaml`を使用してビルド

3. **ビルドとデプロイ**
   - Dockerイメージをビルド
   - Container Registryにプッシュ
   - Cloud Runにデプロイ

## 現在の問題と解決策

### 問題: Railwayのデプロイエラー

**エラーメッセージ**:
```
Dockerfile:47
COPY idea-discussion/backend/ ./
```

**原因**:
- Railwayのルートディレクトリが`idea-discussion/backend`に設定されている場合、ビルドコンテキストはそのディレクトリ内になる
- しかし、`railway.json`がプロジェクトルートにあったため、Railwayが正しく認識できなかった

**解決策**:
- ✅ `railway.json`を`idea-discussion/backend/`に移動
- ✅ `buildCommand`を削除（Railwayが自動検出）
- ✅ Dockerfileは既に正しく設定済み（`COPY . .`を使用）

### 問題: Cloud Buildの8080問題

**原因**:
- Cloud Runはポート8080を要求するが、アプリケーションが正しくリッスンしていない
- 起動タイムアウトの問題

**解決策**:
- Railwayに移行することで、この問題を回避
- Railwayは柔軟なポート設定とタイムアウト設定をサポート

## 設定ファイルの場所

### Railway関連
- `idea-discussion/backend/railway.json`: Railway設定ファイル
- `idea-discussion/backend/Dockerfile`: Dockerビルド設定

### Google Cloud関連
- `cloudbuild-frontend.yaml`: フロントエンド用Cloud Build設定
- `cloudbuild-backend.yaml`: バックエンド用Cloud Build設定（参考用）
- `deploy/backend-service.yaml`: Cloud Runサービス設定（参考用）

### その他
- `docker-compose.yml`: ローカル開発環境用
- `.env.example`: 環境変数のテンプレート

## 確認事項

### Railwayの設定確認

1. **ルートディレクトリ**
   - Railwayダッシュボード → サービス → Settings → Root Directory
   - 値: `idea-discussion/backend`

2. **railway.jsonの配置**
   - パス: `idea-discussion/backend/railway.json`
   - ✅ 修正済み

3. **Dockerfileの配置**
   - パス: `idea-discussion/backend/Dockerfile`
   - ✅ 正しく設定済み

4. **環境変数**
   - Railwayダッシュボード → Variables タブで確認
   - 必要な環境変数がすべて設定されているか確認

### デプロイの確認

1. **Railwayダッシュボードで確認**
   - Deploymentsタブで最新のデプロイメントを確認
   - Logsタブでログを確認

2. **ヘルスチェック**
   ```bash
   curl https://your-app.railway.app/api/health
   ```

3. **Google Cloudの確認**
   - Cloud Runでフロントエンドが正常に動作しているか確認

## 次のステップ

1. ✅ Railwayの設定を修正（完了）
2. ⏳ Railwayでデプロイを再試行
3. ⏳ デプロイ成功を確認
4. ⏳ ヘルスチェックが成功することを確認
5. ⏳ フロントエンドからバックエンドへの接続を確認

## トラブルシューティング

### Railwayのデプロイが失敗する場合

1. **ログを確認**
   - Railwayダッシュボード → Logsタブ

2. **railway.jsonの確認**
   - `idea-discussion/backend/railway.json`が存在するか
   - 設定が正しいか

3. **Dockerfileの確認**
   - `idea-discussion/backend/Dockerfile`が存在するか
   - `COPY . .`を使用しているか（`COPY idea-discussion/backend/ ./`ではない）

4. **環境変数の確認**
   - 必要な環境変数がすべて設定されているか

### MongoDB接続エラー

1. **接続文字列の確認**
   - `MONGODB_URI`が正しく設定されているか

2. **ネットワークアクセス**
   - MongoDB Atlasを使用している場合、IPホワイトリストを確認
   - RailwayのMongoDBを使用している場合、自動的に設定される

## 参考リンク

- Railwayプロジェクト: https://railway.com/project/28737e38-8afa-49c4-9da3-05576dadfa78?environmentId=f54cffc6-6201-429f-af34-485175f6db41
- Railway移行ガイド: `RAILWAY_MIGRATION_GUIDE.md`
- デプロイメントガイド: `DEPLOYMENT.md`
