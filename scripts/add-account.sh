#!/bin/bash

# Script to add a new Octopus Energy account to the system
# This will:
# 1. Prompt for account details
# 2. Create SSM parameter
# 3. Update serverless.yml with new schedule
# 4. Redeploy the Lambda function

set -e

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Octoplus - Add New Account${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Get AWS region and stage from environment or use defaults
AWS_REGION=${AWS_REGION:-eu-west-1}
STAGE=${STAGE:-dev}

echo -e "${YELLOW}Configuration:${NC}"
echo "  Region: $AWS_REGION"
echo "  Stage: $STAGE"
echo ""

# Prompt for account details
echo -e "${GREEN}Enter account details:${NC}"
echo ""

read -p "Account Number (e.g., 4): " ACCOUNT_ID
read -p "Octopus Account Number (e.g., A-12345678): " OCTOPUS_ACCOUNT
read -sp "API Key (starts with sk_live_): " API_KEY
echo ""
read -p "Nickname (optional, e.g., 'Home' or 'My Energy'): " NICKNAME
read -p "Email addresses (comma-separated): " EMAILS

echo ""
echo -e "${YELLOW}Validating input...${NC}"

# Validate inputs
if [ -z "$ACCOUNT_ID" ]; then
  echo -e "${RED}Error: Account number is required${NC}"
  exit 1
fi

if [ -z "$OCTOPUS_ACCOUNT" ]; then
  echo -e "${RED}Error: Octopus account number is required${NC}"
  exit 1
fi

if [[ ! "$OCTOPUS_ACCOUNT" =~ ^A-[A-Z0-9]{8}$ ]]; then
  echo -e "${RED}Error: Invalid Octopus account format (expected: A-XXXXXXXX)${NC}"
  exit 1
fi

if [ -z "$API_KEY" ]; then
  echo -e "${RED}Error: API key is required${NC}"
  exit 1
fi

if [[ ! "$API_KEY" =~ ^sk_live_ ]]; then
  echo -e "${RED}Error: API key must start with 'sk_live_'${NC}"
  exit 1
fi

if [ -z "$EMAILS" ]; then
  echo -e "${RED}Error: At least one email address is required${NC}"
  exit 1
fi

# Parse emails into JSON array
IFS=',' read -ra EMAIL_ARRAY <<< "$EMAILS"
EMAIL_JSON="["
for i in "${!EMAIL_ARRAY[@]}"; do
  EMAIL="${EMAIL_ARRAY[$i]}"
  EMAIL=$(echo "$EMAIL" | xargs) # Trim whitespace
  if [ $i -gt 0 ]; then
    EMAIL_JSON+=","
  fi
  EMAIL_JSON+="\"$EMAIL\""
done
EMAIL_JSON+="]"

# Build JSON config
if [ -z "$NICKNAME" ]; then
  CONFIG_JSON="{\"apiKey\":\"$API_KEY\",\"accountNumber\":\"$OCTOPUS_ACCOUNT\",\"emails\":$EMAIL_JSON}"
else
  CONFIG_JSON="{\"apiKey\":\"$API_KEY\",\"accountNumber\":\"$OCTOPUS_ACCOUNT\",\"nickname\":\"$NICKNAME\",\"emails\":$EMAIL_JSON}"
fi

echo ""
echo -e "${YELLOW}Creating SSM parameter...${NC}"
PARAM_PATH="/octoplus/${STAGE}/account-${ACCOUNT_ID}/config"

aws ssm put-parameter \
  --name "$PARAM_PATH" \
  --value "$CONFIG_JSON" \
  --type SecureString \
  --region "$AWS_REGION" \
  --overwrite

echo -e "${GREEN}✓ SSM parameter created: $PARAM_PATH${NC}"

# Add schedule to serverless.yml
echo ""
echo -e "${YELLOW}Updating serverless.yml...${NC}"

# Check if account schedule already exists
if grep -q "account-${ACCOUNT_ID}" serverless.yml; then
  echo -e "${YELLOW}⚠ Account ${ACCOUNT_ID} schedule already exists in serverless.yml${NC}"
  read -p "Overwrite? (y/n): " OVERWRITE
  if [ "$OVERWRITE" != "y" ]; then
    echo -e "${BLUE}Skipping serverless.yml update${NC}"
    exit 0
  fi
else
  # Append new schedule before the resources section
  NEW_SCHEDULE="
      # Account ${ACCOUNT_ID} Schedule - Runs every 10 minutes between 5:00-6:30 AM UTC on Mondays
      - schedule:
          name: \${self:service}-\${self:provider.stage}-account-${ACCOUNT_ID}
          description: \"Claim Caffe Nero for Account ${ACCOUNT_ID} (Mon 5-6:30 AM UTC)\"
          rate: cron(0/10 5-6 ? * MON *)
          enabled: true
          input:
            accountNumber: \"${ACCOUNT_ID}\"
"

  # Insert before "resources:" line
  sed -i.bak "/^resources:/i\\
$NEW_SCHEDULE" serverless.yml

  rm serverless.yml.bak
  echo -e "${GREEN}✓ Added schedule for account ${ACCOUNT_ID}${NC}"
fi

# Deploy
echo ""
echo -e "${YELLOW}Deploying Lambda function...${NC}"
npm run build
npx serverless deploy --stage "$STAGE" --region "$AWS_REGION"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Account ${ACCOUNT_ID} added successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Details:${NC}"
echo "  Account ID: ${ACCOUNT_ID}"
echo "  Octopus Account: ${OCTOPUS_ACCOUNT}"
if [ ! -z "$NICKNAME" ]; then
  echo "  Nickname: ${NICKNAME}"
fi
echo "  Emails: ${EMAILS}"
echo "  Schedule: Every Monday 5:00-6:30 AM UTC (every 10 min)"
echo ""
echo -e "${BLUE}SSM Parameter:${NC}"
echo "  Path: $PARAM_PATH"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  • Test: aws lambda invoke --function-name octoplus-benefits-${STAGE}-caffenero --payload '{\"accountNumber\": \"${ACCOUNT_ID}\"}' --region ${AWS_REGION} response.json"
echo "  • View logs: aws logs tail /aws/lambda/octoplus-benefits-${STAGE}-caffenero --follow --region ${AWS_REGION}"
echo ""
