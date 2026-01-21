#!/bin/bash

# Google Cloud Project ID
PROJECT_ID="idobata-471403"
REGION="asia-northeast1"
SERVICE_NAME="idobata-backend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔑 Setting up OpenAI API Key for Backend Service${NC}"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo -e "${YELLOW}⚠️  Please authenticate with gcloud first:${NC}"
    echo "gcloud auth login"
    exit 1
fi

# Set project
echo -e "${YELLOW}📋 Setting project to $PROJECT_ID${NC}"
gcloud config set project $PROJECT_ID

# Check if OpenAI API key is provided
if [ -z "$1" ]; then
    echo -e "${YELLOW}⚠️  Please provide your OpenAI API key as an argument:${NC}"
    echo "Usage: $0 <your-openai-api-key>"
    echo ""
    echo "Example:"
    echo "  $0 sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    echo ""
    echo "You can get your OpenAI API key from: https://platform.openai.com/api-keys"
    exit 1
fi

OPENAI_API_KEY="$1"

# Function to check service health
check_health() {
    local url="https://idobata-backend-336788531163.asia-northeast1.run.app/api/health"
    echo -e "${YELLOW}🔍 Checking service health...${NC}"
    
    if curl -s -f "$url" > /dev/null; then
        echo -e "${GREEN}✅ Service is healthy${NC}"
        return 0
    else
        echo -e "${RED}❌ Service is not responding${NC}"
        return 1
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    echo -e "${YELLOW}⏳ Waiting 30 seconds for service to stabilize...${NC}"
    sleep 30
}

# Update the service with OpenAI API key
echo -e "${YELLOW}🔑 Setting OpenAI API key...${NC}"
gcloud run services update $SERVICE_NAME \
  --set-env-vars="OPENAI_API_KEY=$OPENAI_API_KEY" \
  --region=$REGION

wait_for_service
check_health

echo -e "${GREEN}✅ OpenAI API key has been set successfully!${NC}"
echo -e "${GREEN}🌐 Backend service URL: https://idobata-backend-336788531163.asia-northeast1.run.app${NC}"

echo -e "${YELLOW}⚠️  Next steps:${NC}"
echo -e "${YELLOW}1. Test the chat functionality in your frontend${NC}"
echo -e "${YELLOW}2. Check the backend logs if there are any issues:${NC}"
echo -e "${YELLOW}   gcloud logging read \"resource.type=cloud_run_revision\" --limit 50${NC}"
echo -e "${YELLOW}3. Verify the API key is working by checking the service logs${NC}"
echo -e "${YELLOW}4. The default model is now GPT-5-mini (gpt-5-mini)${NC}"
