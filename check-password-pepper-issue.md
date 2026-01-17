# password-pepper の問題と解決方法

## 問題の説明

`password-pepper` を新しく作成しましたが、既存の管理者ユーザー（`demo@dd2030.org`）のパスワードハッシュは**古い`PASSWORD_PEPPER`の値**で作成されています。

パスワードの検証は以下のように行われます：

```javascript
// パスワード保存時（AdminUser.js 46行目）
const pepperPassword = this.password + process.env.PASSWORD_PEPPER;
const hash = bcrypt.hash(pepperPassword, salt);

// パスワード検証時（AdminUser.js 59行目）
const pepperPassword = candidatePassword + process.env.PASSWORD_PEPPER;
return bcrypt.compare(pepperPassword, this.password);
```

**つまり、`PASSWORD_PEPPER`が変わると、既存のパスワードが検証できなくなります。**

## 解決方法

### 方法1: 既存の`PASSWORD_PEPPER`の値を使用する（推奨）

既存の`PASSWORD_PEPPER`の値が分かれば、その値でSecret Managerのシークレットを更新します：

```bash
# 既存の値を確認（もし環境変数として設定されていれば）
# または、以前の設定ファイルから確認

# Secret Managerのシークレットを更新
echo -n "既存のPASSWORD_PEPPERの値" | gcloud secrets versions add password-pepper --data-file=-
```

### 方法2: 既存の管理者ユーザーを削除して再作成

既存のユーザーを削除し、新しい`password-pepper`で再初期化します：

```bash
# 1. 既存の管理者ユーザーを削除（MongoDBから直接、またはAPI経由）
# 2. 管理者ユーザーを再初期化
curl -X POST https://idobata-backend-336788531163.asia-northeast1.run.app/api/auth/initialize \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@dd2030.org",
    "password": "idobata2030",
    "name": "Demo Admin"
  }'
```

### 方法3: 現在の設定を確認

現在のCloud Runサービスで使用されている`PASSWORD_PEPPER`の値を確認：

```bash
gcloud run services describe idobata-backend \
  --region=asia-northeast1 \
  --format="value(spec.template.spec.containers[0].env)"
```

## 推奨される手順

1. **既存の`PASSWORD_PEPPER`の値を確認**
   - 以前の環境変数設定から確認
   - または、現在のCloud Runサービスの環境変数から確認

2. **既存の値が見つかった場合**
   - Secret Managerの`password-pepper`を既存の値で更新

3. **既存の値が見つからない場合**
   - 既存の管理者ユーザーを削除
   - 新しい`password-pepper`で再初期化

## 確認方法

現在のログインが動作するか確認：

```bash
curl -X POST https://idobata-backend-336788531163.asia-northeast1.run.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@dd2030.org",
    "password": "idobata2030"
  }'
```

もし認証エラーが発生する場合は、上記の解決方法を試してください。
