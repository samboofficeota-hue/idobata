# Idobata System - Google Cloud Run Deployment Guide

## 概要

いどばたシステムをGoogle Cloud Runにデプロイするためのガイドです。

## 前提条件

1. **Google Cloud アカウント**: 有効なGoogle Cloudアカウント
2. **gcloud CLI**: Google Cloud CLIがインストールされていること
3. **Docker**: Dockerがインストールされていること
4. **API Keys**: 以下のAPIキーが必要
   - OpenAI API Key
   - OpenRouter API Key
   - MongoDB Atlas URI (またはMongoDB接続文字列)

## デプロイ手順

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

### 2. 環境変数とシークレットの設定

```bash
# シークレット設定スクリプトを実行
./setup-secrets.sh
```

このスクリプトで以下のシークレットを作成します：

- `mongodb-uri`: MongoDB接続文字列
- `openai-api-key`: OpenAI APIキー
- `openrouter-api-key`: OpenRouter APIキー
- `jwt-secret`: JWT署名用シークレット

### 3. デプロイの実行

```bash
# デプロイスクリプトを実行
./deploy.sh
```

### 4. データベースの設定

#### MongoDB Atlas

1. [MongoDB Atlas](https://www.mongodb.com/atlas)でアカウント作成
2. クラスターを作成
3. データベースユーザーを作成
4. 接続文字列を取得してシークレットに設定

#### Cloud SQL (PostgreSQL)

```bash
# Cloud SQLインスタンスを作成
gcloud sql instances create idobata-postgres \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region=asia-northeast1

# データベースを作成
gcloud sql databases create policy_db --instance=idobata-postgres

# ユーザーを作成
gcloud sql users create postgres --instance=idobata-postgres --password=your-password
```

## アーキテクチャ

```
┌─────────────────┐    ┌─────────────────┐
│   Cloud Run     │    │   Cloud Run     │
│  (Frontend)     │    │  (Admin)        │
│  Port: 80       │    │  Port: 80       │
└─────────────────┘    └─────────────────┘
         │                       │
         └───────────┬───────────┘
                     │
         ┌─────────────────────────┐
         │      Cloud Run          │
         │   (Backend API)         │
         │   Port: 8080            │
         └─────────────────────────┘
                     │
         ┌─────────────────────────┐
         │      Cloud Run          │
         │   (Python Service)      │
         │   Port: 8080            │
         └─────────────────────────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
┌───▼───┐      ┌─────▼─────┐    ┌─────▼─────┐
│MongoDB│      │  Cloud    │    │  Cloud    │
│Atlas  │      │  Storage  │    │  Build    │
│       │      │  (Static) │    │  (CI/CD)  │
└───────┘      └───────────┘    └───────────┘
```

## サービス構成

### フロントエンド (idobata-frontend)

- **技術**: React + Vite + Nginx
- **ポート**: 80
- **公開**: 認証不要
- **リソース**: CPU 0.5-1, Memory 256Mi-512Mi

### 管理画面 (idobata-admin)

- **技術**: React + Vite + Nginx
- **ポート**: 80
- **公開**: 認証不要
- **リソース**: CPU 0.5-1, Memory 256Mi-512Mi

### バックエンドAPI (idobata-backend)

- **技術**: Node.js + Express
- **ポート**: 8080
- **公開**: 認証不要
- **リソース**: CPU 1-2, Memory 512Mi-1Gi
- **環境変数**: MongoDB URI, JWT Secret, OpenRouter API Key

### Python Service (idobata-python-service)

- **技術**: Python + FastAPI
- **ポート**: 8080
- **公開**: 認証不要
- **リソース**: CPU 1-2, Memory 1Gi-2Gi
- **環境変数**: OpenAI API Key

## カスタマイズ

### プロジェクトIDの変更

`deploy.sh`と`setup-secrets.sh`の`PROJECT_ID`変数を変更してください。

### リージョンの変更

`deploy.sh`の`REGION`変数を変更してください。

### リソース制限の変更

各サービスの`deploy/*-service.yaml`ファイルでリソース制限を調整できます。

## トラブルシューティング

### よくある問題

1. **認証エラー**

   ```bash
   gcloud auth login
   gcloud auth application-default login
   ```

2. **API有効化エラー**

   ```bash
   gcloud services enable [API_NAME]
   ```

3. **シークレットアクセスエラー**

   ```bash
   gcloud secrets add-iam-policy-binding [SECRET_NAME] \
     --member="serviceAccount:[PROJECT_NUMBER]-compute@developer.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"
   ```

4. **Docker認証エラー**

   ```bash
   gcloud auth configure-docker
   ```

## コスト最適化

- **最小インスタンス数**: 0に設定（コールドスタートあり）
- **最大インスタンス数**: 必要に応じて調整
- **CPU割り当て**: リクエスト時のみ
- **メモリ**: 必要最小限に設定

## 監視とログ

- **Cloud Logging**: 自動でログが収集される
- **Cloud Monitoring**: メトリクスとアラートを設定可能
- **Cloud Trace**: 分散トレーシング

## セキュリティ

- **HTTPS**: 自動でHTTPS化
- **シークレット管理**: Google Secret Manager使用
- **IAM**: 最小権限の原則
- **ネットワーク**: VPC設定可能

## 更新とメンテナンス

```bash
# 新しいバージョンをデプロイ
./deploy.sh

# 特定のサービスのみ更新
gcloud run deploy [SERVICE_NAME] --image gcr.io/[PROJECT_ID]/[IMAGE_NAME]
```

## サポート

問題が発生した場合は、以下を確認してください：

1. Google Cloud Console のログ
2. Cloud Run のメトリクス
3. シークレットの設定
4. ネットワーク接続

詳細なログは以下で確認できます：

```bash
gcloud logging read "resource.type=cloud_run_revision" --limit 50
```
