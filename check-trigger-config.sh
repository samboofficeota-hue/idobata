#!/bin/bash

# Google Cloud Project ID
PROJECT_ID="idobata-471403"
TRIGGER_NAME="rmgpgab-idobata-backend-asia-northeast1-samboofficeota-hue-iots"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Checking Cloud Build Trigger Configuration${NC}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Set project
gcloud config set project $PROJECT_ID > /dev/null 2>&1

# Get trigger configuration
echo -e "${YELLOW}📋 Current trigger configuration:${NC}"
echo ""

TRIGGER_CONFIG=$(gcloud builds triggers describe $TRIGGER_NAME \
  --project=$PROJECT_ID 2>/dev/null)

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Trigger not found or access denied${NC}"
    echo ""
    echo -e "${YELLOW}Available triggers:${NC}"
    gcloud builds triggers list --project=$PROJECT_ID
    exit 1
fi

echo "$TRIGGER_CONFIG" | grep -E "(name:|buildConfigFile:|dockerfile:|substitutions:)" || echo "$TRIGGER_CONFIG"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if cloudbuild-backend.yaml exists
if [ -f "cloudbuild-backend.yaml" ]; then
    echo -e "${GREEN}✅ cloudbuild-backend.yaml exists${NC}"
    echo ""
    echo -e "${YELLOW}Content:${NC}"
    cat cloudbuild-backend.yaml
else
    echo -e "${RED}❌ cloudbuild-backend.yaml not found${NC}"
fi

echo ""
echo -e "${YELLOW}💡 To fix the trigger, run:${NC}"
echo -e "${YELLOW}  gcloud builds triggers update $TRIGGER_NAME \\${NC}"
echo -e "${YELLOW}    --project=$PROJECT_ID \\${NC}"
echo -e "${YELLOW}    --build-config=cloudbuild-backend.yaml${NC}"
