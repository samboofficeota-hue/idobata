# Cloud Run設定更新エラーの解決方法

## 問題

`gcloud run services update`を実行すると、新しいリビジョンが作成されますが、そのリビジョンが起動に失敗しています：

```
ERROR: (gcloud.run.services.update) The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout.
```

## 原因

設定を更新する際に、新しいリビジョンが作成され、そのリビジョンが既存のコンテナイメージ（まだ修正されていないコード）を使用しているため、起動に失敗しています。

## 解決方法

### 方法1: 失敗したリビジョンをロールバック（推奨）

1. **現在のリビジョン一覧を確認**
   ```bash
   gcloud run revisions list --service=idobata-backend --region=asia-northeast1
   ```

2. **動作しているリビジョンにトラフィックを戻す**
   ```bash
   # 最新のリビジョン（失敗したもの）のトラフィックを0%にする
   gcloud run services update-traffic idobata-backend \
     --region=asia-northeast1 \
     --to-revisions=REVISION_NAME=100
   ```
   
   または、失敗したリビジョンを削除：
   ```bash
   # 失敗したリビジョンを削除（例: idobata-backend-00085-54m）
   gcloud run revisions delete idobata-backend-00085-54m \
     --region=asia-northeast1 \
     --quiet
   ```

3. **サービスを確認**
   ```bash
   gcloud run services describe idobata-backend --region=asia-northeast1
   ```

### 方法2: コードを先にデプロイしてから設定を更新（最推奨）

1. **コードの修正をコミット・プッシュ**
   ```bash
   git add .
   git commit -m "Fix: Optimize MongoDB connection and improve health check"
   git push origin main
   ```

2. **Cloud Buildで自動デプロイを待つ**
   - GitHubにプッシュすると、Cloud Buildトリガーが自動的に実行されます
   - 新しいイメージがビルドされ、デプロイされます

3. **デプロイ完了後、設定を更新**
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

### 方法3: 設定を段階的に更新（安全）

設定を一度に更新せず、段階的に更新します：

1. **まず、最小インスタンス数のみ更新**
   ```bash
   gcloud run services update idobata-backend \
     --region=asia-northeast1 \
     --min-instances=1
   ```

2. **動作確認後、メモリとCPUを更新**
   ```bash
   gcloud run services update idobata-backend \
     --region=asia-northeast1 \
     --memory=2Gi \
     --cpu=2
   ```

3. **最後に、CPUブーストを有効化**
   ```bash
   gcloud run services update idobata-backend \
     --region=asia-northeast1 \
     --cpu-boost
   ```

### 方法4: 新しいリビジョンを作成してもトラフィックを送らない（テスト用）

設定を更新する際に、`--no-traffic`フラグを使用して、新しいリビジョンにトラフィックを送らないようにします：

```bash
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

## 推奨される手順

### ステップ1: 現在の状態を確認

```bash
# サービス状態を確認
gcloud run services describe idobata-backend --region=asia-northeast1

# リビジョン一覧を確認
gcloud run revisions list --service=idobata-backend --region=asia-northeast1

# ログを確認
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=idobata-backend" --limit=20
```

### ステップ2: 失敗したリビジョンを削除または無効化

```bash
# 失敗したリビジョンを削除
gcloud run revisions delete idobata-backend-00085-54m \
  --region=asia-northeast1 \
  --quiet
```

### ステップ3: コードの修正をデプロイ

```bash
# コードをコミット・プッシュ
git add .
git commit -m "Fix: Optimize MongoDB connection and Cloud Run settings"
git push origin main
```

### ステップ4: Cloud Buildの完了を待つ

Cloud Buildのログを確認：

```bash
# Cloud Buildの最新のビルドを確認
gcloud builds list --limit=5
```

### ステップ5: デプロイ完了後、設定を更新

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

## トラブルシューティング

### ログを詳しく確認

```bash
# 失敗したリビジョンのログを確認
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=idobata-backend AND resource.labels.revision_name=idobata-backend-00085-54m" --limit=50
```

### 既存のリビジョンに戻す

```bash
# すべてのリビジョンを確認
gcloud run revisions list --service=idobata-backend --region=asia-northeast1

# 動作しているリビジョンに100%のトラフィックを送る
gcloud run services update-traffic idobata-backend \
  --region=asia-northeast1 \
  --to-revisions=REVISION_NAME=100
```

### サービスを完全に再デプロイ

```bash
# 最新のイメージを使用して再デプロイ
gcloud run deploy idobata-backend \
  --image=gcr.io/idobata-471403/idobata-backend:latest \
  --region=asia-northeast1 \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --timeout=300 \
  --memory=2Gi \
  --cpu=2 \
  --cpu-boost \
  --min-instances=1 \
  --max-instances=10
```

## 重要な注意点

1. **設定を更新する前に、コードの修正をデプロイする**
   - 新しい設定（メモリ・CPU増加など）は、修正されたコードと組み合わせて使用する必要があります

2. **段階的に更新する**
   - 一度にすべての設定を変更すると、問題の原因を特定しにくくなります

3. **ログを常に確認する**
   - 設定を更新する前後で、必ずログを確認してください

4. **バックアップを取る**
   - 重要な設定を変更する前に、現在の設定をメモしておきます
