# 管理画面ログインガイド

## 現在の状況

Railwayに移行したため、管理画面のAPI URLが変更されました。

- **バックエンドURL**: `https://idobata-backend-production.up.railway.app`
- **ログインエンドポイント**: `/api/auth/login`

## ログイン方法

### 1. 管理画面にアクセス

管理画面のURLにアクセスします：
- Cloud Run: `https://idobata-admin-336788531163.asia-northeast1.run.app`
- カスタムドメイン: `https://idobata-admin.sambo-office.com`（設定されている場合）

### 2. ログインページ

ログインページが表示されます。以下の情報を入力してください：

- **メールアドレス**: 管理者のメールアドレス
- **パスワード**: 管理者のパスワード

### 3. ログイン実行

「ログイン」ボタンをクリックしてログインします。

## 管理者アカウントが存在しない場合

管理者アカウントがまだ作成されていない場合は、初期管理者ユーザーを作成する必要があります。

### 方法1: APIエンドポイントを使用（推奨）

以下のコマンドで初期管理者ユーザーを作成できます：

```bash
curl -X POST https://idobata-backend-production.up.railway.app/api/auth/initialize \
  -H "Content-Type: application/json" \
  -d '{
    "name": "管理者",
    "email": "admin@example.com",
    "password": "your-secure-password"
  }'
```

**注意**: 
- 管理者ユーザーが既に存在する場合、このエンドポイントは403エラーを返します
- パスワードは強力なものを使用してください
- メールアドレスは一意である必要があります

### 方法2: Railwayのログを確認

既存の管理者アカウントのメールアドレスを確認する場合、Railwayのログを確認できます：

1. Railwayダッシュボードにアクセス
2. バックエンドサービスを選択
3. 「Logs」タブを開く
4. 管理者ユーザー作成時のログを確認

## トラブルシューティング

### ログインできない場合

1. **CORSエラーの確認**
   - ブラウザの開発者ツール（F12）で「Console」タブを開く
   - CORSエラーが表示されていないか確認
   - RailwayのバックエンドのCORS設定に管理画面のURLが含まれているか確認

2. **API URLの確認**
   - 管理画面のビルド時に `VITE_API_BASE_URL` が正しく設定されているか確認
   - 現在の設定: `https://idobata-backend-production.up.railway.app`

3. **ネットワークエラーの確認**
   - ブラウザの開発者ツール（F12）で「Network」タブを開く
   - `/api/auth/login` へのリクエストが失敗していないか確認
   - エラーメッセージを確認

4. **認証情報の確認**
   - メールアドレスとパスワードが正しいか確認
   - パスワードに特殊文字が含まれている場合、正しく入力されているか確認

### よくあるエラー

#### エラー: "認証情報が無効です"
- メールアドレスまたはパスワードが間違っています
- 管理者アカウントが存在しない可能性があります

#### エラー: "認証に失敗しました"
- サーバー側のエラーが発生している可能性があります
- Railwayのログを確認してください

#### エラー: CORS policy
- RailwayのバックエンドのCORS設定に管理画面のURLが含まれていない可能性があります
- `IDEA_CORS_ORIGIN` 環境変数を確認してください

## RailwayのCORS設定確認

Railwayダッシュボードで以下の環境変数を確認してください：

```
IDEA_CORS_ORIGIN=https://idobata-frontend-336788531163.asia-northeast1.run.app,https://idobata-admin-336788531163.asia-northeast1.run.app,https://idobata-admin-doisltwsmq-an.a.run.app,https://idobata.sambo-office.com,https://idobata-admin.sambo-office.com
```

管理画面のURLが含まれていることを確認してください。

## 管理者アカウントの管理

### 新しい管理者アカウントの作成

ログイン後、管理画面から新しい管理者アカウントを作成できます：

1. 管理画面にログイン
2. ユーザー管理セクションに移動
3. 「新規ユーザー作成」をクリック
4. 必要な情報を入力して作成

### 管理者アカウントの削除

管理者アカウントを削除する場合：

```bash
curl -X DELETE https://idobata-backend-production.up.railway.app/api/auth/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "email": "user@example.com"
  }'
```

## セキュリティに関する注意事項

1. **パスワードの強度**: 強力なパスワードを使用してください
2. **HTTPS**: 本番環境では必ずHTTPSを使用してください
3. **トークンの管理**: ログアウト後はブラウザのローカルストレージからトークンが削除されます
4. **定期的なパスワード変更**: セキュリティのため、定期的にパスワードを変更してください

## サポート

ログインに関する問題が解決しない場合は、以下を確認してください：

1. Railwayのバックエンドログ
2. ブラウザの開発者ツールのエラーメッセージ
3. ネットワーク接続の状態
