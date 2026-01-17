#!/bin/bash

# Google Cloud Project ID
PROJECT_ID="idobata-471403"
REGION="asia-northeast1"
SERVICE_NAME="idobata-backend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Checking current PASSWORD_PEPPER configuration${NC}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Set project
gcloud config set project $PROJECT_ID > /dev/null 2>&1

# Check current environment variables
echo -e "${YELLOW}📋 Current environment variables in Cloud Run service:${NC}"
echo ""

ENV_VARS=$(gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --format="value(spec.template.spec.containers[0].env)" 2>/dev/null)

if [ -z "$ENV_VARS" ]; then
    echo -e "${YELLOW}⚠️  No environment variables found (or service not found)${NC}"
    echo ""
    echo -e "${YELLOW}Checking secrets configuration...${NC}"
    
    SECRETS=$(gcloud run services describe $SERVICE_NAME \
      --region=$REGION \
      --format="value(spec.template.spec.containers[0].env[?(@.valueFrom.secretKeyRef)])" 2>/dev/null)
    
    if echo "$SECRETS" | grep -q "password-pepper"; then
        echo -e "${GREEN}✅ password-pepper is configured as a secret${NC}"
        echo ""
        echo -e "${YELLOW}Current secret value:${NC}"
        gcloud secrets versions access latest --secret="password-pepper" 2>/dev/null | head -c 50
        echo "..."
    else
        echo -e "${RED}❌ password-pepper is not configured${NC}"
    fi
else
    echo "$ENV_VARS" | grep -i "PASSWORD_PEPPER" || echo -e "${YELLOW}⚠️  PASSWORD_PEPPER not found in environment variables${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test login
echo -e "${YELLOW}🧪 Testing login with demo@dd2030.org...${NC}"
echo ""

LOGIN_RESPONSE=$(curl -s -X POST https://idobata-backend-336788531163.asia-northeast1.run.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@dd2030.org",
    "password": "idobata2030"
  }')

if echo "$LOGIN_RESPONSE" | grep -q "token"; then
    echo -e "${GREEN}✅ Login successful! Current password-pepper is working.${NC}"
    echo ""
    echo -e "${GREEN}No action needed. The current configuration is correct.${NC}"
else
    echo -e "${RED}❌ Login failed!${NC}"
    echo ""
    echo -e "${YELLOW}Response:${NC}"
    echo "$LOGIN_RESPONSE" | head -5
    echo ""
    echo -e "${YELLOW}⚠️  This might be because:${NC}"
    echo -e "${YELLOW}  1. password-pepper was changed and existing password hash doesn't match${NC}"
    echo -e "${YELLOW}  2. The user doesn't exist${NC}"
    echo -e "${YELLOW}  3. The password is incorrect${NC}"
    echo ""
    echo -e "${YELLOW}Solution:${NC}"
    echo -e "${YELLOW}  If password-pepper was changed, you need to:${NC}"
    echo -e "${YELLOW}  1. Delete the existing admin user${NC}"
    echo -e "${YELLOW}  2. Re-initialize with the new password-pepper${NC}"
fi
