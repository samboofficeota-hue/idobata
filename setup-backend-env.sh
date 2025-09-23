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

echo -e "${GREEN}🔧 Setting up Backend Environment Variables for Cloud Run${NC}"

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

# Step 1: Basic environment variables
echo -e "${YELLOW}📝 Step 1: Setting basic environment variables${NC}"
gcloud run services update $SERVICE_NAME \
  --set-env-vars="MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true,PASSWORD_PEPPER=your-password-pepper-here" \
  --region=$REGION

wait_for_service
check_health

# Step 2: JWT configuration
echo -e "${YELLOW}📝 Step 2: Setting JWT configuration${NC}"
gcloud run services update $SERVICE_NAME \
  --set-env-vars="MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true,PASSWORD_PEPPER=your-password-pepper-here,JWT_SECRET=your-jwt-secret-key-here,JWT_EXPIRES_IN=24h" \
  --region=$REGION

wait_for_service
check_health

# Step 3: AI functionality
echo -e "${YELLOW}📝 Step 3: Setting AI functionality${NC}"
gcloud run services update $SERVICE_NAME \
  --set-env-vars="MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true,PASSWORD_PEPPER=your-password-pepper-here,JWT_SECRET=your-jwt-secret-key-here,JWT_EXPIRES_IN=24h,OPENAI_API_KEY=your-openai-api-key-here,PYTHON_SERVICE_URL=https://idobata-python-doisltwsmq-an.a.run.app" \
  --region=$REGION

wait_for_service
check_health

# Step 4: Additional configuration
echo -e "${YELLOW}📝 Step 4: Setting additional configuration${NC}"
gcloud run services update $SERVICE_NAME \
  --set-env-vars="MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true,PASSWORD_PEPPER=your-password-pepper-here,JWT_SECRET=your-jwt-secret-key-here,JWT_EXPIRES_IN=24h,OPENAI_API_KEY=your-openai-api-key-here,PYTHON_SERVICE_URL=https://idobata-python-doisltwsmq-an.a.run.app,API_BASE_URL=https://idobata-backend-336788531163.asia-northeast1.run.app,ALLOW_DELETE_THEME=true,IDEA_CORS_ORIGIN=https://idobata-frontend-336788531163.asia-northeast1.run.app,https://idobata-admin-336788531163.asia-northeast1.run.app,https://idobata-admin-doisltwsmq-an.a.run.app" \
  --region=$REGION

wait_for_service
check_health

echo -e "${GREEN}✅ Backend environment variables setup completed!${NC}"
echo -e "${GREEN}🌐 Backend service URL: https://idobata-backend-336788531163.asia-northeast1.run.app${NC}"

echo -e "${YELLOW}⚠️  Next steps:${NC}"
echo -e "${YELLOW}1. Replace placeholder values with actual values:${NC}"
echo -e "${YELLOW}   - MONGODB_URI: Your actual MongoDB connection string${NC}"
echo -e "${YELLOW}   - PASSWORD_PEPPER: A secure random string${NC}"
echo -e "${YELLOW}   - JWT_SECRET: A secure random string${NC}"
echo -e "${YELLOW}   - OPENAI_API_KEY: Your OpenAI API key${NC}"
echo -e "${YELLOW}2. Initialize admin user:${NC}"
echo -e "${YELLOW}   curl -X POST https://idobata-backend-336788531163.asia-northeast1.run.app/api/auth/initialize \\${NC}"
echo -e "${YELLOW}     -H \"Content-Type: application/json\" \\${NC}"
echo -e "${YELLOW}     -d '{\"email\":\"admin@example.com\",\"password\":\"SecurePassword123\",\"name\":\"Admin User\"}'${NC}"
