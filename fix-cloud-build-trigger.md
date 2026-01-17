# Cloud Build トリガーの修正方法

## 問題

エラーメッセージ：
```
unable to prepare context: unable to evaluate symlinks in Dockerfile path: lstat /workspace/Dockerfile: no such file or directory
```

Cloud Buildトリガーが`/workspace/Dockerfile`を探していますが、実際のDockerfileは`idea-discussion/backend/Dockerfile`にあります。

## 解決方法

### 方法1: Google Cloud Consoleでトリガーを修正（推奨）

1. [Google Cloud Console](https://console.cloud.google.com/cloud-build/triggers?project=idobata-471403)にアクセス
2. トリガー `rmgpgab-idobata-backend-asia-northeast1-samboofficeota-hue-iots` を開く
3. **設定**タブで以下を確認・修正：
   - **Configuration**: `Cloud Build configuration file (yaml or json)` を選択
   - **Location**: `cloudbuild-backend.yaml` を指定
   - **Dockerfile**: 空欄にする（`cloudbuild-backend.yaml`で指定済みのため）

### 方法2: gcloud CLIでトリガーを更新

```bash
# 現在のトリガー設定を確認
gcloud builds triggers describe rmgpgab-idobata-backend-asia-northeast1-samboofficeota-hue-iots \
  --project=idobata-471403

# トリガーを更新（cloudbuild-backend.yamlを使用）
gcloud builds triggers update rmgpgab-idobata-backend-asia-northeast1-samboofficeota-hue-iots \
  --project=idobata-471403 \
  --build-config=cloudbuild-backend.yaml \
  --branch-pattern="^main$" \
  --repo-name=idobata \
  --repo-owner=samboofficeota-hue
```

### 方法3: トリガーを再作成

既存のトリガーを削除して再作成：

```bash
# 既存のトリガーを削除
gcloud builds triggers delete rmgpgab-idobata-backend-asia-northeast1-samboofficeota-hue-iots \
  --project=idobata-471403

# 新しいトリガーを作成
gcloud builds triggers create github \
  --name="idobata-backend-asia-northeast1" \
  --project=idobata-471403 \
  --repo-name=idobata \
  --repo-owner=samboofficeota-hue \
  --branch-pattern="^main$" \
  --build-config=cloudbuild-backend.yaml \
  --service-account=projects/idobata-471403/serviceAccounts/336788531163-compute@developer.gserviceaccount.com
```

## 確認事項

`cloudbuild-backend.yaml`の内容は正しいです：

```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: [
      'build',
      '-t', 'gcr.io/idobata-471403/idobata-backend',
      '-f', 'idea-discussion/backend/Dockerfile',  # ← 正しいパス
      '--target', 'production',
      '.'
    ]
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/idobata-471403/idobata-backend']
```

問題は、トリガーがこのファイルを参照していないか、またはトリガーの設定でDockerfileパスが上書きされている可能性があります。
