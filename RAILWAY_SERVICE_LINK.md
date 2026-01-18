# Railwayサービスをリンクする方法

## 現在の状況

- ✅ プロジェクトはリンク済み: `idobata-backend`
- ❌ サービスがリンクされていない: `Service: None`

## 解決方法

### 方法1: 対話的にサービスをリンク（推奨）

ターミナルで以下を実行：

```bash
railway service
```

表示される選択肢から `idobata-backend` を選択してください。

### 方法2: サービスIDを直接指定

サービスIDが分かっている場合：

```bash
railway service --service <service-id>
```

## サービスをリンクした後の確認

サービスをリンクしたら、以下で状態を確認できます：

```bash
# プロジェクトの状態（サービスが表示される）
railway status

# ログを確認
railway logs

# ビルドログを確認
railway logs --build

# デプロイメントログを確認
railway logs --deployment

# 環境変数を確認
railway variables
```

## 現在の問題点

1. **サービスがリンクされていない**
   - `railway service` でサービスをリンクする必要がある
   - 対話モードが必要なため、手動で実行が必要

2. **サービスが存在しない可能性**
   - Railwayダッシュボードでサービスが作成されているか確認
   - サービスが存在しない場合は、作成する必要がある

## 次のステップ

1. **ターミナルで `railway service` を実行**
2. **`idobata-backend` サービスを選択**
3. **その後、`railway logs` でログを確認**
