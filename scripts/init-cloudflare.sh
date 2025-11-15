#!/bin/bash

# VidEditor - Cloudflare Initialization Script
# This script sets up all required Cloudflare resources

set -e  # Exit on error

echo "🚀 VidEditor - Cloudflare Setup"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if wrangler is installed
if ! command -v npx wrangler &> /dev/null; then
    echo -e "${RED}❌ Error: wrangler not found${NC}"
    echo "Please run: npm install"
    exit 1
fi

echo -e "${BLUE}Step 1: Login to Cloudflare${NC}"
echo "This will open a browser window for authentication..."
npx wrangler login
echo -e "${GREEN}✅ Logged in successfully${NC}"
echo ""

echo -e "${BLUE}Step 2: Create D1 Database${NC}"
echo "Creating SQLite database for VidEditor..."
DB_OUTPUT=$(npx wrangler d1 create videditor-db 2>&1 || true)

if echo "$DB_OUTPUT" | grep -q "already exists"; then
    echo -e "${YELLOW}⚠️  Database 'videditor-db' already exists${NC}"
    # Extract database_id from list
    DB_ID=$(npx wrangler d1 list | grep videditor-db | awk '{print $2}')
else
    # Extract database_id from creation output
    DB_ID=$(echo "$DB_OUTPUT" | grep "database_id" | sed 's/.*database_id = "\(.*\)"/\1/')
    echo -e "${GREEN}✅ Created D1 database: videditor-db${NC}"
fi

if [ -n "$DB_ID" ]; then
    echo -e "${YELLOW}📝 Database ID: $DB_ID${NC}"
    echo ""
    echo -e "${BLUE}Updating wrangler.toml with database ID...${NC}"
    # Update wrangler.toml with actual database ID
    sed -i.bak "s/database_id = \"your-database-id\"/database_id = \"$DB_ID\"/" wrangler.toml
    rm wrangler.toml.bak 2>/dev/null || true
    echo -e "${GREEN}✅ Updated wrangler.toml${NC}"
fi
echo ""

echo -e "${BLUE}Step 3: Run D1 Migrations${NC}"
echo "Applying database schema..."
npx wrangler d1 migrations apply videditor-db --local
echo -e "${GREEN}✅ Migrations applied${NC}"
echo ""

echo -e "${BLUE}Step 4: Create R2 Buckets${NC}"

# Create videos bucket
echo "Creating R2 bucket: videditor-videos..."
VIDEOS_OUTPUT=$(npx wrangler r2 bucket create videditor-videos 2>&1 || true)
if echo "$VIDEOS_OUTPUT" | grep -q "already exists"; then
    echo -e "${YELLOW}⚠️  Bucket 'videditor-videos' already exists${NC}"
else
    echo -e "${GREEN}✅ Created R2 bucket: videditor-videos${NC}"
fi

# Create shorts bucket
echo "Creating R2 bucket: videditor-shorts..."
SHORTS_OUTPUT=$(npx wrangler r2 bucket create videditor-shorts 2>&1 || true)
if echo "$SHORTS_OUTPUT" | grep -q "already exists"; then
    echo -e "${YELLOW}⚠️  Bucket 'videditor-shorts' already exists${NC}"
else
    echo -e "${GREEN}✅ Created R2 bucket: videditor-shorts${NC}"
fi
echo ""

echo -e "${BLUE}Step 5: Create Queue${NC}"
echo "Creating message queue: video-processing-queue..."
QUEUE_OUTPUT=$(npx wrangler queues create video-processing-queue 2>&1 || true)
if echo "$QUEUE_OUTPUT" | grep -q "already exists"; then
    echo -e "${YELLOW}⚠️  Queue 'video-processing-queue' already exists${NC}"
else
    echo -e "${GREEN}✅ Created queue: video-processing-queue${NC}"
fi
echo ""

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}🎉 Cloudflare Setup Complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Run: npm run worker:dev"
echo "2. Visit: http://localhost:3000"
echo "3. Sign up and start using VidEditor!"
echo ""
echo -e "${YELLOW}📚 Documentation:${NC}"
echo "- README_CLOUDFLARE.md - Full setup guide"
echo "- MIGRATION_STATUS.md - Implementation details"
echo ""
