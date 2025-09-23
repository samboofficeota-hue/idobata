# Idobata System - Google Cloud Run Deployment Guide

## 🎯 このドキュメントの目的

いどばたシステムをGoogle Cloud Runにデプロイするための**実践的なガイド**です。

> **⚠️ 重要**: このドキュメントは実際の本番環境構築経験に基づいて作成されています。環境変数の設定は段階的に行い、各設定後にサービスヘルスチェックを必ず実行してください。

## 📁 プロジェクト構成と開発環境

### ソースコードの管理
- **オリジナルリポジトリ**: `digitaldemocracy2030/idobata:main`
- **開発環境**: GitHubでforkしたリポジトリをCursorで編集
- **デプロイ方式**: Cursor → Docker → Google Cloud Run

### 開発・デプロイの流れ
```
GitHub (digitaldemocracy2030/idobata:main)
    ↓ fork
GitHub (your-username/idobata)
    ↓ clone
Cursor (ローカル開発環境)
    ↓ Docker build
Google Cloud Run (本番環境)
```

### この構成での注意点
- **GitHubとの同期**: オリジナルリポジトリの更新を定期的に確認
- **Cursorでの編集**: ローカル環境での変更をGitHubにプッシュ
- **Dockerビルド**: Cursorから直接Google Cloud Runにデプロイ
- **更新の管理**: オリジナルリポジトリの更新を適切に取り込む

## 📋 何をすべきか（全体の流れ）

### 1. **リポジトリのフォークとクローン** - 開始
- GitHubで`digitaldemocracy2030/idobata:main`をフォーク
- ローカル環境にクローン
- Cursorでプロジェクトを開く

### 2. **事前準備** - 必須
- Google Cloud プロジェクトの準備
- 必要なAPIキーの取得
- Dockerfileの修正（**最重要**）

### 3. **段階的デプロイ** - 順序が重要
- バックエンド → フロントエンド → 管理画面 → Python Service

### 4. **環境変数の段階的設定** - クラッシュ回避のため
- 2-3個ずつ設定、各設定後に30秒待機
- ヘルスチェックを必ず実行

### 5. **認証システムの設定** - 最後に実行
- PASSWORD_PEPPER → JWT_SECRET → 管理者ユーザー初期化

### 6. **動作確認とメンテナンス** - 継続
- 全サービスの動作確認
- オリジナルリポジトリの更新管理

## 🚨 何から始めるか（優先順位）

### **第1優先: Dockerfileの修正**
**理由**: 修正しないとデプロイが失敗する

```bash
# 修正が必要なファイル
- idea-discussion/backend/Dockerfile
- frontend/Dockerfile  
- admin/Dockerfile
- python-service/Dockerfile
```

### **第2優先: バックエンドのデプロイ**
**理由**: 他のサービスが依存するため

### **第3優先: 環境変数の段階的設定**
**理由**: 一度に設定するとクラッシュする

## ❌ 何をしてはいけないか（絶対禁止）

### **環境変数関連**
- ❌ 一度に5個以上の環境変数を設定する
- ❌ 環境変数設定後にヘルスチェックをスキップする
- ❌ クラッシュしたまま次の設定に進む

### **Dockerfile関連**
- ❌ ビルドコンテキストを考慮せずにCOPYコマンドを書く
- ❌ フロントエンド・管理画面でVITE_API_BASE_URLを設定し忘れる

### **認証関連**
- ❌ PASSWORD_PEPPER設定前に管理者ユーザーを初期化する
- ❌ PASSWORD_PEPPER変更後に管理者ユーザーを再初期化しない

### **CORS関連**
- ❌ 本番URLをCORS設定に追加せずにデプロイする

## 🔴 最重要ポイント（必ず守る）

### 1. **環境変数は段階的に設定する**
- 一度に2-3個まで
- 各設定後に30秒待機
- ヘルスチェックを必ず実行

### 2. **Dockerfileの修正が必須**
- ビルドコンテキストに応じてCOPYコマンドを修正
- 相対パスを明示的に指定

### 3. **CORS設定の重要性**
- 本番環境のURLを事前にCORS設定に追加

### 4. **認証システムの設定順序**
- PASSWORD_PEPPER → JWT_SECRET → 管理者ユーザー再初期化

## ⚠️ 何度も問題が起きがちなポイント（重要度順）

#### 1. **環境変数の設定順序とタイミング** 🔴 最重要
**問題**: 環境変数を一度に大量設定するとサービスがクラッシュする
**発生頻度**: ほぼ毎回
**対策**:
- 必ず段階的に設定（2-3個ずつ）
- 各設定後に30秒待機
- ヘルスチェックを必ず実行
- クラッシュした場合は環境変数をリセットして再設定

#### 2. **DockerfileのCOPYコマンド** 🔴 最重要
**問題**: ビルドコンテキストに応じたパス指定を忘れる
**発生頻度**: 初回デプロイ時必ず
**対策**:
- ルートディレクトリからビルドする場合、相対パスを明示的に指定
- `COPY package.json ./` → `COPY frontend/package.json ./`
- `COPY . .` → `COPY frontend/ .`

#### 3. **CORS設定の本番URL追加** 🟡 重要
**問題**: 本番環境のURLがCORS設定に含まれていない
**発生頻度**: フロントエンド・管理画面デプロイ後
**対策**:
- デプロイ前に本番URLをCORS設定に追加
- フロントエンドと管理画面の両方のURLを設定
- デプロイ後にCORSエラーが発生したら即座に修正

#### 4. **PASSWORD_PEPPERの設定忘れ** 🟡 重要
**問題**: 認証システムでPASSWORD_PEPPERが未設定
**発生頻度**: 認証機能実装時
**対策**:
- 環境変数設定時にPASSWORD_PEPPERを必ず含める
- 管理者ユーザー初期化前にPASSWORD_PEPPERを設定
- 認証エラーが発生したらPASSWORD_PEPPERの設定を確認

#### 5. **VITE_API_BASE_URLの設定** 🟡 重要
**問題**: フロントエンド・管理画面でAPI呼び出しが失敗
**発生頻度**: フロントエンド・管理画面デプロイ後
**対策**:
- Dockerfileに`ENV VITE_API_BASE_URL=...`を追加
- ビルド時に環境変数が設定されるようにする
- デプロイ後にAPI呼び出しエラーが発生したら即座に修正

## 前提条件

### 開発環境
1. **GitHubアカウント**: オリジナルリポジトリをforkするため
2. **Cursor**: ローカル開発環境として使用
3. **Git**: バージョン管理のため

### デプロイ環境
1. **Google Cloud アカウント**: 有効なGoogle Cloudアカウント
2. **gcloud CLI**: Google Cloud CLIがインストールされていること
3. **Docker**: Dockerがインストールされていること
4. **API Keys**: 以下のAPIキーが必要
   - OpenAI API Key
   - OpenRouter API Key
   - MongoDB Atlas URI (またはMongoDB接続文字列)

### 初期セットアップ手順

#### 1. GitHubでのフォーク
1. [digitaldemocracy2030/idobata](https://github.com/digitaldemocracy2030/idobata)にアクセス
2. 右上の「Fork」ボタンをクリック
3. 自分のアカウントにフォークが作成される

#### 2. ローカル環境へのクローン
```bash
# フォークしたリポジトリをクローン
git clone https://github.com/your-username/idobata.git
cd idobata

# オリジナルリポジトリをupstreamとして追加
git remote add upstream https://github.com/digitaldemocracy2030/idobata.git
```

#### 3. Cursorでの開発環境準備
```bash
# Cursorでプロジェクトを開く
# 必要な依存関係をインストール
npm install

# 各サービスの依存関係もインストール
cd frontend && npm install && cd ..
cd admin && npm install && cd ..
cd idea-discussion/backend && npm install && cd ../..
cd policy-edit/frontend && npm install && cd ../..
cd policy-edit/backend && npm install && cd ../..
cd python-service && pip install -r requirements.txt && cd ..
```

#### 4. ローカル環境での動作確認
```bash
# Docker Composeでローカル環境を起動
docker-compose up -d

# 各サービスの動作確認
# フロントエンド: http://localhost:5173
# 管理画面: http://localhost:5175
# バックエンドAPI: http://localhost:3000
```

## 段階的デプロイ手順（実践版）

### 0. フォークからGCR実装までの全体フロー

```
1. GitHubでフォーク
   ↓
2. ローカルにクローン
   ↓
3. Cursorで開発環境準備
   ↓
4. ローカル環境で動作確認
   ↓
5. Google Cloud プロジェクト準備
   ↓
6. Dockerfile修正
   ↓
7. 段階的デプロイ
   ↓
8. 環境変数設定
   ↓
9. 認証システム設定
   ↓
10. 動作確認・メンテナンス
```

### 1. Google Cloud プロジェクトの準備

```bash
# Google Cloudにログイン
gcloud auth login

# プロジェクトを作成（または既存のプロジェクトを選択）
gcloud projects create your-project-id
gcloud config set project your-project-id

# 必要なAPIを有効化
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable sqladmin.googleapis.com
```

### 2. Dockerfileの修正（必須）

本番環境では、ビルドコンテキストに応じてDockerfileを修正する必要があります。

#### 2.1 バックエンドDockerfileの修正

`idea-discussion/backend/Dockerfile`:
```dockerfile
# 修正前（エラーになる）
COPY package.json ./
COPY . .

# 修正後（正しい）
COPY idea-discussion/backend/package.json ./
COPY idea-discussion/backend/ .
```

#### 2.2 フロントエンドDockerfileの修正

`frontend/Dockerfile`:
```dockerfile
# 修正前
COPY package*.json ./
COPY . .

# 修正後
COPY frontend/package*.json ./
COPY frontend/ .

# 追加: Rollup依存関係の問題を解決
RUN rm -rf node_modules package-lock.json && npm install

# 追加: ビルド時の環境変数設定
ENV VITE_API_BASE_URL=https://idobata-backend-336788531163.asia-northeast1.run.app
```

#### 2.3 管理画面Dockerfileの修正

`admin/Dockerfile`:
```dockerfile
# 修正前
COPY package*.json ./
COPY . .

# 修正後
COPY admin/package*.json ./
COPY admin/ .

# 追加: ビルド時の環境変数設定
ENV VITE_API_BASE_URL=https://idobata-backend-336788531163.asia-northeast1.run.app
```

#### 2.4 Python Service Dockerfileの修正

`python-service/Dockerfile`:
```dockerfile
# 修正前
COPY requirements.txt .
COPY . .

# 修正後
COPY python-service/requirements.txt .
COPY python-service/ .
```

### 3. サービスデプロイ（段階的）

#### 3.1 バックエンドのデプロイ

```bash
# バックエンドイメージをビルド・プッシュ
cd idea-discussion/backend
gcloud builds submit --tag gcr.io/idobata-471403/idobata-backend

# バックエンドサービスをデプロイ
gcloud run deploy idobata-backend \
  --image gcr.io/idobata-471403/idobata-backend \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --port 8080
```

#### 3.2 環境変数の段階的設定

**⚠️ 重要**: 環境変数は一度に設定せず、段階的に設定してください。

```bash
# 第1段階: 基本環境変数
gcloud run services update idobata-backend \
  --set-env-vars="MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true,PASSWORD_PEPPER=your-password-pepper-here" \
  --region=asia-northeast1

# ヘルスチェック
curl -s https://idobata-backend-336788531163.asia-northeast1.run.app/api/health

# 30秒待機
sleep 30

# 第2段階: JWT設定
gcloud run services update idobata-backend \
  --set-env-vars="MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true,PASSWORD_PEPPER=your-password-pepper-here,JWT_SECRET=your-jwt-secret-key-here,JWT_EXPIRES_IN=24h" \
  --region=asia-northeast1

# ヘルスチェック
curl -s https://idobata-backend-336788531163.asia-northeast1.run.app/api/health

# 30秒待機
sleep 30

# 第3段階: AI機能設定
gcloud run services update idobata-backend \
  --set-env-vars="MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true,PASSWORD_PEPPER=your-password-pepper-here,JWT_SECRET=your-jwt-secret-key-here,JWT_EXPIRES_IN=24h,OPENROUTER_API_KEY=your-openrouter-api-key-here,PYTHON_SERVICE_URL=https://idobata-python-doisltwsmq-an.a.run.app" \
  --region=asia-northeast1

# ヘルスチェック
curl -s https://idobata-backend-336788531163.asia-northeast1.run.app/api/health

# 30秒待機
sleep 30

# 第4段階: その他設定
gcloud run services update idobata-backend \
  --set-env-vars="MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true,PASSWORD_PEPPER=your-password-pepper-here,JWT_SECRET=your-jwt-secret-key-here,JWT_EXPIRES_IN=24h,OPENROUTER_API_KEY=your-openrouter-api-key-here,PYTHON_SERVICE_URL=https://idobata-python-doisltwsmq-an.a.run.app,API_BASE_URL=https://idobata-backend-336788531163.asia-northeast1.run.app,ALLOW_DELETE_THEME=true" \
  --region=asia-northeast1

# 最終ヘルスチェック
curl -s https://idobata-backend-336788531163.asia-northeast1.run.app/api/health
```

#### 3.3 フロントエンドのデプロイ

```bash
# フロントエンドイメージをビルド・プッシュ
cd frontend
gcloud builds submit --tag gcr.io/idobata-471403/idobata-frontend

# フロントエンドサービスをデプロイ
gcloud run deploy idobata-frontend \
  --image gcr.io/idobata-471403/idobata-frontend \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --port 80
```

#### 3.4 管理画面のデプロイ

```bash
# 管理画面イメージをビルド・プッシュ
cd admin
gcloud builds submit --tag gcr.io/idobata-471403/idobata-admin

# 管理画面サービスをデプロイ
gcloud run deploy idobata-admin \
  --image gcr.io/idobata-471403/idobata-admin \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --port 80
```

#### 3.5 Python Serviceのデプロイ

```bash
# Python Serviceイメージをビルド・プッシュ
cd python-service
gcloud builds submit --tag gcr.io/idobata-471403/idobata-python-service

# Python Serviceをデプロイ
gcloud run deploy idobata-python-service \
  --image gcr.io/idobata-471403/idobata-python-service \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --port 8080
```

### 4. CORS設定の修正

本番環境では、CORS設定に本番URLを含める必要があります。

`idea-discussion/backend/server.js`の修正:
```javascript
// CORS設定を更新
app.use(
  cors({
    origin: process.env.IDEA_CORS_ORIGIN
      ? process.env.IDEA_CORS_ORIGIN.split(",").map((url) => url.trim())
      : [
          "http://localhost:5173",
          "http://localhost:5175",
          "https://idobata-frontend-336788531163.asia-northeast1.run.app",
          "https://idobata-admin-336788531163.asia-northeast1.run.app",
          "https://idobata-admin-doisltwsmq-an.a.run.app", // 管理画面の実際のURL
        ],
    credentials: true,
  })
);
```

### 5. 管理者ユーザーの初期化

環境変数設定完了後、管理者ユーザーを初期化します。

```bash
# 既存の管理者ユーザーを削除（必要に応じて）
curl -X DELETE https://idobata-backend-336788531163.asia-northeast1.run.app/api/auth/admin-users

# 管理者ユーザーを初期化
curl -X POST https://idobata-backend-336788531163.asia-northeast1.run.app/api/auth/initialize \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"SecurePassword123","name":"Admin User"}'
```

## チェックリスト

### デプロイ完了後の確認項目

- [ ] フロントエンドが正常に表示される
- [ ] 管理画面にログインできる
- [ ] バックエンドAPIが正常に応答する
- [ ] ヘルスチェックエンドポイントが正常
- [ ] CORS設定が正しく動作する
- [ ] 環境変数がすべて設定されている
- [ ] 管理者ユーザーが正常に初期化されている

### よくある問題の事前チェック

#### 環境変数関連
- [ ] 環境変数が段階的に設定されている
- [ ] PASSWORD_PEPPERが設定されている
- [ ] JWT_SECRETが設定されている
- [ ] MONGODB_URIが設定されている
- [ ] ローカル用.envファイルが削除されている

#### Dockerfile関連
- [ ] バックエンドDockerfileのCOPYコマンドが修正されている
- [ ] フロントエンドDockerfileのCOPYコマンドが修正されている
- [ ] 管理画面DockerfileのCOPYコマンドが修正されている
- [ ] Python Service DockerfileのCOPYコマンドが修正されている
- [ ] VITE_API_BASE_URLがDockerfileに設定されている

#### CORS関連
- [ ] 本番環境のURLがCORS設定に含まれている
- [ ] フロントエンドのURLがCORS設定に含まれている
- [ ] 管理画面のURLがCORS設定に含まれている

#### 認証関連
- [ ] 管理者ユーザーが正しく初期化されている
- [ ] PASSWORD_PEPPER設定後に管理者ユーザーを再初期化している
- [ ] 認証エラーが発生していない

## トラブルシューティング

### よくある問題と解決方法

1. **認証エラー**

   ```bash
   gcloud auth login
   gcloud auth application-default login
   ```

2. **API有効化エラー**

   ```bash
   gcloud services enable [API_NAME]
   ```

3. **Docker認証エラー**

   ```bash
   gcloud auth configure-docker
   ```

4. **exec format error（アーキテクチャエラー）**

   ```bash
   # 解決方法: プラットフォームを明示的に指定
   gcloud builds submit --tag gcr.io/PROJECT_ID/SERVICE_NAME --platform linux/amd64
   ```

5. **Cannot find module '/app/server.js'（ファイルパスエラー）**

   **原因**: DockerfileのCOPYコマンドが間違っている
   **解決方法**: ビルドコンテキストに応じてCOPYコマンドを修正

6. **MONGODB_URI is not defined（環境変数エラー）**

   **原因**: 環境変数が設定されていない
   **解決方法**: 段階的に環境変数を設定

7. **CORS policy error（CORSエラー）**

   **原因**: 本番URLがCORS設定に含まれていない
   **解決方法**: `server.js`のCORS設定に本番URLを追加

8. **401 Unauthorized（認証エラー）**

   **原因**: PASSWORD_PEPPERが設定されていない、または管理者ユーザーが正しく初期化されていない
   **解決方法**: 
   ```bash
   # PASSWORD_PEPPERを設定
   gcloud run services update idobata-backend --set-env-vars="PASSWORD_PEPPER=your-pepper" --region=asia-northeast1
   
   # 管理者ユーザーを再初期化
   curl -X DELETE https://your-backend-url/api/auth/admin-users
   curl -X POST https://your-backend-url/api/auth/initialize -H "Content-Type: application/json" -d '{"email":"admin@example.com","password":"SecurePassword123","name":"Admin User"}'
   ```

9. **サービスがクラッシュする**

   **原因**: 環境変数を一度に大量設定した
   **解決方法**: 段階的に環境変数を設定し、各設定後にヘルスチェックを実行

10. **フロントエンドでAPI呼び出しエラー**

    **原因**: VITE_API_BASE_URLが設定されていない
    **解決方法**: Dockerfileに`ENV VITE_API_BASE_URL=...`を追加

### デバッグコマンド

```bash
# サービス状況確認
gcloud run services list --region=asia-northeast1

# サービス詳細確認
gcloud run services describe SERVICE_NAME --region=asia-northeast1

# ログ確認
gcloud logging read "resource.type=cloud_run_revision" --limit 50

# ヘルスチェック
curl -s https://your-backend-url/api/health
```

## 本番環境URL一覧

構築完了後の本番環境URL:

- **フロントエンド**: https://idobata-frontend-336788531163.asia-northeast1.run.app
- **管理画面**: https://idobata-admin-doisltwsmq-an.a.run.app
- **バックエンドAPI**: https://idobata-backend-336788531163.asia-northeast1.run.app
- **Python Service**: https://idobata-python-doisltwsmq-an.a.run.app

## 管理者ログイン情報

- **URL**: https://idobata-admin-doisltwsmq-an.a.run.app
- **メール**: admin@example.com
- **パスワード**: SecurePassword123

## 実装時の注意事項

### 必ず守るべきルール

1. **環境変数設定時**
   - 一度に3個以上の環境変数を設定しない
   - 各設定後に30秒待機する
   - ヘルスチェックを必ず実行する
   - クラッシュした場合は環境変数をリセットして再設定する

2. **Dockerfile修正時**
   - ビルドコンテキストを確認してからCOPYコマンドを修正する
   - 相対パスを明示的に指定する
   - フロントエンド・管理画面にはVITE_API_BASE_URLを設定する

3. **CORS設定時**
   - 本番環境のURLを事前にCORS設定に追加する
   - フロントエンドと管理画面の両方のURLを設定する
   - デプロイ後にCORSエラーが発生したら即座に修正する

4. **認証システム設定時**
   - PASSWORD_PEPPERを最初に設定する
   - 管理者ユーザー初期化前にPASSWORD_PEPPERを設定する
   - PASSWORD_PEPPER変更後は管理者ユーザーを再初期化する

### 時間短縮のコツ

- **事前準備**: Dockerfileの修正はデプロイ前に完了させる
- **段階的デプロイ**: バックエンド → フロントエンド → 管理画面 → Python Serviceの順序
- **並行作業**: 環境変数設定中に他のDockerfileを修正する
- **ログ確認**: 問題発生時は即座にログを確認する

## GitHubとの連携

### オリジナルリポジトリとの同期
```bash
# オリジナルリポジトリをリモートに追加
git remote add upstream https://github.com/digitaldemocracy2030/idobata.git

# オリジナルの最新変更を取得
git fetch upstream

# 最新の変更をマージ（必要に応じて）
git merge upstream/main
```

### 変更の管理
```bash
# 変更をコミット
git add .
git commit -m "本番環境構築のための修正"

# GitHubにプッシュ
git push origin main
```

### オリジナルリポジトリの更新対応

#### 更新の確認方法
```bash
# オリジナルリポジトリの最新情報を取得
git fetch upstream

# 現在のブランチとオリジナルの差分を確認
git log HEAD..upstream/main --oneline

# 詳細な変更内容を確認
git diff HEAD..upstream/main
```

#### 更新の取り込み手順

**⚠️ 重要**: 本番環境で稼働中の場合は、更新前にバックアップを取ってください。

1. **現在の変更を保存**
   ```bash
   # 現在の変更をコミット
   git add .
   git commit -m "更新前の状態を保存"
   
   # 現在の状態をGitHubにプッシュ
   git push origin main
   ```

2. **オリジナルの更新を確認**
   ```bash
   # オリジナルの最新変更を取得
   git fetch upstream
   
   # 変更内容を確認
   git log HEAD..upstream/main --oneline
   ```

3. **更新の取り込み**
   ```bash
   # マージ（推奨）
   git merge upstream/main
   
   # または、リベース（上級者向け）
   git rebase upstream/main
   ```

4. **競合の解決**
   ```bash
   # 競合が発生した場合
   git status
   
   # 競合ファイルを編集して解決
   # その後、競合を解決
   git add .
   git commit -m "競合を解決"
   ```

5. **更新後の確認**
   ```bash
   # ローカルでテスト
   npm install
   npm run dev
   
   # 問題なければGitHubにプッシュ
   git push origin main
   ```

6. **本番環境への反映**
   ```bash
   # 更新されたコードを本番環境にデプロイ
   # 各サービスの再デプロイが必要な場合があります
   ```

#### 更新時の注意点

**Dockerfileの変更があった場合**
- 本番環境のDockerfileが更新されている可能性があります
- 既存の修正（COPYコマンドの修正など）が上書きされる可能性があります
- 更新後は必ずDockerfileの内容を確認し、必要に応じて再修正してください

**環境変数の変更があった場合**
- 新しい環境変数が追加されている可能性があります
- 既存の環境変数名が変更されている可能性があります
- 更新後は環境変数の設定を確認してください

**依存関係の変更があった場合**
- package.jsonが更新されている可能性があります
- 新しい依存関係が追加されている可能性があります
- 更新後は`npm install`を実行してください

#### 更新の頻度
- **推奨**: 月1回程度の定期確認
- **重要更新時**: セキュリティ更新や重要な機能追加時は即座に対応
- **本番環境更新前**: 必ずローカル環境でテストを実行

### この構成での利点
- **バージョン管理**: すべての変更がGitHubで追跡可能
- **協力開発**: 複数人での開発が容易
- **バックアップ**: コードの安全な保管
- **履歴管理**: 変更履歴の完全な記録
- **更新の追跡**: オリジナルリポジトリの更新を適切に管理

## 完全な実装フロー（フォークからGCRまで）

### ステップ1: リポジトリの準備
```bash
# 1. GitHubでフォーク
# https://github.com/digitaldemocracy2030/idobata にアクセスしてフォーク

# 2. ローカルにクローン
git clone https://github.com/your-username/idobata.git
cd idobata

# 3. upstreamを追加
git remote add upstream https://github.com/digitaldemocracy2030/idobata.git
```

### ステップ2: 開発環境の構築
```bash
# 4. 依存関係のインストール
npm install
cd frontend && npm install && cd ..
cd admin && npm install && cd ..
cd idea-discussion/backend && npm install && cd ../..
cd policy-edit/frontend && npm install && cd ../..
cd policy-edit/backend && npm install && cd ../..
cd python-service && pip install -r requirements.txt && cd ..

# 5. ローカル環境での動作確認
docker-compose up -d
```

### ステップ3: Google Cloud の準備
```bash
# 6. Google Cloud プロジェクトの準備
gcloud auth login
gcloud projects create your-project-id
gcloud config set project your-project-id

# 7. 必要なAPIを有効化
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### ステップ4: Dockerfileの修正
```bash
# 8. 各Dockerfileを修正（必須）
# - idea-discussion/backend/Dockerfile
# - frontend/Dockerfile
# - admin/Dockerfile
# - python-service/Dockerfile
```

### ステップ5: 段階的デプロイ
```bash
# 9. バックエンドのデプロイ
cd idea-discussion/backend
gcloud builds submit --tag gcr.io/your-project-id/idobata-backend
gcloud run deploy idobata-backend --image gcr.io/your-project-id/idobata-backend --platform managed --region asia-northeast1 --allow-unauthenticated --port 8080

# 10. 環境変数の段階的設定
# （詳細は上記の「環境変数の段階的設定」セクションを参照）

# 11. フロントエンドのデプロイ
cd frontend
gcloud builds submit --tag gcr.io/your-project-id/idobata-frontend
gcloud run deploy idobata-frontend --image gcr.io/your-project-id/idobata-frontend --platform managed --region asia-northeast1 --allow-unauthenticated --port 80

# 12. 管理画面のデプロイ
cd admin
gcloud builds submit --tag gcr.io/your-project-id/idobata-admin
gcloud run deploy idobata-admin --image gcr.io/your-project-id/idobata-admin --platform managed --region asia-northeast1 --allow-unauthenticated --port 80

# 13. Python Serviceのデプロイ
cd python-service
gcloud builds submit --tag gcr.io/your-project-id/idobata-python-service
gcloud run deploy idobata-python-service --image gcr.io/your-project-id/idobata-python-service --platform managed --region asia-northeast1 --allow-unauthenticated --port 8080
```

### ステップ6: 最終設定
```bash
# 14. 管理者ユーザーの初期化
curl -X POST https://your-backend-url/api/auth/initialize \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"SecurePassword123","name":"Admin User"}'

# 15. 動作確認
# 各サービスのURLにアクセスして動作確認
```

### ステップ7: 継続的なメンテナンス
```bash
# 16. オリジナルリポジトリの更新確認
git fetch upstream
git log HEAD..upstream/main --oneline

# 17. 必要に応じて更新を取り込み
git merge upstream/main
```

## 更新履歴

- **2025-09-20**: 実践的な本番環境構築ノウハウを追加
- **2025-09-20**: 段階的環境変数設定手順を追加
- **2025-09-20**: トラブルシューティング情報を大幅に拡充
- **2025-09-20**: 何度も問題が起きがちなポイントを重要度順に整理・追加
- **2025-09-20**: 事前チェックリストを追加
- **2025-09-20**: 初回読者向けに構造を整理・最適化
- **2025-09-20**: GitHub fork構成とCursor開発環境の情報を追加
- **2025-09-20**: オリジナルリポジトリの更新対応手順を詳細に追加
- **2025-09-20**: フォークからGCR実装までの完全なフローを追加