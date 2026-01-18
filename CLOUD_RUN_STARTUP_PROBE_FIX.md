# Cloud Run スタートアッププローブ修正ガイド

## 問題

```
ERROR: (gcloud.run.deploy) The user-provided container failed the configured startup probe checks.
```

Cloud Runのスタートアッププローブが失敗しています。

## 原因

- Cloud RunのデフォルトのTCPプローブが240秒でタイムアウト
- サーバーが起動してMongoDBに接続するまでに時間がかかる
- HTTPプローブが設定されていない

## 解決策

### 方法1: cloudbuild-backend.yamlを更新（推奨）

✅ **既に修正済み**: `cloudbuild-backend.yaml`にスタートアッププローブを追加しました。

次回のデプロイで自動的に適用されます。

### 方法2: 手動でスタートアッププローブを設定

現在のサービスに即座にスタートアッププローブを設定する場合：

```bash
gcloud run services update idobata-backend \
  --region=asia-northeast1 \
  --startup-probe httpGet.path=/api/health,httpGet.port=8080,initialDelaySeconds=0,periodSeconds=10,timeoutSeconds=5,failureThreshold=24 \
  --memory=2Gi \
  --cpu=2 \
  --min-instances=1 \
  --max-instances=10
```

### スタートアッププローブの設定説明

- `httpGet.path=/api/health`: ヘルスチェックエンドポイント
- `httpGet.port=8080`: ポート番号
- `initialDelaySeconds=0`: 即座にプローブ開始
- `periodSeconds=10`: 10秒ごとにプローブ
- `timeoutSeconds=5`: 各プローブのタイムアウト5秒
- `failureThreshold=24`: 最大24回失敗まで許容（24×10秒=240秒）

## 修正内容

### cloudbuild-backend.yamlの変更点

1. **スタートアッププローブを追加**
   ```yaml
   - '--startup-probe'
   - 'httpGet.path=/api/health,httpGet.port=8080,initialDelaySeconds=0,periodSeconds=10,timeoutSeconds=5,failureThreshold=24'
   ```

2. **リソースを増強**
   - メモリ: `512Mi` → `2Gi`
   - CPU: `1` → `2`
   - 最小インスタンス数: `1`を追加
   - 最大インスタンス数: `10`を追加

## 次のステップ

### 1. 変更をコミット・プッシュ

```bash
git add cloudbuild-backend.yaml
git commit -m "Fix: Add startup probe to Cloud Run backend service"
git push origin main
```

### 2. Cloud Buildの完了を待つ

```bash
# ビルドの進行状況を確認
gcloud builds list --limit=5

# 最新のビルドのログを確認
gcloud builds log BUILD_ID
```

### 3. または、手動でスタートアッププローブを設定（即座に適用）

```bash
gcloud run services update idobata-backend \
  --region=asia-northeast1 \
  --startup-probe httpGet.path=/api/health,httpGet.port=8080,initialDelaySeconds=0,periodSeconds=10,timeoutSeconds=5,failureThreshold=24 \
  --memory=2Gi \
  --cpu=2 \
  --min-instances=1 \
  --max-instances=10
```

### 4. デプロイ成功を確認

```bash
# 最新のリビジョンを確認
gcloud run revisions list \
  --service=idobata-backend \
  --region=asia-northeast1 \
  --limit=3

# ヘルスチェック
curl https://idobata-backend-336788531163.asia-northeast1.run.app/api/health

# ログを確認
gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=idobata-backend"
```

## 期待される結果

スタートアッププローブを設定することで：

1. ✅ サーバーが起動したら即座にヘルスチェックが開始される
2. ✅ `/api/health`エンドポイントが200を返すまで最大240秒待機
3. ✅ MongoDB接続が完了するまでに十分な時間が確保される
4. ✅ デプロイが成功する

## トラブルシューティング

### スタートアッププローブがまだ失敗する場合

1. **ログを確認**
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=idobata-backend" --limit=50
   ```

2. **ヘルスチェックエンドポイントを確認**
   ```bash
   curl https://idobata-backend-336788531163.asia-northeast1.run.app/api/health
   ```

3. **MongoDB接続を確認**
   - `MONGODB_URI`が正しく設定されているか
   - MongoDB Atlasのネットワークアクセス設定を確認

4. **failureThresholdを増やす**
   - 現在: 24回（240秒）
   - 必要に応じて30回（300秒）に増やす

### Railwayは成功しているのにCloud Runが失敗する場合

Railwayは成功しているので、アプリケーション自体は問題ありません。

Cloud Run特有の問題：
- ポート8080の要求
- スタートアッププローブの設定
- リソース制約

これらの設定を正しく行えば、Cloud Runでも成功するはずです。

## 参考

- [Cloud Run スタートアッププローブ](https://cloud.google.com/run/docs/configuring/healthchecks#startup-probe)
- [Cloud Run リソース設定](https://cloud.google.com/run/docs/configuring/cpu-memory)
