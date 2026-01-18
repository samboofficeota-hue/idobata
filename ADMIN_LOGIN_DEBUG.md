# 管理者ログイン401エラー デバッグガイド

## 現在の状況
- ✅ Railwayに環境変数が設定済み（PASSWORD_PEPPER、JWT_SECRET）
- ✅ 初期管理者ユーザーの作成（curl）も実行済み
- ❌ ログイン時に401エラーが発生

## デバッグ手順

### ステップ1: ブラウザの開発者ツールで確認

1. **管理画面にアクセス**
   - URL: `https://idobata-admin-336788531163.asia-northeast1.run.app` またはカスタムドメイン

2. **開発者ツールを開く**
   - F12キーを押す
   - 「Console」タブと「Network」タブを開く

3. **ログインを試行**
   - メールアドレスとパスワードを入力
   - 「ログイン」ボタンをクリック

4. **Consoleタブで確認**
   - 以下のログが表示されるはずです：
     ```
     [AuthContext] Attempting login for: [メールアドレス]
     [AuthContext] API Base URL: [URL]
     [ApiClient] Request: { url: ..., method: "POST", ... }
     [ApiClient] Response: { status: 401, ... }
     [ApiClient] Error response: { status: 401, message: "...", ... }
     ```
   - **エラーメッセージを確認**してください

5. **Networkタブで確認**
   - `/api/auth/login` へのリクエストを探す
   - リクエストの詳細を確認：
     - **Request URL**: 正しいURLか確認
     - **Request Headers**: `Content-Type: application/json` が含まれているか
     - **Request Payload**: メールアドレスとパスワードが正しく送信されているか
     - **Response**: エラーメッセージの内容を確認

### ステップ2: Railwayのログを確認

1. **Railwayダッシュボードにアクセス**
   - バックエンドサービスを選択
   - 「Logs」タブを開く

2. **ログイン試行時のログを確認**
   - 以下のようなログが表示されるはずです：
     ```
     [AuthController] Login attempt: { email: "...", hasPassword: true, ... }
     [AuthController] PASSWORD_PEPPER is set: true
     [LocalAuthProvider] Authenticating user: ...
     [LocalAuthProvider] User found: ...
     [LocalAuthProvider] Password comparison result: false
     [LocalAuthProvider] Password mismatch for user: ...
     ```
   - **どの段階でエラーが発生しているか**を確認してください

### ステップ3: よくある原因と解決方法

#### 原因1: API URLが間違っている

**症状**:
- Networkタブでリクエストが失敗している
- CORSエラーが表示される

**確認方法**:
- Consoleタブで `[AuthContext] API Base URL:` の値を確認
- 正しい値: `https://idobata-backend-production.up.railway.app`

**解決方法**:
- 管理画面のDockerfileで `VITE_API_BASE_URL` が正しく設定されているか確認
- 再ビルド・再デプロイが必要な場合があります

#### 原因2: CORSエラー

**症状**:
- Consoleタブに `CORS policy` エラーが表示される
- Networkタブでリクエストが `OPTIONS` で失敗している

**確認方法**:
- Railwayの環境変数 `IDEA_CORS_ORIGIN` を確認
- 管理画面のURLが含まれているか確認

**解決方法**:
- Railwayの環境変数 `IDEA_CORS_ORIGIN` に管理画面のURLを追加
- 例: `https://idobata-admin-336788531163.asia-northeast1.run.app`

#### 原因3: パスワードが一致しない

**症状**:
- Railwayのログに `Password mismatch` が表示される
- 401エラーで「パスワードが正しくありません」というメッセージ

**確認方法**:
- Railwayのログで `[LocalAuthProvider] Password comparison result: false` を確認
- 初期管理者ユーザー作成時のメールアドレスとパスワードを確認

**解決方法**:
1. 初期管理者ユーザーを再作成：
   ```bash
   curl -X POST https://idobata-backend-production.up.railway.app/api/auth/initialize \
     -H "Content-Type: application/json" \
     -d '{
       "name": "管理者",
       "email": "admin@example.com",
       "password": "Admin123!@#"
     }'
   ```
2. 既存の管理者ユーザーを削除してから再作成する必要がある場合：
   - MongoDBに直接アクセスして削除するか
   - 管理者ユーザーが存在しないことを確認してから再作成

#### 原因4: PASSWORD_PEPPERが一致しない

**症状**:
- Railwayのログに `PASSWORD_PEPPER` 関連のエラーが表示される
- 500エラーが返される

**確認方法**:
- Railwayの環境変数 `PASSWORD_PEPPER` の値を確認
- 初期管理者ユーザー作成時と同じ値が設定されているか確認

**解決方法**:
- `PASSWORD_PEPPER` を変更した場合、既存の管理者ユーザーを削除して再作成する必要があります
- または、既存の `PASSWORD_PEPPER` の値を使用する

#### 原因5: ユーザーが存在しない

**症状**:
- Railwayのログに `User not found` が表示される
- 401エラーで「ユーザーが見つかりません」というメッセージ

**確認方法**:
- Railwayのログで `[LocalAuthProvider] User not found:` を確認
- メールアドレスが正しいか確認（大文字小文字を区別）

**解決方法**:
- 初期管理者ユーザーを作成：
   ```bash
   curl -X POST https://idobata-backend-production.up.railway.app/api/auth/initialize \
     -H "Content-Type: application/json" \
     -d '{
       "name": "管理者",
       "email": "admin@example.com",
       "password": "Admin123!@#"
     }'
   ```

### ステップ4: 詳細なログの確認

修正後のコードでは、以下の詳細なログが出力されます：

**フロントエンド（ブラウザのConsole）**:
- `[AuthContext] Attempting login for: [email]`
- `[AuthContext] API Base URL: [url]`
- `[ApiClient] Request: { ... }`
- `[ApiClient] Response: { ... }`
- `[ApiClient] Error response: { ... }`

**バックエンド（RailwayのLogs）**:
- `[AuthController] Login attempt: { email, hasPassword, ... }`
- `[AuthController] PASSWORD_PEPPER is set: true/false`
- `[LocalAuthProvider] Authenticating user: [email]`
- `[LocalAuthProvider] User found: [email]`
- `[LocalAuthProvider] Password comparison result: true/false`

これらのログを確認することで、問題の原因を特定できます。

## チェックリスト

ログインできない場合、以下を確認してください：

- [ ] ブラウザのConsoleタブでエラーメッセージを確認
- [ ] Networkタブでリクエストの詳細を確認
- [ ] RailwayのLogsでバックエンドのログを確認
- [ ] API URLが正しいか確認（`VITE_API_BASE_URL`）
- [ ] CORS設定に管理画面のURLが含まれているか確認
- [ ] `PASSWORD_PEPPER` 環境変数が設定されているか確認
- [ ] 初期管理者ユーザーが作成されているか確認
- [ ] メールアドレスとパスワードが正しいか確認

## 次のステップ

1. 上記の手順に従って、ブラウザの開発者ツールとRailwayのログを確認
2. エラーメッセージの内容を確認
3. 該当する原因の解決方法を実行
4. それでも解決しない場合は、ログの内容を共有してください
