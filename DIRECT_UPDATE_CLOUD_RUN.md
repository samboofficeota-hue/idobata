# Cloud Run設定を直接更新する方法

## 現在の設定確認

まず、現在の設定を確認します：

```bash
gcloud run services describe idobata-backend \
  --region=asia-northeast1 \
  --format="yaml(spec.template.spec.containers[0].resources,spec.template.metadata.annotations)"
```

## 方法1: 一度にすべて更新（推奨）

すべての設定を一度に更新します：

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

## 方法2: 段階的に更新（安全）

設定を段階的に更新して、各ステップで確認します：

### ステップ1: 最小インスタンス数を設定

```bash
gcloud run services update idobata-backend \
  --region=asia-northeast1 \
  --min-instances=1
```

### ステップ2: メモリとCPUを更新

```bash
gcloud run services update idobata-backend \
  --region=asia-northeast1 \
  --memory=2Gi \
  --cpu=2
```

### ステップ3: CPUブーストを有効化

```bash
gcloud run services update idobata-backend \
  --region=asia-northeast1 \
  --cpu-boost
```

### ステップ4: 最大インスタンス数を設定

```bash
gcloud run services update idobata-backend \
  --region=asia-northeast1 \
  --max-instances=10
```

### ステップ5: タイムアウトを設定

```bash
gcloud run services update idobata-backend \
  --region=asia-northeast1 \
  --timeout=300
```

## 方法3: 安全な更新スクリプトを使用

既に作成済みのスクリプトを使用：

```bash
./SAFE_UPDATE_SETTINGS.sh
```

このスクリプトは：
- 現在の設定を確認
- 段階的に更新
- 更新後の設定を確認
- 新しいリビジョンの状態を確認

## 更新後の確認

### 1. 設定が正しく更新されたか確認

```bash
gcloud run services describe idobata-backend \
  --region=asia-northeast1 \
  --format="yaml(spec.template.spec.containers[0].resources)"
```

期待される出力：
```yaml
spec:
  template:
    spec:
      containers:
      - resources:
          limits:
            cpu: '2'
            memory: 2Gi
```

### 2. 新しいリビジョンの状態を確認

```bash
gcloud run revisions list \
  --service=idobata-backend \
  --region=asia-northeast1 \
  --limit=3 \
  --format="table(metadata.name,status.conditions[0].status,spec.containers[0].resources.limits.memory,spec.containers[0].resources.limits.cpu)"
```

### 3. ヘルスチェックをテスト

```bash
curl https://idobata-backend-336788531163.asia-northeast1.run.app/api/health
```

### 4. ログを確認

```bash
gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=idobata-backend"
```

## 設定パラメータの説明

| パラメータ | 説明 | 推奨値 |
|-----------|------|--------|
| `--memory` | メモリサイズ | `2Gi` (512Miから増加) |
| `--cpu` | CPU数 | `2` (1から増加) |
| `--cpu-boost` | 起動時のCPUブースト | 有効化 |
| `--min-instances` | 最小インスタンス数 | `1` (コールドスタート回避) |
| `--max-instances` | 最大インスタンス数 | `10` |
| `--timeout` | リクエストタイムアウト（秒） | `300` (5分) |

## トラブルシューティング

### エラー: "container failed to start"

**原因**: 新しいリビジョンが起動に失敗している

**解決方法**:
1. 失敗したリビジョンを確認：
   ```bash
   gcloud run revisions list --service=idobata-backend --region=asia-northeast1 --limit=5
   ```

2. 動作しているリビジョンにトラフィックを戻す：
   ```bash
   gcloud run services update-traffic idobata-backend \
     --region=asia-northeast1 \
     --to-revisions=REVISION_NAME=100
   ```

3. コードの修正を先にデプロイしてから、設定を更新

### エラー: "revision cannot be deleted"

**原因**: 最新のリビジョンは直接削除できない

**解決方法**: 
- 新しいリビジョンを作成して、トラフィックを移行
- または、コードを先にデプロイしてから設定を更新

## 推奨される手順

### オプションA: Cloud Build完了後（推奨）

1. Cloud Buildの完了を待つ
2. 新しいコードがデプロイされたことを確認
3. 設定を更新：
   ```bash
   ./SAFE_UPDATE_SETTINGS.sh
   ```

### オプションB: 今すぐ更新（リスクあり）

1. 現在の設定を確認
2. 段階的に更新（方法2を使用）
3. 各ステップで動作確認

## 注意事項

⚠️ **重要な注意点**:

1. **コードの修正を先にデプロイすることを推奨**
   - 新しい設定（メモリ・CPU増加）は、修正されたコードと組み合わせて使用する必要があります

2. **段階的に更新する**
   - 一度にすべての設定を変更すると、問題の原因を特定しにくくなります

3. **ログを常に確認する**
   - 設定を更新する前後で、必ずログを確認してください

4. **バックアップを取る**
   - 重要な設定を変更する前に、現在の設定をメモしておきます

## クイックコマンド集

```bash
# 現在の設定を確認
gcloud run services describe idobata-backend --region=asia-northeast1

# すべての設定を一度に更新
gcloud run services update idobata-backend \
  --region=asia-northeast1 \
  --cpu-boost \
  --min-instances=1 \
  --max-instances=10 \
  --memory=2Gi \
  --cpu=2 \
  --timeout=300

# 更新後の確認
gcloud run services describe idobata-backend --region=asia-northeast1 --format="yaml(spec.template.spec.containers[0].resources)"

# ヘルスチェック
curl https://idobata-backend-336788531163.asia-northeast1.run.app/api/health
```
