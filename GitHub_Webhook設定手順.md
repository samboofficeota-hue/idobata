# GitHub Webhook設定手順

## 前提条件

- GitHubリポジトリへの管理者権限
- Cloud Buildトリガーが既に作成されていること
  - トリガーID: `28dffd8c-2614-4ed7-8256-c86d2105b17e`
  - トリガー名: `rmgpgab-idobata-backend-asia-northeast1-samboofficeota-hue-iots`

## 重要な注意点

**Cloud BuildとGitHubの連携には、通常2つの方法があります：**

1. **GitHub App連携（推奨）**: Cloud Build側でGitHubアプリを連携する方法
2. **Webhook手動設定**: GitHub側でWebhookを手動で追加する方法

**現在の状況**: トリガーは`global`リージョンに存在し、GitHubリポジトリと連携されていますが、Webhookが設定されていないため、プッシュイベントがトリガーされていません。

## 方法1: Cloud Build側でGitHub連携を確認・再設定（推奨）

### ステップ1: Cloud BuildでGitHub連携を確認

1. [Cloud Build Triggers](https://console.cloud.google.com/cloud-build/triggers?project=idobata-471403)にアクセス
2. トリガー `rmgpgab-idobata-backend-asia-northeast1-samboofficeota-hue-iots` を開く
3. **接続**セクションで、GitHubリポジトリとの接続状態を確認

### ステップ2: 接続が切れている場合

1. トリガーを編集
2. **接続**セクションで「接続を再確立」または「GitHubアプリを連携」を選択
3. GitHubで認証を許可
4. リポジトリ `samboofficeota-hue/idobata` を選択
5. 保存

## 方法2: GitHub側でWebhookを手動で追加

### ステップ1: GitHubにログイン

1. [GitHub](https://github.com)にログイン
2. リポジトリ `samboofficeota-hue/idobata` に移動

### ステップ2: Webhook設定ページにアクセス

1. リポジトリの **Settings** タブをクリック
2. 左サイドバーの **Webhooks** をクリック
3. **Add webhook** ボタンをクリック

### ステップ3: Webhookを設定

以下の情報を入力：

#### Payload URL

**重要**: Cloud BuildのWebhook URLは、通常はCloud Build側で自動生成されます。以下のいずれかを試してください：

**オプション1（推奨）**: Cloud BuildのWebhookエンドポイント
```
https://cloudbuild.googleapis.com/v1/projects/idobata-471403/webhooks/28dffd8c-2614-4ed7-8256-c86d2105b17e
```

**オプション2**: 一般的なCloud Build Webhook形式
```
https://cloudbuild.googleapis.com/v1/projects/idobata-471403/triggers/28dffd8c-2614-4ed7-8256-c86d2105b17e:webhook
```

**オプション3**: Cloud Buildが提供するWebhook URLを確認
```bash
# gcloud CLIでWebhook URLを確認
gcloud builds triggers describe rmgpgab-idobata-backend-asia-northeast1-samboofficeota-hue-iots \
  --project=idobata-471403 \
  --format="value(webhookConfig.url)"
```

#### Content type

- `application/json` を選択（推奨）
- または `application/x-www-form-urlencoded`

#### Secret

- **空欄でOK**（Cloud Buildは認証を別途処理）

#### SSL verification

- **Enable SSL verification** を選択（推奨）

#### Which events would you like to trigger this webhook?

- **Just the push event.** を選択

#### Active

- **チェックを入れる**（Webhookを有効化）

### ステップ4: Webhookを保存

1. **Add webhook** ボタンをクリック
2. Webhookが追加されたことを確認

### ステップ5: Webhookの動作確認

1. Webhook一覧で、追加したWebhookをクリック
2. **Recent Deliveries** セクションで、最新の配信履歴を確認
3. テスト用に小さな変更をコミットしてプッシュ
4. Webhookの配信履歴で、リクエストが送信されているか確認
5. [Cloud Build History](https://console.cloud.google.com/cloud-build/builds?project=idobata-471403)でビルドが開始されるか確認

## 方法3: gcloud CLIでWebhook URLを確認

```bash
# プロジェクトを設定
gcloud config set project idobata-471403

# トリガーの詳細を確認（Webhook URLが含まれている場合）
gcloud builds triggers describe rmgpgab-idobata-backend-asia-northeast1-samboofficeota-hue-iots \
  --project=idobata-471403 \
  --format=yaml | grep -i webhook
```

## トラブルシューティング

### Webhookが動作しない場合

1. **Webhook URLが正しいか確認**
   - Cloud BuildのWebhook URL形式を確認
   - トリガーIDが正しいか確認

2. **GitHubの配信履歴を確認**
   - Webhookの詳細ページで「Recent Deliveries」を確認
   - リクエストが送信されているか
   - レスポンスコードが200か

3. **Cloud Buildのログを確認**
   - [Cloud Build History](https://console.cloud.google.com/cloud-build/builds?project=idobata-471403)でビルドが開始されているか
   - エラーメッセージがないか

4. **トリガーの設定を確認**
   - ブランチパターンが `^main$` になっているか
   - 設定ファイルが `cloudbuild-backend.yaml` になっているか

## 推奨される手順

1. **まず方法1を試す**（Cloud Build側でGitHub連携を確認・再設定）
2. それでも動作しない場合、**方法2でWebhookを手動追加**
3. **方法3でWebhook URLを確認**してから設定

## 参考情報

- [Cloud Build Triggers Documentation](https://cloud.google.com/build/docs/triggers)
- [GitHub Webhooks Documentation](https://docs.github.com/en/developers/webhooks-and-events/webhooks)
