#!/bin/bash

# Cloud Run設定更新エラーの修正スクリプト

set -e

SERVICE_NAME="idobata-backend"
REGION="asia-northeast1"
FAILED_REVISION="idobata-backend-00085-54m"

echo "🔍 現在のサービス状態を確認中..."
gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)"

echo ""
echo "📋 リビジョン一覧を確認中..."
gcloud run revisions list --service=$SERVICE_NAME --region=$REGION --format="table(metadata.name,status.conditions[0].status)" --limit=5

echo ""
echo "🗑️  失敗したリビジョンを削除中: $FAILED_REVISION"
gcloud run revisions delete $FAILED_REVISION --region=$REGION --quiet || echo "⚠️  リビジョンの削除に失敗しました（既に削除されている可能性があります）"

echo ""
echo "✅ 現在動作しているリビジョンにトラフィックが送られていることを確認中..."
CURRENT_TRAFFIC=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.traffic[0].revisionName)")

if [ -n "$CURRENT_TRAFFIC" ]; then
    echo "✅ 現在のトラフィック: $CURRENT_TRAFFIC"
else
    echo "⚠️  トラフィック情報が取得できませんでした"
fi

echo ""
echo "📝 次のステップ:"
echo "1. コードの修正をコミット・プッシュしてください:"
echo "   git add ."
echo "   git commit -m 'Fix: Optimize MongoDB connection and Cloud Run settings'"
echo "   git push origin main"
echo ""
echo "2. Cloud Buildの完了を待ってください"
echo ""
echo "3. デプロイ完了後、以下のコマンドで設定を更新してください:"
echo "   gcloud run services update $SERVICE_NAME \\"
echo "     --region=$REGION \\"
echo "     --cpu-boost \\"
echo "     --min-instances=1 \\"
echo "     --max-instances=10 \\"
echo "     --memory=2Gi \\"
echo "     --cpu=2 \\"
echo "     --timeout=300"
