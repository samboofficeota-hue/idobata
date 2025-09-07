#!/bin/bash

# Google Cloud Project ID
PROJECT_ID="idobata-471403"
REGION="asia-northeast1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Idobata System Deployment to Google App Engine${NC}"

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

# Enable required APIs
echo -e "${YELLOW}🔧 Enabling required APIs${NC}"
gcloud services enable appengine.googleapis.com
gcloud services enable cloudbuild.googleapis.com

# Deploy Backend
echo -e "${YELLOW}🚀 Deploying Backend to App Engine${NC}"
cd idea-discussion/backend
gcloud app deploy app.yaml --quiet
BACKEND_URL=$(gcloud app services describe backend --format="value(defaultHostname)")
echo -e "${GREEN}✅ Backend deployed: https://$BACKEND_URL${NC}"

# Deploy Python Service
echo -e "${YELLOW}🚀 Deploying Python Service to App Engine${NC}"
cd ../../python-service
gcloud app deploy app.yaml --quiet
PYTHON_URL=$(gcloud app services describe python-service --format="value(defaultHostname)")
echo -e "${GREEN}✅ Python Service deployed: https://$PYTHON_URL${NC}"

# Build and deploy Frontend
echo -e "${YELLOW}🚀 Building and deploying Frontend to App Engine${NC}"
cd ../frontend
npm install
npm run build
gcloud app deploy app.yaml --quiet
FRONTEND_URL=$(gcloud app services describe frontend --format="value(defaultHostname)")
echo -e "${GREEN}✅ Frontend deployed: https://$FRONTEND_URL${NC}"

# Build and deploy Admin
echo -e "${YELLOW}🚀 Building and deploying Admin to App Engine${NC}"
cd ../admin
npm install
npm run build
gcloud app deploy app.yaml --quiet
ADMIN_URL=$(gcloud app services describe admin --format="value(defaultHostname)")
echo -e "${GREEN}✅ Admin deployed: https://$ADMIN_URL${NC}"

echo -e "${GREEN}🎉 Deployment completed!${NC}"
echo -e "${GREEN}🌐 Your services are now available at:${NC}"
echo -e "${GREEN}Frontend: https://$FRONTEND_URL${NC}"
echo -e "${GREEN}Admin: https://$ADMIN_URL${NC}"
echo -e "${GREEN}Backend: https://$BACKEND_URL${NC}"
echo -e "${GREEN}Python Service: https://$PYTHON_URL${NC}"

# Show app info
echo -e "${YELLOW}📱 App Engine Dashboard:${NC}"
echo "https://console.cloud.google.com/appengine?project=$PROJECT_ID"
