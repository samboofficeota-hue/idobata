# Google Cloud Secret Manager の使用方法

## 概要

Google Cloud Secret Manager は、API キー、パスワード、データベース接続文字列などの機密情報を安全に保存・管理するためのサービスです。

このプロジェクトでは、以下の機密情報を Secret Manager で管理しています：

- `MONGODB_URI`: MongoDB データベースの接続文字列
- `OPENAI_API_KEY`: OpenAI API キー
- `PASSWORD_PEPPER`: パスワードハッシュ化用のペッパー
- `JWT_SECRET`: JWT トークン署名用の秘密鍵

## Secret Manager の仕組み

### 1. シークレットの保存場所

```
Google Cloud Secret Manager
├── mongodb-uri (MongoDB 接続文字列)
├── openai-api-key (OpenAI API キー)
├── password-pepper (パスワードペッパー)
└── jwt-secret (JWT 秘密鍵)
```

これらのシークレットは、Google Cloud プロジェクト内に暗号化されて保存されます。

### 2. アプリケーションでの使用方法

**重要なポイント**: Secret Manager に保存されたシークレットは、Cloud Run にデプロイする際に**環境変数として自動的に注入**されます。

#### デプロイ時の設定（`cloudbuild.yaml`）

```yaml
- name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
  entrypoint: 'gcloud'
  args:
    - 'run'
    - 'deploy'
    - 'idobata-backend'
    # ... その他のオプション ...
    - '--update-secrets'
    - 'MONGODB_URI=mongodb-uri:latest,OPENAI_API_KEY=openai-api-key:latest,PASSWORD_PEPPER=password-pepper:latest,JWT_SECRET=jwt-secret:latest'
```

この `--update-secrets` オプションにより：
- Secret Manager の `mongodb-uri` が環境変数 `MONGODB_URI` として注入される
- Secret Manager の `openai-api-key` が環境変数 `OPENAI_API_KEY` として注入される
- 以下同様...

#### アプリケーションコードでの使用

アプリケーションコードでは、**通常の環境変数と同じように**アクセスできます：

```javascript
// server.js
const mongoUri = process.env.MONGODB_URI;  // Secret Manager から自動注入

// services/llmService.js
const apiKey = process.env.OPENAI_API_KEY;  // Secret Manager から自動注入

// services/auth/authService.js
const jwtSecret = process.env.JWT_SECRET;   // Secret Manager から自動注入
```

**コードを変更する必要はありません！** Secret Manager のシークレットは、通常の環境変数として扱われます。

## セットアップ手順

### 1. シークレットの作成

`setup-secrets.sh` スクリプトを実行します：

```bash
./setup-secrets.sh
```

このスクリプトは以下を実行します：

1. **シークレットの作成**
   ```bash
   echo -n "$MONGODB_URI" | gcloud secrets create mongodb-uri --data-file=-
   ```

2. **アクセス権限の付与**
   ```bash
   gcloud secrets add-iam-policy-binding mongodb-uri \
       --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
       --role="roles/secretmanager.secretAccessor"
   ```

   Cloud Run のサービスアカウントに、シークレットへの読み取り権限を付与します。

### 2. シークレットの更新

既存のシークレットを更新する場合：

```bash
# 新しいバージョンを作成
echo -n "新しい値" | gcloud secrets versions add mongodb-uri --data-file=-

# 最新バージョンを確認
gcloud secrets versions list mongodb-uri
```

### 3. シークレットの確認

```bash
# シークレット一覧を表示
gcloud secrets list

# シークレットの内容を確認（注意：機密情報が表示されます）
gcloud secrets versions access latest --secret="mongodb-uri"
```

## 通常の環境変数との違い

### 通常の環境変数（`env/*.env.yaml`）

```yaml
# env/backend.env.yaml
NODE_ENV: production
JWT_EXPIRES_IN: 24h
PYTHON_SERVICE_URL: https://...
```

- **用途**: 機密情報を含まない設定値
- **保存場所**: コードリポジトリ内のファイル
- **設定方法**: `--set-env-vars-file` オプション

### Secret Manager のシークレット

```bash
# Secret Manager に保存
mongodb-uri: "mongodb+srv://user:password@cluster.mongodb.net/db"
```

- **用途**: API キー、パスワード、接続文字列などの機密情報
- **保存場所**: Google Cloud Secret Manager（暗号化）
- **設定方法**: `--update-secrets` オプション

## セキュリティ上の利点

### 1. コードリポジトリに機密情報が含まれない

❌ **悪い例**:
```yaml
# cloudbuild.yaml（機密情報がコードに含まれる）
--set-env-vars="MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/db"
```

✅ **良い例**:
```yaml
# cloudbuild.yaml（シークレット名のみ）
--update-secrets="MONGODB_URI=mongodb-uri:latest"
```

### 2. アクセス制御

- IAM（Identity and Access Management）でアクセス権限を細かく制御
- 誰がどのシークレットにアクセスできるかを管理可能

### 3. 監査ログ

- シークレットへのアクセスが自動的にログに記録される
- 誰がいつアクセスしたかを追跡可能

### 4. バージョン管理

- シークレットの変更履歴を保持
- 以前のバージョンにロールバック可能

## 実際の動作フロー

```
1. 開発者が setup-secrets.sh を実行
   ↓
2. Secret Manager にシークレットが保存される
   ↓
3. Cloud Build が cloudbuild.yaml を実行
   ↓
4. --update-secrets オプションでシークレットを環境変数として注入
   ↓
5. Cloud Run サービスが起動
   ↓
6. アプリケーションが process.env.MONGODB_URI などでアクセス
   ↓
7. Secret Manager から自動的に値を取得
```

## トラブルシューティング

### シークレットにアクセスできない

**エラー**: `Permission denied` または `Secret not found`

**解決方法**:
```bash
# アクセス権限を確認
gcloud secrets get-iam-policy mongodb-uri

# アクセス権限を再付与
gcloud secrets add-iam-policy-binding mongodb-uri \
    --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

### シークレットが見つからない

**エラー**: `Secret mongodb-uri not found`

**解決方法**:
```bash
# シークレット一覧を確認
gcloud secrets list

# シークレットが存在しない場合は作成
./setup-secrets.sh
```

## まとめ

- **Secret Manager**: 機密情報を安全に保存・管理
- **Cloud Run**: デプロイ時にシークレットを環境変数として自動注入
- **アプリケーション**: 通常の環境変数として `process.env.KEY` でアクセス
- **セキュリティ**: コードリポジトリに機密情報を含めない

この仕組みにより、機密情報を安全に管理しながら、アプリケーションコードは通常の環境変数と同じようにシンプルに書けます。
