#!/bin/bash

# 管理者ログイン401エラーの診断スクリプト

BACKEND_URL="https://idobata-backend-production.up.railway.app"
ADMIN_EMAIL="${1:-admin@example.com}"
ADMIN_PASSWORD="${2:-Admin123!@#}"

echo "=========================================="
echo "管理者ログイン診断スクリプト"
echo "=========================================="
echo ""

echo "1. バックエンドのヘルスチェック"
echo "----------------------------------------"
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "${BACKEND_URL}/api/health" 2>/dev/null || echo "000")
if [ "$HEALTH_RESPONSE" = "200" ]; then
  echo "✅ バックエンドは正常に応答しています"
else
  echo "❌ バックエンドが応答していません (HTTP $HEALTH_RESPONSE)"
  echo "   URL: ${BACKEND_URL}/api/health"
fi
echo ""

echo "2. 初期管理者ユーザーの作成状況確認"
echo "----------------------------------------"
INIT_RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/auth/initialize" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"管理者\",\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" 2>/dev/null)

if echo "$INIT_RESPONSE" | grep -q "既に初期化されています"; then
  echo "✅ 管理者ユーザーは既に作成されています"
elif echo "$INIT_RESPONSE" | grep -q "正常に作成されました"; then
  echo "✅ 管理者ユーザーを作成しました"
  echo "   レスポンス: $INIT_RESPONSE"
else
  echo "⚠️  管理者ユーザーの作成に問題がある可能性があります"
  echo "   レスポンス: $INIT_RESPONSE"
fi
echo ""

echo "3. ログイン試行"
echo "----------------------------------------"
LOGIN_RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" \
  -w "\nHTTP_STATUS:%{http_code}")

HTTP_STATUS=$(echo "$LOGIN_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
LOGIN_BODY=$(echo "$LOGIN_RESPONSE" | grep -v "HTTP_STATUS")

if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ ログイン成功"
  echo "   レスポンス: $LOGIN_BODY"
  TOKEN=$(echo "$LOGIN_BODY" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
  if [ -n "$TOKEN" ]; then
    echo ""
    echo "4. トークン検証"
    echo "----------------------------------------"
    ME_RESPONSE=$(curl -s -X GET "${BACKEND_URL}/api/auth/me" \
      -H "Authorization: Bearer ${TOKEN}" \
      -w "\nHTTP_STATUS:%{http_code}")
    
    ME_HTTP_STATUS=$(echo "$ME_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
    ME_BODY=$(echo "$ME_RESPONSE" | grep -v "HTTP_STATUS")
    
    if [ "$ME_HTTP_STATUS" = "200" ]; then
      echo "✅ トークンは有効です"
      echo "   ユーザー情報: $ME_BODY"
    else
      echo "❌ トークンが無効です (HTTP $ME_HTTP_STATUS)"
      echo "   レスポンス: $ME_BODY"
    fi
  fi
elif [ "$HTTP_STATUS" = "401" ]; then
  echo "❌ ログイン失敗 (401 Unauthorized)"
  echo "   レスポンス: $LOGIN_BODY"
  echo ""
  echo "   考えられる原因:"
  echo "   - メールアドレスまたはパスワードが間違っている"
  echo "   - PASSWORD_PEPPER環境変数が一致していない"
  echo "   - 管理者ユーザーが存在しない"
elif [ "$HTTP_STATUS" = "500" ]; then
  echo "❌ サーバーエラー (500)"
  echo "   レスポンス: $LOGIN_BODY"
  echo ""
  echo "   考えられる原因:"
  echo "   - PASSWORD_PEPPER環境変数が設定されていない"
  echo "   - サーバー側の設定エラー"
else
  echo "❌ 予期しないエラー (HTTP $HTTP_STATUS)"
  echo "   レスポンス: $LOGIN_BODY"
fi
echo ""

echo "=========================================="
echo "診断完了"
echo "=========================================="
echo ""
echo "次のステップ:"
echo "1. RailwayのLogsタブで詳細なログを確認してください"
echo "2. ブラウザの開発者ツール（F12）でNetworkタブとConsoleタブを確認してください"
echo "3. ADMIN_LOGIN_DEBUG.md を参照して詳細なデバッグ手順を確認してください"
