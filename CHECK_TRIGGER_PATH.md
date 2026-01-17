# Cloud Build トリガーのパス設定確認

## 問題

エラーメッセージ：`File cloudbuild-backend.yaml not found`

## 原因

Cloud Buildトリガーの設定で、ファイルパスの指定方法が間違っている可能性があります。

## 解決方法

### Google Cloud Consoleで確認・修正

1. [Cloud Build Triggers](https://console.cloud.google.com/cloud-build/triggers?project=idobata-471403)にアクセス
2. トリガー `rmgpgab-idobata-backend-asia-northeast1-samboofficeota-hue-iots` を開く
3. **編集**ボタンをクリック
4. **Configuration**セクションで以下を確認：

#### 重要な設定

**Location**セクションで：
- **Repository** が選択されていることを確認
- **Cloud Build configuration file location** フィールドで：
  - ❌ `/cloudbuild-backend.yaml` （先頭のスラッシュあり）
  - ✅ `cloudbuild-backend.yaml` （先頭のスラッシュなし）

**注意**: リポジトリ内のファイルを参照する場合、先頭のスラッシュは**不要**です。

### もし先頭のスラッシュが必須の場合

Google Cloud Consoleの設定で先頭のスラッシュが自動的に追加される場合、以下のいずれかを試してください：

1. **Location**で「Repository」ではなく「Cloud Storage bucket」を選択（通常は不要）
2. 設定を一度リセットして再設定
3. トリガーを再作成

## 確認事項

1. ファイルがリポジトリにコミットされているか
   ```bash
   git log --oneline -1 -- cloudbuild-backend.yaml
   ```

2. ファイルがmainブランチにあるか
   ```bash
   git branch --contains $(git rev-parse HEAD) -- cloudbuild-backend.yaml
   ```

3. ファイルの内容が正しいか
   - `images`セクションが含まれているか
   - YAML構文が正しいか

## 推奨される設定

**Configuration**セクション：
- **Type**: `Cloud Build configuration file (yaml or json)`
- **Location**: `Repository`
- **Cloud Build configuration file location**: `cloudbuild-backend.yaml` （先頭のスラッシュなし）
