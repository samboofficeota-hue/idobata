#!/bin/bash

# Google Cloud Project ID
PROJECT_ID="idobata-471403"
REGION="asia-northeast1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Idobata System Deployment to Google Cloud Run${NC}"

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
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable sqladmin.googleapis.com

# Build and push images
echo -e "${YELLOW}🏗️  Building and pushing Docker images${NC}"

# Frontend
echo -e "${YELLOW}Building frontend...${NC}"
docker build -t gcr.io/$PROJECT_ID/idobata-frontend ./frontend
docker push gcr.io/$PROJECT_ID/idobata-frontend

# Admin
echo -e "${YELLOW}Building admin...${NC}"
docker build -t gcr.io/$PROJECT_ID/idobata-admin ./admin
docker push gcr.io/$PROJECT_ID/idobata-admin

# Backend
echo -e "${YELLOW}Building backend...${NC}"
docker build -t gcr.io/$PROJECT_ID/idobata-backend -f ./idea-discussion/backend/Dockerfile --target production .
docker push gcr.io/$PROJECT_ID/idobata-backend

# Python Service
echo -e "${YELLOW}Building python service...${NC}"
docker build -t gcr.io/$PROJECT_ID/idobata-python-service ./python-service
docker push gcr.io/$PROJECT_ID/idobata-python-service

# Deploy to Cloud Run
echo -e "${YELLOW}🚀 Deploying to Cloud Run${NC}"

# Deploy Frontend
echo -e "${YELLOW}Deploying frontend...${NC}"
gcloud run deploy idobata-frontend \
  --image gcr.io/$PROJECT_ID/idobata-frontend \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --port 80

# Deploy Admin
echo -e "${YELLOW}Deploying admin...${NC}"
gcloud run deploy idobata-admin \
  --image gcr.io/$PROJECT_ID/idobata-admin \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --port 80

# Deploy Backend
echo -e "${YELLOW}Deploying backend...${NC}"
gcloud run deploy idobata-backend \
  --image gcr.io/$PROJECT_ID/idobata-backend \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars NODE_ENV=production

# Deploy Python Service
echo -e "${YELLOW}Deploying python service...${NC}"
gcloud run deploy idobata-python-service \
  --image gcr.io/$PROJECT_ID/idobata-python-service \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --port 8080

echo -e "${GREEN}✅ Deployment completed!${NC}"
echo -e "${GREEN}🌐 Your services are now available at:${NC}"
echo -e "${GREEN}Frontend: https://idobata-frontend-xxx-uc.a.run.app${NC}"
echo -e "${GREEN}Admin: https://idobata-admin-xxx-uc.a.run.app${NC}"
echo -e "${GREEN}Backend: https://idobata-backend-xxx-uc.a.run.app${NC}"
echo -e "${GREEN}Python Service: https://idobata-python-service-xxx-uc.a.run.app${NC}"
