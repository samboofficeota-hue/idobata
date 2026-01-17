# Cloud Build トリガーの手動修正手順

## 問題

エラーメッセージ：
```
unable to prepare context: unable to evaluate symlinks in Dockerfile path: lstat /workspace/Dockerfile: no such file or directory
```

Cloud Buildトリガーが`/workspace/Dockerfile`を探していますが、実際のDockerfileは`idea-discussion/backend/Dockerfile`にあります。

## 解決方法：Google Cloud Consoleで修正

### ステップ1: Cloud Build Triggersにアクセス

1. [Google Cloud Console - Cloud Build Triggers](https://console.cloud.google.com/cloud-build/triggers?project=idobata-471403)にアクセス
2. プロジェクトが`idobata-471403`であることを確認

### ステップ2: トリガーを編集

1. トリガー名 `rmgpgab-idobata-backend-asia-northeast1-samboofficeota-hue-iots` をクリック
2. **編集**ボタンをクリック

### ステップ3: 設定を修正

**Configuration**セクションで：

1. **Type**: `Cloud Build configuration file (yaml or json)` を選択
2. **Location**: `cloudbuild-backend.yaml` を入力
3. **Dockerfile**フィールドが表示されている場合、**空欄にする**（`cloudbuild-backend.yaml`で既に指定済み）

### ステップ4: 保存

1. **保存**ボタンをクリック
2. 変更が反映されるまで数秒待つ

### ステップ5: 確認

1. トリガーの詳細ページで、**Configuration**が`cloudbuild-backend.yaml`になっていることを確認
2. 再度マージまたはプッシュを試す

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

## 代替方法：トリガーを再作成

もし上記の方法で修正できない場合：

1. 既存のトリガーを削除
2. 新しいトリガーを作成：
   - **Name**: `idobata-backend-asia-northeast1`
   - **Event**: `Push to a branch`
   - **Branch**: `^main$`
   - **Configuration**: `Cloud Build configuration file (yaml or json)`
   - **Location**: `cloudbuild-backend.yaml`
   - **Service account**: デフォルトのサービスアカウントを使用

## 修正後の確認

修正後、GitHubで再度マージまたはプッシュを実行してください。ビルドが成功するはずです。
