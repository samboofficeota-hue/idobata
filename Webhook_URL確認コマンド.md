# Webhook URL確認コマンド

## 現在の状況

`grep -i webhook`の結果が空だったため、Webhook URLが設定されていないか、別の形式で保存されている可能性があります。

## 確認コマンド

### 1. トリガーの詳細全体を確認

```bash
# トリガーの詳細をすべて表示
gcloud builds triggers describe rmgpgab-idobata-backend-asia-northeast1-samboofficeota-hue-iots \
  --project=idobata-471403 \
  --format=yaml
```

### 2. GitHub連携の状態を確認

```bash
# GitHub関連の情報を確認
gcloud builds triggers describe rmgpgab-idobata-backend-asia-northeast1-samboofficeota-hue-iots \
  --project=idobata-471403 \
  --format=yaml | grep -A 10 github
```

### 3. Webhook設定を確認

```bash
# Webhook設定があるか確認（複数の形式を試す）
gcloud builds triggers describe rmgpgab-idobata-backend-asia-northeast1-samboofficeota-hue-iots \
  --project=idobata-471403 \
  --format=yaml | grep -E "(webhook|webhookConfig|url)"
```

## 重要なポイント

Cloud BuildのトリガーがGitHubと連携する場合、通常は以下の2つの方法があります：

1. **GitHub App連携（推奨）**: Cloud Build側でGitHubアプリを連携する方法
   - この場合、Webhook URLは自動的に設定される
   - GitHub側でWebhookを手動で追加する必要はない

2. **Webhook手動設定**: GitHub側でWebhookを手動で追加する方法
   - この場合、Webhook URLを確認してGitHubに設定する必要がある

## 次のステップ

### オプション1: Cloud Build側でGitHub連携を確認

1. [Cloud Build Triggers](https://console.cloud.google.com/cloud-build/triggers?project=idobata-471403)にアクセス
2. トリガー `rmgpgab-idobata-backend-asia-northeast1-samboofficeota-hue-iots` を開く
3. **接続**セクションで、GitHubリポジトリとの接続状態を確認
4. 接続が切れている場合、「接続を再確立」をクリック

### オプション2: Webhook URLを生成

Webhook URLが存在しない場合、以下の形式で生成できます：

```
https://cloudbuild.googleapis.com/v1/projects/idobata-471403/webhooks/28dffd8c-2614-4ed7-8256-c86d2105b17e
```

このURLをGitHubのWebhook設定で使用してください。

### オプション3: トリガーを再作成

既存のトリガーを削除して再作成することで、GitHub連携を再設定：

```bash
# 既存のトリガーを削除
gcloud builds triggers delete rmgpgab-idobata-backend-asia-northeast1-samboofficeota-hue-iots \
  --project=idobata-471403

# 新しいトリガーを作成（GitHub App連携を使用）
gcloud builds triggers create github \
  --name="idobata-backend-asia-northeast1" \
  --project=idobata-471403 \
  --repo-name=idobata \
  --repo-owner=samboofficeota-hue \
  --branch-pattern="^main$" \
  --build-config=cloudbuild-backend.yaml \
  --service-account=projects/idobata-471403/serviceAccounts/336788531163-compute@developer.gserviceaccount.com
```

## 推奨される手順

1. **まず、トリガーの詳細全体を確認**（上記コマンド1を実行）
2. **GitHub連携の状態を確認**（上記コマンド2を実行）
3. **Cloud Build Consoleで接続状態を確認**
4. **接続が切れている場合、接続を再確立**
5. **それでも動作しない場合、Webhook URLを生成してGitHubに追加**
