#!/bin/bash

# Cloud Buildの進行状況を監視するスクリプト

BUILD_ID="8b443077-a399-4f1f-ba78-b04f7d52ad1a"

echo "🔍 Cloud Buildの進行状況を監視中..."
echo "ビルドID: $BUILD_ID"
echo ""

while true; do
    STATUS=$(gcloud builds describe $BUILD_ID --format="value(status)" 2>/dev/null)
    
    if [ "$STATUS" = "SUCCESS" ]; then
        echo "✅ ビルドが成功しました！"
        echo ""
        echo "📊 デプロイされたリビジョンを確認中..."
        gcloud run revisions list \
            --service=idobata-backend \
            --region=asia-northeast1 \
            --limit=3 \
            --format="table(metadata.name,status.conditions[0].status,metadata.creationTimestamp)"
        echo ""
        echo "🔍 ヘルスチェックをテスト:"
        echo "curl https://idobata-backend-336788531163.asia-northeast1.run.app/api/health"
        break
    elif [ "$STATUS" = "FAILURE" ] || [ "$STATUS" = "CANCELLED" ] || [ "$STATUS" = "TIMEOUT" ]; then
        echo "❌ ビルドが失敗しました: $STATUS"
        echo ""
        echo "📋 ログを確認:"
        echo "gcloud builds log $BUILD_ID"
        break
    else
        echo "⏳ ビルド進行中... ($STATUS)"
        sleep 10
    fi
done
