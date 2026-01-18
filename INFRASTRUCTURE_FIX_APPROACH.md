# インフラ設定による根本的解決アプローチ

## 問題の本質

コード修正を繰り返しても解決しない → **インフラ設定レベルでの解決が必要**

## アプローチ1: Google Cloud Runのスタートアッププローブ設定（最優先）

### 現在の問題
- デフォルトのTCPプローブ: 240秒のタイムアウト
- サーバーが起動する前にタイムアウト
- HTTPプローブに変更して、より柔軟な設定が必要

### 解決方法: HTTPスタートアッププローブの設定

#### 方法A: gcloudコマンドで直接設定

```bash
gcloud run services update idobata-backend \
  --region=asia-northeast1 \
  --startup-probe httpGet.path=/api/health,httpGet.port=8080,initialDelaySeconds=0,periodSeconds=10,timeoutSeconds=5,failureThreshold=24
```

**設定の説明**:
- `httpGet.path=/api/health`: ヘルスチェックエンドポイント
- `httpGet.port=8080`: ポート番号
- `initialDelaySeconds=0`: 即座にプローブ開始
- `periodSeconds=10`: 10秒ごとにプローブ
- `timeoutSeconds=5`: 各プローブのタイムアウト5秒
- `failureThreshold=24`: 最大24回失敗まで許容（24×10秒=240秒）

#### 方法B: YAMLファイルで設定

`deploy/backend-service.yaml`を更新：

```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: idobata-backend
  annotations:
    run.googleapis.com/ingress: all
spec:
  template:
    metadata:
      annotations:
        run.googleapis.com/execution-environment: gen2
        run.googleapis.com/startup-cpu-boost: "true"
    spec:
      containers:
      - image: gcr.io/idobata-471403/idobata-backend
        ports:
        - containerPort: 8080
        startupProbe:
          httpGet:
            path: /api/health
            port: 8080
          initialDelaySeconds: 0
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 24  # 最大240秒待機
        env:
        - name: PORT
          value: "8080"
        # ... 他の環境変数 ...
        resources:
          limits:
            cpu: "2"
            memory: "2Gi"
          requests:
            cpu: "1"
            memory: "1Gi"
      minScale: 1
      maxScale: 10
      serviceAccountName: idobata-backend-sa
```

YAMLファイルでデプロイ：

```bash
gcloud run services replace deploy/backend-service.yaml --region=asia-northeast1
```

## アプローチ2: MongoDB Atlas側の設定変更

### 接続文字列の最適化

MongoDB Atlas → Database → Connect → Drivers で接続文字列を取得し、以下のパラメータを追加：

```
mongodb+srv://user:pass@cluster.mongodb.net/dbname?srvMaxHosts=3&connectTimeoutMS=30000&serverSelectionTimeoutMS=10000&socketTimeoutMS=45000&maxPoolSize=10&minPoolSize=2&maxIdleTimeMS=60000&retryWrites=true&retryReads=true
```

### MongoDB Atlasの接続プール設定

1. **接続数の監視**: MongoDB Atlas → Metrics → Connections
2. **接続数の上限確認**: M0 (Free tier) は最大500接続
3. **必要に応じてクラスターをアップグレード**: M10以上にアップグレード

## アプローチ3: 完全に別のデプロイ方法

### オプションA: Railway.app

**利点**:
- シンプルなデプロイ（Git pushで自動デプロイ）
- 内蔵データベース（MongoDBが簡単にセットアップ可能）
- 柔軟なタイムアウト設定
- プライベートネットワーク

**手順**:
1. Railway.appにアカウント作成
2. 新しいプロジェクト作成
3. GitHubリポジトリを接続
4. MongoDBサービスを追加
5. Node.jsサービスを追加
6. 環境変数を設定
7. 自動デプロイ

**設定ファイル**: `railway.json`（既に作成済み）

### オプションB: Cloudflare Workers/Pages

**利点**:
- エッジコンピューティング（グローバルに低遅延）
- 無料枠が充実
- 自動スケーリング

**注意点**:
- Node.jsの一部APIが制限される
- MongoDB接続には外部サービス（MongoDB Atlas）が必要
- WebSocket（Socket.io）はDurable Objectsが必要

### オプションC: GitHub Actions + 自前サーバー

**利点**:
- 完全な制御
- カスタム設定が可能

**手順**:
1. GitHub ActionsでCI/CDを設定
2. 自前のサーバー（VPS、EC2など）にデプロイ
3. Nginxでリバースプロキシ設定

## アプローチ4: アーキテクチャの見直し

### 問題の根本原因

現在のアーキテクチャ:
```
Cloud Run → MongoDB Atlas（外部接続）
```

### 改善案

#### 案1: データベース接続を非同期化

サーバーを即座に起動し、データベース接続はバックグラウンドで行う（既に実装済み）

#### 案2: ヘルスチェックエンドポイントの分離

- `/api/health`: サーバーが起動していることを即座に返す（データベース接続を待たない）
- `/api/ready`: データベース接続が完了していることを返す

#### 案3: コネクションプーリングの最適化

- 接続プールを事前に作成
- ウォームアップスクリプトを実行

## 推奨される実行順序

### ステップ1: スタートアッププローブをHTTPに変更（最優先）

```bash
gcloud run services update idobata-backend \
  --region=asia-northeast1 \
  --startup-probe httpGet.path=/api/health,httpGet.port=8080,initialDelaySeconds=0,periodSeconds=10,timeoutSeconds=5,failureThreshold=24
```

### ステップ2: MongoDB Atlasの接続文字列を最適化

MongoDB Atlas → Database → Connect → Drivers で接続文字列を更新

### ステップ3: 動作確認

```bash
# ヘルスチェック
curl https://idobata-backend-336788531163.asia-northeast1.run.app/api/health

# ログを確認
gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=idobata-backend"
```

### ステップ4: 解決しない場合、別のデプロイ方法を検討

- Railway.appへの移行
- Cloudflare Workers/Pagesへの移行
- 自前サーバーへの移行

## 重要なポイント

⚠️ **コード修正ではなく、インフラ設定で解決する**

1. **スタートアッププローブの設定**: HTTPプローブに変更してタイムアウトを延長
2. **MongoDB Atlasの設定**: 接続文字列を最適化
3. **別のデプロイ方法**: 問題が解決しない場合は、完全に別のプラットフォームを検討
