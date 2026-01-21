#!/bin/bash

# すべての管理者ユーザーを削除してから初期管理者ユーザーを作成するスクリプト

BACKEND_URL="https://idobata-backend-production.up.railway.app"

# デフォルト値（必要に応じて変更してください）
ADMIN_NAME="${1:-管理者}"
ADMIN_EMAIL="${2:-admin@example.com}"
ADMIN_PASSWORD="${3:-Admin123!@#}"

echo "=========================================="
echo "強制リセット: 初期管理者ユーザー作成"
echo "=========================================="
echo ""
echo "⚠️  警告: すべての管理者ユーザーが削除されます"
echo ""
echo "設定値:"
echo "  名前: $ADMIN_NAME"
echo "  メールアドレス: $ADMIN_EMAIL"
echo "  パスワード: [非表示]"
echo ""

read -p "続行しますか？ (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "キャンセルしました"
  exit 1
fi

echo ""
echo "1. すべての管理者ユーザーを削除"
echo "----------------------------------------"

DELETE_ALL_RESPONSE=$(curl -s -X DELETE "${BACKEND_URL}/api/auth/admin-users/all" \
  -H "Content-Type: application/json" 2>/dev/null)

if echo "$DELETE_ALL_RESPONSE" | grep -q "削除しました"; then
  DELETED_COUNT=$(echo "$DELETE_ALL_RESPONSE" | grep -o '[0-9]*人の管理者' | grep -o '[0-9]*')
  echo "✅ ${DELETED_COUNT}人の管理者ユーザーを削除しました"
elif echo "$DELETE_ALL_RESPONSE" | grep -q "404\|Not Found"; then
  echo "ℹ️  削除エンドポイントが利用できないため、個別に削除を試みます"
  # 個別削除を試みる（複数のメールアドレスを試す）
  for email in "admin@example.com" "Admin@example.com" "ADMIN@EXAMPLE.COM"; do
    curl -s -X DELETE "${BACKEND_URL}/api/auth/admin-users" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"${email}\"}" > /dev/null 2>&1
  done
  echo "ℹ️  個別削除を試みました"
else
  echo "⚠️  削除の結果: $DELETE_ALL_RESPONSE"
fi

echo ""
echo "2. 少し待機（データベースの更新を待つ）"
sleep 3

echo ""
echo "3. 初期管理者ユーザーを作成"
echo "----------------------------------------"

INIT_RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/auth/initialize" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"${ADMIN_NAME}\",\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" 2>/dev/null)

if echo "$INIT_RESPONSE" | grep -q "正常に作成されました"; then
  echo "✅ 初期管理者ユーザーを作成しました"
  echo "   レスポンス: $INIT_RESPONSE"
  echo ""
  
  echo "4. ログイン確認"
  echo "----------------------------------------"
  sleep 2
  
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
  fi
elif echo "$INIT_RESPONSE" | grep -q "既に初期化されています"; then
  echo "❌ まだ管理者ユーザーが存在しているようです"
  echo "   Railwayのログを確認してください"
  echo "   または、データベースを直接確認してください"
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
fi

echo ""
echo "=========================================="
echo "完了"
echo "=========================================="
