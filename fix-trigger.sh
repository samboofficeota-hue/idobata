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

echo -e "${BLUE}🔧 Fixing Cloud Build Trigger Configuration${NC}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Set project
gcloud config set project $PROJECT_ID > /dev/null 2>&1

# Get current trigger configuration
echo -e "${YELLOW}📋 Getting current trigger configuration...${NC}"
TRIGGER_CONFIG=$(gcloud builds triggers describe $TRIGGER_NAME \
  --project=$PROJECT_ID \
  --format=yaml 2>/dev/null)

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to get trigger configuration${NC}"
    exit 1
fi

# Extract repository information
REPO_NAME=$(echo "$TRIGGER_CONFIG" | grep -A 5 "github:" | grep "name:" | awk '{print $2}' | head -1)
REPO_OWNER=$(echo "$TRIGGER_CONFIG" | grep -A 5 "github:" | grep "owner:" | awk '{print $2}' | head -1)
BRANCH_PATTERN=$(echo "$TRIGGER_CONFIG" | grep -A 5 "github:" | grep "push:" | grep "branch:" | awk '{print $2}' | head -1)

if [ -z "$BRANCH_PATTERN" ]; then
    BRANCH_PATTERN="^main$"
fi

echo -e "${GREEN}✅ Found trigger configuration:${NC}"
echo -e "   Repository: $REPO_OWNER/$REPO_NAME"
echo -e "   Branch: $BRANCH_PATTERN"
echo ""

# Update trigger to use cloudbuild-backend.yaml
echo -e "${YELLOW}🔧 Updating trigger to use cloudbuild-backend.yaml...${NC}"

gcloud builds triggers update $TRIGGER_NAME \
  --project=$PROJECT_ID \
  --build-config=cloudbuild-backend.yaml \
  2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Trigger updated successfully!${NC}"
    echo ""
    echo -e "${GREEN}The trigger will now use cloudbuild-backend.yaml${NC}"
    echo -e "${GREEN}Next push to main branch should work correctly.${NC}"
else
    echo -e "${RED}❌ Failed to update trigger${NC}"
    echo ""
    echo -e "${YELLOW}You may need to update the trigger manually via Google Cloud Console:${NC}"
    echo -e "${YELLOW}  https://console.cloud.google.com/cloud-build/triggers?project=$PROJECT_ID${NC}"
    exit 1
fi
