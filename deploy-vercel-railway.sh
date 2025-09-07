#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Idobata System Deployment to Vercel + Railway${NC}"

# Check if required tools are installed
if ! command -v vercel &> /dev/null; then
    echo -e "${RED}❌ Vercel CLI is not installed. Please install it first:${NC}"
    echo "npm i -g vercel"
    exit 1
fi

if ! command -v railway &> /dev/null; then
    echo -e "${RED}❌ Railway CLI is not installed. Please install it first:${NC}"
    echo "npm i -g @railway/cli"
    exit 1
fi

# Deploy Frontend to Vercel
echo -e "${YELLOW}🚀 Deploying Frontend to Vercel${NC}"
cd frontend
npm install
npm run build
vercel --prod --yes
FRONTEND_URL=$(vercel ls | grep frontend | head -1 | awk '{print $2}')
echo -e "${GREEN}✅ Frontend deployed: https://$FRONTEND_URL${NC}"

# Deploy Admin to Vercel
echo -e "${YELLOW}🚀 Deploying Admin to Vercel${NC}"
cd ../admin
npm install
npm run build
vercel --prod --yes
ADMIN_URL=$(vercel ls | grep admin | head -1 | awk '{print $2}')
echo -e "${GREEN}✅ Admin deployed: https://$ADMIN_URL${NC}"

# Deploy Backend to Railway
echo -e "${YELLOW}🚀 Deploying Backend to Railway${NC}"
cd ../idea-discussion/backend
railway login
railway init --name idobata-backend
railway up
BACKEND_URL=$(railway status | grep "https://" | head -1)
echo -e "${GREEN}✅ Backend deployed: $BACKEND_URL${NC}"

# Deploy Python Service to Railway
echo -e "${YELLOW}🚀 Deploying Python Service to Railway${NC}"
cd ../../python-service
railway init --name idobata-python-service
railway up
PYTHON_URL=$(railway status | grep "https://" | head -1)
echo -e "${GREEN}✅ Python Service deployed: $PYTHON_URL${NC}"

echo -e "${GREEN}🎉 Deployment completed!${NC}"
echo -e "${GREEN}🌐 Your services are now available at:${NC}"
echo -e "${GREEN}Frontend: https://$FRONTEND_URL${NC}"
echo -e "${GREEN}Admin: https://$ADMIN_URL${NC}"
echo -e "${GREEN}Backend: $BACKEND_URL${NC}"
echo -e "${GREEN}Python Service: $PYTHON_URL${NC}"

# Update environment variables
echo -e "${YELLOW}📝 Don't forget to update environment variables:${NC}"
echo -e "${YELLOW}Frontend: Set VITE_API_BASE_URL to $BACKEND_URL${NC}"
echo -e "${YELLOW}Admin: Set VITE_API_BASE_URL to $BACKEND_URL${NC}"
echo -e "${YELLOW}Backend: Set MONGODB_URI and OPENROUTER_API_KEY${NC}"
echo -e "${YELLOW}Python Service: Set OPENAI_API_KEY${NC}"
