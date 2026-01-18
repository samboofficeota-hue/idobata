# クイック修正コマンド

## 即座に試せる修正（Cloud Run設定の更新）

以下のコマンドを実行して、Cloud Runの設定を直接更新できます：

```bash
# バックエンドサービスの設定を更新
gcloud run services update idobata-backend \
  --region=asia-northeast1 \
  --cpu-boost \
  --min-instances=1 \
  --max-instances=10 \
  --memory=2Gi \
  --cpu=2 \
  --timeout=300
```

このコマンドで以下が設定されます：
- ✅ CPUブースト: 起動時のCPU性能を向上
- ✅ 最小インスタンス数: 1（コールドスタートを回避）
- ✅ メモリ: 2Gi（512Miから増加）
- ✅ CPU: 2（1から増加）
- ✅ タイムアウト: 300秒

## デプロイ前の確認

### 1. ローカルでMongoDB接続をテスト

```bash
cd idea-discussion/backend
node -e "
import('mongoose').then(async ({ default: mongoose }) => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }
  try {
    await mongoose.connect(mongoUri, {
      connectTimeoutMS: 30000,
      serverSelectionTimeoutMS: 10000,
    });
    console.log('✅ MongoDB connection successful');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  }
});
"
```

### 2. ローカルでサーバーを起動してテスト

```bash
cd idea-discussion/backend
PORT=8080 node server.js
```

別のターミナルで：

```bash
curl http://localhost:8080/api/health
```

期待される応答：
```json
{
  "status": "healthy",
  "timestamp": "2026-01-17T...",
  "service": "idobata-backend",
  "database": {
    "status": "connected" or "connecting",
    "ready": true or false
  },
  "server": {
    "listening": true,
    "port": 8080
  }
}
```

## デプロイ後の確認

### 1. ログを確認

```bash
# 最新のログを確認
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=idobata-backend" --limit=50 --format=json

# リアルタイムでログを確認
gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=idobata-backend"
```

### 2. ヘルスチェックをテスト

```bash
# デプロイされたサービスのヘルスチェック
curl https://idobata-backend-336788531163.asia-northeast1.run.app/api/health
```

### 3. サービス状態を確認

```bash
gcloud run services describe idobata-backend --region=asia-northeast1
```

## 問題が解決しない場合

### ステップ1: ログを詳しく確認

```bash
# エラーログのみを表示
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=idobata-backend AND severity>=ERROR" --limit=100
```

### ステップ2: リビジョンの詳細を確認

```bash
# 最新のリビジョンを確認
gcloud run revisions list --service=idobata-backend --region=asia-northeast1

# 特定のリビジョンの詳細
gcloud run revisions describe REVISION_NAME --region=asia-northeast1
```

### ステップ3: Railway.appへの移行を検討

詳細は `CLOUD_RUN_FIX_GUIDE.md` の「解決策 3: Railway.app への移行」を参照してください。
