#!/bin/bash

# Google Cloud Project ID
PROJECT_ID="idobata-471403"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔐 Creating password-pepper secret${NC}"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Set project
gcloud config set project $PROJECT_ID

# Check if secret already exists
if gcloud secrets describe password-pepper > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  password-pepper already exists.${NC}"
    echo -e "${YELLOW}To update it, use:${NC}"
    echo -e "${YELLOW}  echo -n \"your-new-pepper\" | gcloud secrets versions add password-pepper --data-file=-${NC}"
    exit 0
fi

# Generate password pepper
echo -e "${YELLOW}Generating password pepper...${NC}"
PASSWORD_PEPPER=$(openssl rand -base64 32)
echo -e "${GREEN}Generated Password Pepper: $PASSWORD_PEPPER${NC}"

# Create secret
echo -n "$PASSWORD_PEPPER" | gcloud secrets create password-pepper --data-file=-

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ password-pepper secret created successfully!${NC}"
    
    # Grant access to Cloud Run service accounts
    echo -e "${YELLOW}🔑 Granting access to Cloud Run service accounts...${NC}"
    
    # Get project number
    PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
    
    # Grant access
    gcloud secrets add-iam-policy-binding password-pepper \
        --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
        --role="roles/secretmanager.secretAccessor"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Access granted to Cloud Run service accounts${NC}"
        echo ""
        echo -e "${GREEN}✅ All secrets are now configured!${NC}"
    else
        echo -e "${RED}❌ Failed to grant access. Please run manually:${NC}"
        echo -e "${YELLOW}  gcloud secrets add-iam-policy-binding password-pepper \\${NC}"
        echo -e "${YELLOW}    --member=\"serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com\" \\${NC}"
        echo -e "${YELLOW}    --role=\"roles/secretmanager.secretAccessor\"${NC}"
    fi
else
    echo -e "${RED}❌ Failed to create password-pepper secret${NC}"
    exit 1
fi
