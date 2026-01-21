#!/bin/bash

# Google Cloud Project ID
PROJECT_ID="idobata-471403"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Checking Secret Manager Configuration${NC}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Set project
gcloud config set project $PROJECT_ID > /dev/null 2>&1

# Required secrets based on cloudbuild.yaml
REQUIRED_SECRETS=(
    "mongodb-uri"
    "openai-api-key"
    "password-pepper"
    "jwt-secret"
)

echo -e "${YELLOW}📋 Required Secrets (from cloudbuild.yaml):${NC}"
echo ""

# Check each required secret
MISSING_SECRETS=()
EXISTING_SECRETS=()

for secret in "${REQUIRED_SECRETS[@]}"; do
    if gcloud secrets describe "$secret" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ $secret${NC} - exists"
        EXISTING_SECRETS+=("$secret")
        
        # Check if it has versions
        VERSION_COUNT=$(gcloud secrets versions list "$secret" --format="value(name)" 2>/dev/null | wc -l | tr -d ' ')
        if [ "$VERSION_COUNT" -gt 0 ]; then
            echo -e "   └─ Versions: $VERSION_COUNT"
        fi
    else
        echo -e "${RED}❌ $secret${NC} - NOT FOUND"
        MISSING_SECRETS+=("$secret")
    fi
done

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Summary
if [ ${#MISSING_SECRETS[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ All required secrets are configured!${NC}"
    echo ""
    echo -e "${GREEN}You can proceed with deployment.${NC}"
    exit 0
else
    echo -e "${RED}❌ Missing required secrets:${NC}"
    for secret in "${MISSING_SECRETS[@]}"; do
        echo -e "${RED}   - $secret${NC}"
    done
    echo ""
    echo -e "${YELLOW}To create missing secrets, run:${NC}"
    echo -e "${YELLOW}  ./setup-secrets.sh${NC}"
    echo ""
    echo -e "${YELLOW}Or create them individually:${NC}"
    for secret in "${MISSING_SECRETS[@]}"; do
        case $secret in
            "password-pepper")
                echo -e "${YELLOW}  echo -n \"your-password-pepper\" | gcloud secrets create password-pepper --data-file=-${NC}"
                ;;
            *)
                echo -e "${YELLOW}  gcloud secrets create $secret --data-file=-${NC}"
                ;;
        esac
    done
    exit 1
fi
