#!/bin/bash

# Google Cloud Project ID
PROJECT_ID="idobata-471403"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔐 Setting up secrets for Idobata System${NC}"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Set project
gcloud config set project $PROJECT_ID

# Create secrets
echo -e "${YELLOW}📝 Creating secrets...${NC}"

# MongoDB URI
echo -e "${YELLOW}Enter MongoDB URI (e.g., mongodb+srv://username:password@cluster.mongodb.net/dbname):${NC}"
read -r MONGODB_URI
echo -n "$MONGODB_URI" | gcloud secrets create mongodb-uri --data-file=-

# OpenAI API Key
echo -e "${YELLOW}Enter OpenAI API Key:${NC}"
read -s OPENAI_API_KEY
echo -n "$OPENAI_API_KEY" | gcloud secrets create openai-api-key --data-file=-

# Password Pepper
echo -e "${YELLOW}Enter Password Pepper (or press Enter to generate one):${NC}"
read -r PASSWORD_PEPPER
if [ -z "$PASSWORD_PEPPER" ]; then
    PASSWORD_PEPPER=$(openssl rand -base64 32)
    echo -e "${GREEN}Generated Password Pepper: $PASSWORD_PEPPER${NC}"
fi
echo -n "$PASSWORD_PEPPER" | gcloud secrets create password-pepper --data-file=-

# JWT Secret
echo -e "${YELLOW}Enter JWT Secret (or press Enter to generate one):${NC}"
read -r JWT_SECRET
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(openssl rand -base64 32)
    echo -e "${GREEN}Generated JWT Secret: $JWT_SECRET${NC}"
fi
echo -n "$JWT_SECRET" | gcloud secrets create jwt-secret --data-file=-

# Grant access to Cloud Run service accounts
echo -e "${YELLOW}🔑 Granting access to secrets...${NC}"

# Get project number
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

# Grant access to Cloud Run service accounts
gcloud secrets add-iam-policy-binding mongodb-uri \
    --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding openai-api-key \
    --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding password-pepper \
    --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding jwt-secret \
    --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

echo -e "${GREEN}✅ Secrets setup completed!${NC}"
echo -e "${GREEN}🔐 Created secrets:${NC}"
echo -e "${GREEN}  - mongodb-uri${NC}"
echo -e "${GREEN}  - openai-api-key${NC}"
echo -e "${GREEN}  - password-pepper${NC}"
echo -e "${GREEN}  - jwt-secret${NC}"
