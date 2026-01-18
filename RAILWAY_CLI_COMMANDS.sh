#!/bin/bash

# Railway CLIでプロジェクトの状態を確認するスクリプト

PROJECT_ID="28737e38-8afa-49c4-9da3-05576dadfa78"

echo "🔐 Railway CLIにログイン中..."
echo "ブラウザが開きます。Railwayアカウントでログインしてください。"
railway login

echo ""
echo "🔗 プロジェクトにリンク中..."
railway link --project $PROJECT_ID

echo ""
echo "📊 プロジェクトの状態を確認中..."
railway status

echo ""
echo "📋 最新のログを確認中..."
railway logs --tail 50

echo ""
echo "🔍 デプロイメント一覧を確認中..."
railway deployment list

echo ""
echo "✅ 確認完了！"
