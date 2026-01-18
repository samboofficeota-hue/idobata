# Cloud Run ビルドエラー解決ガイド

## 問題の概要

```
ERROR: (gcloud.run.deploy) The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout.
```

このエラーは、コンテナが起動してポート8080でリッスンするまでに、Cloud Runのタイムアウト（デフォルト240秒）を超えてしまっていることを示しています。

## 原因分析

1. **MongoDB接続の遅延**: サーバーは起動しているが、MongoDB接続に時間がかかっている
2. **スタートアッププローブの設定不足**: Cloud Runのデフォルト設定では240秒のタイムアウト
3. **CPU/メモリリソース不足**: コールドスタート時のリソース不足
4. **ヘルスチェックの最適化不足**: データベース接続を待たずにヘルスチェックを返すべき

---

## 解決策 1: Google Cloud Run設定の最適化（推奨）

### 1.1 スタートアッププローブの設定

`deploy/backend-service.yaml` を更新して、スタートアッププローブを追加します：

```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: idobata-backend
  annotations:
    run.googleapis.com/ingress: all
spec:
  template:
    metadata:
      annotations:
        run.googleapis.com/execution-environment: gen2
        # スタートアッププローブの設定
        run.googleapis.com/startup-cpu-boost: "true"  # 起動時のCPUブースト
    spec:
      containers:
      - image: gcr.io/PROJECT_ID/idobata-backend
        ports:
        - containerPort: 8080
        env:
        - name: PORT
          value: "8080"
        # ... 他の環境変数 ...
        resources:
          limits:
            cpu: "2"
            memory: "2Gi"
          requests:
            cpu: "1"
            memory: "1Gi"
        # スタートアッププローブ（HTTP）
        startupProbe:
          httpGet:
            path: /api/health
            port: 8080
          initialDelaySeconds: 0
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 24  # 最大240秒待機 (24 * 10秒)
          successThreshold: 1
        # ライブネスプローブ
        livenessProbe:
          httpGet:
            path: /api/health
            port: 8080
          initialDelaySeconds: 0
          periodSeconds: 30
          timeoutSeconds: 5
          failureThreshold: 3
      # 最小インスタンス数を設定（コールドスタートを回避）
      minScale: 1
      # 最大インスタンス数
      maxScale: 10
      serviceAccountName: idobata-backend-sa
```

### 1.2 cloudbuild.yaml の更新

`cloudbuild.yaml` のデプロイステップを更新：

```yaml
- name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
  entrypoint: 'gcloud'
  args:
    - 'run'
    - 'deploy'
    - 'idobata-backend'
    - '--image'
    - 'gcr.io/$PROJECT_ID/idobata-backend'
    - '--region'
    - 'asia-northeast1'
    - '--platform'
    - 'managed'
    - '--allow-unauthenticated'
    - '--port'
    - '8080'
    - '--timeout'
    - '300'  # リクエストタイムアウト（スタートアップとは別）
    - '--memory'
    - '2Gi'  # メモリを増やす
    - '--cpu'
    - '2'    # CPUを増やす
    - '--cpu-boost'  # CPUブーストを有効化
    - '--min-instances'
    - '1'    # 最小インスタンス数を1に設定
    - '--max-instances'
    - '10'
    - '--startup-cpu-boost'  # スタートアップ時のCPUブースト
    - '--update-secrets'
    - 'MONGODB_URI=mongodb-uri:latest,OPENAI_API_KEY=openai-api-key:latest,PASSWORD_PEPPER=password-pepper:latest,JWT_SECRET=jwt-secret:latest'
    - '--env-vars-file'
    - '/workspace/backend-env.yaml'
```

### 1.3 gcloud コマンドでの直接設定

```bash
gcloud run services update idobata-backend \
  --region=asia-northeast1 \
  --cpu-boost \
  --min-instances=1 \
  --memory=2Gi \
  --cpu=2 \
  --timeout=300
```

---

## 解決策 2: コードの最適化

### 2.1 MongoDB接続のタイムアウト設定

`idea-discussion/backend/server.js` の `connectToDatabase` 関数を更新：

```javascript
async function connectToDatabase() {
  if (!mongoUri) {
    console.error("Error: MONGODB_URI is not defined in the environment variables.");
    throw new Error("MONGODB_URI not set");
  }
  
  try {
    // MongoDB接続オプションを追加
    await mongoose.connect(mongoUri, {
      // 接続タイムアウト（30秒）
      connectTimeoutMS: 30000,
      // サーバー選択タイムアウト（10秒）
      serverSelectionTimeoutMS: 10000,
      // ソケットタイムアウト（45秒）
      socketTimeoutMS: 45000,
      // 接続プール設定
      maxPoolSize: 10,
      minPoolSize: 2,
      // リトライ設定
      retryWrites: true,
      retryReads: true,
      // ハートビート頻度（10秒）
      heartbeatFrequencyMS: 10000,
    });
    console.log("MongoDB connected successfully.");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    throw err;
  }
}
```

### 2.2 ヘルスチェックエンドポイントの改善

データベース接続を待たずに、サーバーが起動していることを即座に返すようにします：

```javascript
// --- Health Check Endpoint ---
app.get("/api/health", (req, res) => {
  // サーバーが起動していることを即座に返す
  // データベース接続は非同期で行われるため、ここでは待たない
  const dbState = mongoose.connection.readyState;
  const dbStatus = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };
  
  // サーバーが起動していれば200を返す（DB接続状態は情報として含める）
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "idobata-backend",
    database: {
      status: dbStatus[dbState] || "unknown",
      ready: dbState === 1,
    },
    // サーバーがリッスンしていることを明示
    server: {
      listening: true,
      port: PORT,
    },
  });
});
```

### 2.3 サーバー起動の最適化

サーバーを即座に起動し、データベース接続はバックグラウンドで行う（現在の実装は正しい）：

```javascript
// --- Start Server ---
// サーバーを即座に起動（ヘルスチェック用）
const server = httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server listening on port ${PORT}`);
  console.log(`Server process started at ${new Date().toISOString()}`);
  console.log("Server started. Connecting to MongoDB...");
  
  // サーバー起動後、即座にヘルスチェックが成功することをログに記録
  console.log("Health check endpoint available at /api/health");
});

// データベース接続はバックグラウンドで実行（非ブロッキング）
connectToDatabase()
  .then(() => {
    console.log("Server is fully ready with database connection.");
  })
  .catch((err) => {
    console.error("Failed to connect to database:", err);
    // サーバーは継続して実行（ヘルスチェックは成功する）
  });
```

---

## 解決策 3: Railway.app への移行

### 3.1 Railwayの利点

- **シンプルなデプロイ**: Git pushで自動デプロイ
- **内蔵データベース**: MongoDBが簡単にセットアップ可能
- **柔軟なタイムアウト設定**: スタートアップタイムアウトが長い
- **プライベートネットワーク**: アプリとDB間の通信が高速

### 3.2 Railway移行手順

1. **Railwayアカウント作成**: https://railway.app

2. **新しいプロジェクト作成**

3. **MongoDBサービス追加**
   - Railwayダッシュボードで「New」→「Database」→「MongoDB」を選択
   - 自動的に環境変数が設定される（`MONGO_URL`など）

4. **Node.jsサービス追加**
   - 「New」→「GitHub Repo」を選択
   - リポジトリを選択
   - ルートディレクトリを `idea-discussion/backend` に設定

5. **環境変数設定**
   ```
   NODE_ENV=production
   PORT=3000  # Railwayは自動的にPORTを設定するが、明示的に設定可能
   MONGODB_URI=${{MongoDB.MONGO_URL}}  # Railwayの変数参照
   ```

6. **ビルドコマンド設定**
   ```
   npm install
   ```

7. **スタートコマンド設定**
   ```
   node server.js
   ```

8. **カスタムドメイン設定**（オプション）
   - Railwayダッシュボードで「Settings」→「Domains」から設定

### 3.3 Railway用のDockerfile（オプション）

RailwayはDockerfileもサポートしています。既存のDockerfileを使用する場合は、`railway.json`を作成：

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "idea-discussion/backend/Dockerfile"
  },
  "deploy": {
    "startCommand": "node server.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

---

## 解決策 4: Cloudflare Workers/Pages への移行

### 4.1 Cloudflare Workers の利点

- **エッジコンピューティング**: グローバルに低遅延
- **無料枠が充実**: 100,000リクエスト/日まで無料
- **自動スケーリング**: トラフィックに応じて自動拡張

### 4.2 Cloudflare Workers への移行の注意点

**制約**:
- Node.jsの一部APIが制限される（`node:fs`は一時的なみ）
- MongoDB接続には外部サービス（MongoDB Atlas）が必要
- WebSocket（Socket.io）はDurable Objectsが必要

**推奨アプローチ**:
1. **MongoDB Atlas**を使用（Cloud Runと同じ）
2. **Express.js**は`@cloudflare/workers-http`でラップ
3. **Socket.io**はDurable Objectsに移行、または削除

### 4.3 Cloudflare Workers 移行手順

1. **Wrangler CLI インストール**
   ```bash
   npm install -g wrangler
   ```

2. **プロジェクト初期化**
   ```bash
   cd idea-discussion/backend
   wrangler init
   ```

3. **wrangler.toml 設定**
   ```toml
   name = "idobata-backend"
   main = "src/index.js"
   compatibility_date = "2024-01-01"
   nodejs_compat = true

   [vars]
   NODE_ENV = "production"

   [[secrets]]
   # wrangler secret put MONGODB_URI
   ```

4. **コードの適応**
   - Express.jsを`@cloudflare/workers-http`でラップ
   - MongoDB接続を外部サービス（Atlas）に変更

**注意**: Cloudflare Workersへの移行は大規模なリファクタリングが必要です。

---

## 推奨される解決順序

### 即座に試すべきこと（優先度: 高）

1. ✅ **MongoDB接続タイムアウト設定を追加**（解決策2.1）
2. ✅ **cloudbuild.yamlに`--cpu-boost`と`--min-instances=1`を追加**（解決策1.2）
3. ✅ **gcloudコマンドで直接設定を更新**（解決策1.3）

### 次に試すこと（優先度: 中）

4. ✅ **スタートアッププローブを設定**（解決策1.1）
5. ✅ **メモリとCPUを増やす**（2Gi, 2CPU）

### 長期的な検討（優先度: 低）

6. ⚠️ **Railway.appへの移行を検討**（解決策3）
   - Cloud Runで解決しない場合
   - よりシンプルな運用を希望する場合

7. ⚠️ **Cloudflare Workersへの移行**（解決策4）
   - 大規模なリファクタリングが必要
   - エッジコンピューティングが必要な場合のみ

---

## トラブルシューティング

### ログの確認

```bash
# Cloud Runのログを確認
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=idobata-backend" --limit=50 --format=json

# リアルタイムでログを確認
gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=idobata-backend"
```

### ヘルスチェックのテスト

```bash
# ローカルでテスト
curl http://localhost:8080/api/health

# デプロイ後にテスト
curl https://idobata-backend-336788531163.asia-northeast1.run.app/api/health
```

### よくある問題

1. **ポートが8080でない**
   - `process.env.PORT`を必ず使用する
   - Dockerfileで`ENV PORT=8080`を設定

2. **0.0.0.0でリッスンしていない**
   - `server.listen(PORT, '0.0.0.0', ...)`を確認

3. **MongoDB接続が遅い**
   - MongoDB Atlasのリージョンを確認（asia-northeast1に近いリージョンを選択）
   - 接続プール設定を最適化

---

## 次のステップ

1. 解決策1.2と1.3を実装してデプロイ
2. ログを確認して問題が解決したか確認
3. 解決しない場合は、解決策2.1（MongoDBタイムアウト設定）を追加
4. それでも解決しない場合は、Railway.appへの移行を検討
