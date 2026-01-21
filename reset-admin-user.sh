#!/bin/bash

# 初期管理者ユーザーをリセットして再作成するスクリプト

BACKEND_URL="https://idobata-backend-production.up.railway.app"

# デフォルト値（必要に応じて変更してください）
ADMIN_NAME="${1:-管理者}"
ADMIN_EMAIL="${2:-admin@example.com}"
ADMIN_PASSWORD="${3:-Admin123!@#}"

echo "=========================================="
echo "初期管理者ユーザーリセットスクリプト"
echo "=========================================="
echo ""
echo "設定値:"
echo "  名前: $ADMIN_NAME"
echo "  メールアドレス: $ADMIN_EMAIL"
echo "  パスワード: [非表示]"
echo ""

echo "1. 既存の管理者ユーザーを確認・削除"
echo "----------------------------------------"

# 既存のユーザーを削除（存在する場合）
DELETE_RESPONSE=$(curl -s -X DELETE "${BACKEND_URL}/api/auth/admin-users" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\"}" 2>/dev/null)

if echo "$DELETE_RESPONSE" | grep -q "正常に削除されました"; then
  echo "✅ 既存の管理者ユーザーを削除しました"
elif echo "$DELETE_RESPONSE" | grep -q "ユーザーが見つかりません"; then
  echo "ℹ️  既存の管理者ユーザーは存在しませんでした"
else
  echo "⚠️  ユーザー削除の結果: $DELETE_RESPONSE"
fi
echo ""

echo "2. 初期管理者ユーザーを作成（強制リセット）"
echo "----------------------------------------"

# 少し待機（データベースの更新を待つ）
sleep 2

# まず、強制リセットエンドポイントを試す（存在する場合）
RESET_RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/auth/reset" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"${ADMIN_NAME}\",\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" 2>/dev/null)

if echo "$RESET_RESPONSE" | grep -q "正常に作成されました"; then
  INIT_RESPONSE="$RESET_RESPONSE"
  echo "✅ 強制リセットエンドポイントを使用しました"
elif echo "$RESET_RESPONSE" | grep -q "404\|Not Found"; then
  # リセットエンドポイントが存在しない場合は、通常の初期化を試す
  echo "ℹ️  強制リセットエンドポイントが利用できないため、通常の初期化を試します"
  INIT_RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/auth/initialize" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"${ADMIN_NAME}\",\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" 2>/dev/null)
else
  INIT_RESPONSE="$RESET_RESPONSE"
fi

if echo "$INIT_RESPONSE" | grep -q "正常に作成されました"; then
  echo "✅ 初期管理者ユーザーを作成しました"
  echo "   レスポンス: $INIT_RESPONSE"
  echo ""
  
  echo "3. ログイン確認"
  echo "----------------------------------------"
  LOGIN_RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" \
    -w "\nHTTP_STATUS:%{http_code}")
  
  HTTP_STATUS=$(echo "$LOGIN_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
  LOGIN_BODY=$(echo "$LOGIN_RESPONSE" | grep -v "HTTP_STATUS")
  
  if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ ログイン成功！"
    echo "   管理者ユーザーは正常に作成され、ログインできることを確認しました"
    TOKEN=$(echo "$LOGIN_BODY" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    if [ -n "$TOKEN" ]; then
      echo "   トークン: ${TOKEN:0:20}..."
    fi
  else
    echo "❌ ログイン失敗 (HTTP $HTTP_STATUS)"
    echo "   レスポンス: $LOGIN_BODY"
    echo ""
    echo "   考えられる原因:"
    echo "   - PASSWORD_PEPPER環境変数が正しく設定されていない"
    echo "   - Railwayのログを確認してください"
  fi
elif echo "$INIT_RESPONSE" | grep -q "既に初期化されています"; then
  echo "⚠️  管理者ユーザーは既に初期化されています"
  echo "   既存のユーザーでログインを試してください"
  echo "   または、既存のユーザーを削除してから再実行してください"
elif echo "$INIT_RESPONSE" | grep -q "PASSWORD_PEPPER"; then
  echo "❌ PASSWORD_PEPPER環境変数のエラー"
  echo "   レスポンス: $INIT_RESPONSE"
  echo ""
  echo "   解決方法:"
  echo "   1. RailwayダッシュボードでPASSWORD_PEPPER環境変数を確認"
  echo "   2. 設定されていない場合は、ランダムな文字列を生成して設定"
else
  echo "❌ 管理者ユーザーの作成に失敗しました"
  echo "   レスポンス: $INIT_RESPONSE"
  echo ""
  echo "   Railwayのログを確認してください"
fi

echo ""
echo "=========================================="
echo "完了"
echo "=========================================="
echo ""
echo "作成された管理者ユーザー情報:"
echo "  メールアドレス: $ADMIN_EMAIL"
echo "  パスワード: [上記で指定したパスワード]"
echo ""
echo "この情報で管理画面にログインできます:"
echo "  https://idobata-admin-336788531163.asia-northeast1.run.app"
