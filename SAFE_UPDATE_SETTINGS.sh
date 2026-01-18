#!/bin/bash

# Cloud Run設定を安全に更新するスクリプト
# 注意: このスクリプトは、コードの修正がデプロイされた後に実行してください

set -e

SERVICE_NAME="idobata-backend"
REGION="asia-northeast1"

echo "🔍 現在のサービス状態を確認中..."
CURRENT_IMAGE=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(spec.template.spec.containers[0].image)")
echo "現在のイメージ: $CURRENT_IMAGE"

echo ""
echo "📋 現在のリソース設定を確認中..."
gcloud run services describe $SERVICE_NAME --region=$REGION --format="yaml(spec.template.spec.containers[0].resources,spec.template.spec.containerConcurrency,spec.template.metadata.annotations)" | head -20

echo ""
read -p "設定を更新しますか？ (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 更新をキャンセルしました"
    exit 1
fi

echo ""
echo "⚙️  設定を段階的に更新中..."

echo "1️⃣  最小インスタンス数を設定..."
gcloud run services update $SERVICE_NAME \
  --region=$REGION \
  --min-instances=1 \
  --quiet

echo "✅ 最小インスタンス数: 1"

echo ""
echo "2️⃣  メモリとCPUを更新..."
gcloud run services update $SERVICE_NAME \
  --region=$REGION \
  --memory=2Gi \
  --cpu=2 \
  --quiet

echo "✅ メモリ: 2Gi, CPU: 2"

echo ""
echo "3️⃣  CPUブーストを有効化..."
gcloud run services update $SERVICE_NAME \
  --region=$REGION \
  --cpu-boost \
  --quiet

echo "✅ CPUブースト: 有効"

echo ""
echo "4️⃣  最大インスタンス数を設定..."
gcloud run services update $SERVICE_NAME \
  --region=$REGION \
  --max-instances=10 \
  --quiet

echo "✅ 最大インスタンス数: 10"

echo ""
echo "🎉 設定の更新が完了しました！"
echo ""
echo "📊 更新後の設定を確認中..."
gcloud run services describe $SERVICE_NAME --region=$REGION --format="yaml(spec.template.spec.containers[0].resources,spec.template.spec.containerConcurrency)" | head -10

echo ""
echo "🔍 新しいリビジョンの状態を確認中..."
sleep 5
gcloud run revisions list --service=$SERVICE_NAME --region=$REGION --limit=3 --format="table(metadata.name,status.conditions[0].status,spec.containers[0].resources.limits.memory,spec.containers[0].resources.limits.cpu)"

echo ""
echo "✅ 完了！サービスが正常に動作しているか確認してください:"
echo "   curl https://idobata-backend-336788531163.asia-northeast1.run.app/api/health"
