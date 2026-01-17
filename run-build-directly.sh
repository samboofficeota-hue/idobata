#!/bin/bash

# Google Cloud Project ID
PROJECT_ID="idobata-471403"
REGION="asia-northeast1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Running Cloud Build directly${NC}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Set project
gcloud config set project $PROJECT_ID > /dev/null 2>&1

# Get the latest commit SHA from main branch
echo -e "${YELLOW}📋 Getting latest commit from main branch...${NC}"
COMMIT_SHA=$(git rev-parse HEAD)
echo -e "${GREEN}Commit SHA: $COMMIT_SHA${NC}"
echo ""

# Submit build directly
echo -e "${YELLOW}🔨 Submitting build...${NC}"
gcloud builds submit \
  --config=cloudbuild-backend.yaml \
  --project=$PROJECT_ID \
  --region=$REGION \
  --source=.

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build submitted successfully!${NC}"
else
    echo -e "${RED}❌ Build submission failed${NC}"
    exit 1
fi
