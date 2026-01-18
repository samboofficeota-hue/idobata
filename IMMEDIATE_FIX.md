# 即座に実行できる修正手順

## 現在の状況

- 失敗したリビジョン `idobata-backend-00085-54m` が存在するが、削除できない（最新リビジョンのため）
- 現在のトラフィックは `idobata-backend-00072-pxj` に送られている（正常に動作中）
- 設定を更新しようとすると、新しいリビジョンが作成され、起動に失敗する

## 解決方法

### オプション1: コードを先にデプロイしてから設定を更新（推奨）

1. **コードの修正をコミット・プッシュ**
   ```bash
   git add .
   git commit -m "Fix: Optimize MongoDB connection and Cloud Run settings"
   git push origin main
   ```

2. **Cloud Buildの完了を待つ**
   - GitHubにプッシュすると、自動的にCloud Buildがトリガーされます
   - 新しいイメージがビルドされ、デプロイされます

3. **デプロイ完了後、設定を更新**
   ```bash
   ./SAFE_UPDATE_SETTINGS.sh
   ```
   
   または、手動で：
   ```bash
   gcloud run services update idobata-backend \
     --region=asia-northeast1 \
     --cpu-boost \
     --min-instances=1 \
     --max-instances=10 \
     --memory=2Gi \
     --cpu=2 \
     --timeout=300
   ```

### オプション2: 設定を段階的に更新（安全）

設定を一度に更新せず、段階的に更新します：

```bash
# 1. 最小インスタンス数のみ更新
gcloud run services update idobata-backend \
  --region=asia-northeast1 \
  --min-instances=1

# 2. メモリとCPUを更新
gcloud run services update idobata-backend \
  --region=asia-northeast1 \
  --memory=2Gi \
  --cpu=2

# 3. CPUブーストを有効化
gcloud run services update idobata-backend \
  --region=asia-northeast1 \
  --cpu-boost

# 4. 最大インスタンス数を設定
gcloud run services update idobata-backend \
  --region=asia-northeast1 \
  --max-instances=10
```

### オプション3: 新しいリビジョンを作成してもトラフィックを送らない（テスト用）

```bash
# 設定を更新するが、トラフィックは送らない
gcloud run services update idobata-backend \
  --region=asia-northeast1 \
  --cpu-boost \
  --min-instances=1 \
  --max-instances=10 \
  --memory=2Gi \
  --cpu=2 \
  --timeout=300 \
  --no-traffic
```

その後、新しいリビジョンが正常に動作することを確認してから、トラフィックを移行：

```bash
# 新しいリビジョンに100%のトラフィックを送る
gcloud run services update-traffic idobata-backend \
  --region=asia-northeast1 \
  --to-latest
```

## 推奨される手順（最も安全）

### ステップ1: コードの修正をデプロイ

```bash
# 変更を確認
git status

# コミット
git add .
git commit -m "Fix: Optimize MongoDB connection and Cloud Run settings"

# プッシュ
git push origin main
```

### ステップ2: Cloud Buildの完了を待つ

```bash
# Cloud Buildの最新のビルドを確認
gcloud builds list --limit=5

# ビルドのログを確認（必要に応じて）
gcloud builds log BUILD_ID
```

### ステップ3: 新しいリビジョンが正常に動作することを確認

```bash
# 最新のリビジョンを確認
gcloud run revisions list --service=idobata-backend --region=asia-northeast1 --limit=3

# ヘルスチェックをテスト
curl https://idobata-backend-336788531163.asia-northeast1.run.app/api/health
```

### ステップ4: 設定を更新

```bash
# 安全な更新スクリプトを実行
./SAFE_UPDATE_SETTINGS.sh
```

## トラブルシューティング

### ログを確認

```bash
# 最新のログを確認
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=idobata-backend" --limit=50

# エラーログのみを表示
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=idobata-backend AND severity>=ERROR" --limit=100
```

### 現在のトラフィック設定を確認

```bash
gcloud run services describe idobata-backend --region=asia-northeast1 --format="yaml(status.traffic)"
```

### 特定のリビジョンにトラフィックを戻す

```bash
# 動作しているリビジョンに100%のトラフィックを送る
gcloud run services update-traffic idobata-backend \
  --region=asia-northeast1 \
  --to-revisions=idobata-backend-00072-pxj=100
```

## 重要な注意点

1. **コードの修正を先にデプロイする**
   - 新しい設定（メモリ・CPU増加など）は、修正されたコードと組み合わせて使用する必要があります

2. **段階的に更新する**
   - 一度にすべての設定を変更すると、問題の原因を特定しにくくなります

3. **ログを常に確認する**
   - 設定を更新する前後で、必ずログを確認してください

4. **バックアップを取る**
   - 重要な設定を変更する前に、現在の設定をメモしておきます
