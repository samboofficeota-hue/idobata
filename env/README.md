# Environment Variables Configuration

このディレクトリには、各サービスの環境変数設定ファイルが含まれています。

## ファイル構成

- `backend.env.yaml`: バックエンドサービスの環境変数
- `frontend.env.yaml`: フロントエンドサービスの環境変数
- `python-service.env.yaml`: Pythonサービスの環境変数

## 使用方法

### Cloud Build での使用

`cloudbuild.yaml` では、これらのファイルを参照して環境変数を設定します。
Cloud Build のステップ内で一時ファイルとして作成されます。

### ローカルでの使用

`setup-backend-env.sh` などのスクリプトでは、一時ファイルを作成して `--set-env-vars-file` オプションを使用します。

### 手動での環境変数設定

```bash
# バックエンドサービスの環境変数を設定
gcloud run services update idobata-backend \
  --set-env-vars-file=env/backend.env.yaml \
  --region=asia-northeast1
```

## 環境変数の形式

YAML形式で記述します：

```yaml
KEY1: value1
KEY2: "value with spaces"
KEY3: "value,with,commas"
```

カンマを含む値（例: `IDEA_CORS_ORIGIN`）は引用符で囲む必要があります。

## 機密情報

機密情報（API キー、パスワードなど）は、これらのファイルには含めず、Google Cloud Secret Manager を使用してください。

Secret Manager の設定は `setup-secrets.sh` を参照してください。

詳細については、[Secret Manager の使用方法](../docs/SECRET_MANAGER.md) を参照してください。
