#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🧹 Cleaning up unused deployment files...${NC}"
echo ""

# Files to delete
FILES=(
  "frontend/vercel.json"
  "idea-discussion/backend/Dockerfile.railway"
  "frontend/app.yaml"
  "admin/app.yaml"
  "python-service/app.yaml"
  "deploy-appengine.sh"
)

DELETED=0
NOT_FOUND=0

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    rm "$file"
    echo -e "${GREEN}✅ Deleted: $file${NC}"
    ((DELETED++))
  else
    echo -e "${YELLOW}⚠️  Not found: $file${NC}"
    ((NOT_FOUND++))
  fi
done

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Cleanup completed!${NC}"
echo -e "${GREEN}   Deleted: $DELETED files${NC}"
if [ $NOT_FOUND -gt 0 ]; then
  echo -e "${YELLOW}   Not found: $NOT_FOUND files${NC}"
fi
echo ""
echo -e "${YELLOW}💡 Next steps:${NC}"
echo -e "${YELLOW}   1. Review the changes: git status${NC}"
echo -e "${YELLOW}   2. Commit the cleanup: git add -A && git commit -m 'chore: Remove unused Vercel, Railway, and App Engine files'${NC}"
echo -e "${YELLOW}   3. Push: git push${NC}"
