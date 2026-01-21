# Railway.app移行ガイド - ステップバイステップ

## なぜRailway.appか？

Cloud Runで繰り返し失敗している問題を根本的に解決するため、完全に別のプラットフォームに移行します。

## 事前準備

### 必要なもの

1. GitHubアカウント（既に持っている）
2. Railway.appアカウント（新規作成）
3. MongoDB Atlasアカウント（既に持っている、またはRailwayのMongoDBを使用）

## ステップ1: Railway.appアカウント作成

1. https://railway.app にアクセス
2. 「Start a New Project」をクリック
3. 「Deploy from GitHub repo」を選択
4. GitHubアカウントでログイン
5. リポジトリ `samboofficeota-hue/idobata` を選択

## ステップ2: MongoDBサービスを追加

### 方法A: RailwayのMongoDBを使用（推奨）

1. Railwayダッシュボードで「New」をクリック
2. 「Database」→「Add MongoDB」を選択
3. 自動的に環境変数が設定される

### 方法B: MongoDB Atlasを使用（既存のDBを使用）

1. MongoDB Atlasの接続文字列を取得
2. Railwayで環境変数として設定（後述）

## ステップ3: Node.jsサービスを追加

1. Railwayダッシュボードで「New」をクリック
2. 「GitHub Repo」を選択
3. リポジトリ `samboofficeota-hue/idobata` を選択
4. サービスが自動的に作成される

## ステップ4: サービス設定

### ルートディレクトリの設定

1. サービスをクリック
2. 「Settings」タブを選択
3. 「Root Directory」に `idea-discussion/backend` を設定

### ビルドコマンド

Railwayは自動的に検出しますが、必要に応じて：

**Build Command**: （空欄または `npm install`）

**Start Command**: `node server.js`

## ステップ5: 環境変数の設定

Railwayダッシュボードで「Variables」タブを選択し、以下を設定：

### 基本設定

```
NODE_ENV=production
PORT=3000
```

### データベース接続

**RailwayのMongoDBを使用する場合**:
```
MONGODB_URI=${{MongoDB.MONGO_URL}}
```

**MongoDB Atlasを使用する場合**:
```
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname?retryWrites=true&w=majority
```

### 認証設定

```
JWT_SECRET=your-jwt-secret-key-here
JWT_EXPIRES_IN=24h
PASSWORD_PEPPER=your-password-pepper-here
```

### CORS設定

```
IDEA_CORS_ORIGIN=https://your-frontend-url.com,https://your-admin-url.com
```

### その他の設定

```
PYTHON_SERVICE_URL=https://your-python-service-url.com
API_BASE_URL=https://your-backend-url.com
ALLOW_DELETE_THEME=true
OPENAI_API_KEY=your-openai-api-key
```

## ステップ6: デプロイの確認

### 1. デプロイの進行状況

Railwayダッシュボードで「Deployments」タブを確認

### 2. ログの確認

Railwayダッシュボードで「Logs」タブを確認

期待されるログ:
```
Backend server listening on port 3000
MongoDB connected successfully.
Server is fully ready with database connection.
```

### 3. ヘルスチェック

Railwayダッシュボードで「Settings」→「Domains」からURLを取得し、テスト：

```bash
curl https://your-app.railway.app/api/health
```

期待される応答:
```json
{
  "status": "healthy",
  "service": "idobata-backend",
  "database": {
    "status": "connected",
    "ready": true
  }
}
```

## ステップ7: カスタムドメイン設定（オプション）

1. Railwayダッシュボードで「Settings」→「Domains」を選択
2. 「Custom Domain」をクリック
3. ドメイン名を入力
4. DNS設定をRailwayの指示に従って設定

## トラブルシューティング

### デプロイが失敗する場合

1. **ログを確認**: Railwayダッシュボードで「Logs」タブを確認
2. **環境変数を確認**: すべての環境変数が正しく設定されているか確認
3. **ビルドコマンドを確認**: 正しいビルドコマンドが設定されているか確認

### MongoDB接続エラー

1. **接続文字列を確認**: `MONGODB_URI`が正しいか確認
2. **ネットワークアクセスを確認**: MongoDB Atlasを使用している場合、IPホワイトリストを確認
3. **RailwayのMongoDBを使用**: RailwayのMongoDBを使用すると、ネットワーク設定が不要

### ポートエラー

Railwayは自動的にPORT環境変数を設定します。コードで`process.env.PORT`を使用していることを確認してください。

## 移行後の確認事項

- [ ] デプロイが成功している
- [ ] ヘルスチェックが成功している
- [ ] MongoDB接続が正常
- [ ] 環境変数が正しく設定されている
- [ ] カスタムドメインが設定されている（オプション）

## コスト比較

### Google Cloud Run
- 無料枠: 200万リクエスト/月
- その後: 使用量に応じて課金
- 複雑な設定が必要

### Railway.app
- 無料枠: $5のクレジット/月
- その後: 使用量に応じて課金
- シンプルな料金体系
- 設定が簡単

## 次のステップ

1. ✅ Railway.appにアカウントを作成
2. ✅ MongoDBサービスを追加
3. ✅ Node.jsサービスを追加
4. ✅ 環境変数を設定
5. ✅ デプロイを確認
6. ✅ 問題が解決したら、Cloud Runから移行

## 重要なポイント

⚠️ **完全に別のプラットフォームに移行することで、Cloud Run特有の問題を回避**

Railway.appは：
- シンプルなデプロイ
- 内蔵データベース
- 柔軟なタイムアウト設定
- トラブルが少ない
