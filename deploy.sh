#!/bin/bash

# Deployment script for Octoplus Lambda function
set -e

echo "🚀 Deploying Octoplus Lambda function..."
echo ""

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found!"
    echo ""
    if [ -f ".env.sample" ]; then
        echo "💡 Found .env.sample file. To get started:"
        echo "   1. Copy the sample: cp .env.sample .env"
        echo "   2. Edit .env and fill in your Octopus Energy credentials"
        echo "   3. Run this script again"
    else
        echo "Please create a .env file with your OCTOPUS_API_KEY and OCTOPUS_ACCOUNT_NUMBER"
    fi
    echo "See README.md for detailed instructions."
    exit 1
fi

# Check if required environment variables are set
account_found=false

# Check for numbered accounts
for i in {1..5}; do
    if grep -q "OCTOPUS_API_KEY_$i=" .env && grep -q "OCTOPUS_ACCOUNT_NUMBER_$i=" .env; then
        account_found=true
        break
    fi
done

# Check for legacy format if no numbered accounts found
if [ "$account_found" = false ]; then
    if grep -q "OCTOPUS_API_KEY=" .env && grep -q "OCTOPUS_ACCOUNT_NUMBER=" .env; then
        account_found=true
    fi
fi

if [ "$account_found" = false ]; then
    echo "❌ Error: No Octopus accounts configured in .env file"
    echo "Configure at least one account using either:"
    echo "  • Numbered format: OCTOPUS_API_KEY_1= and OCTOPUS_ACCOUNT_NUMBER_1="
    echo "  • Legacy format: OCTOPUS_API_KEY= and OCTOPUS_ACCOUNT_NUMBER="
    echo "See README.md for instructions."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    echo "Please install Node.js from https://nodejs.org"
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Install Serverless Framework globally if not installed
if ! command -v serverless &> /dev/null; then
    echo "📦 Installing Serverless Framework..."
    npm install -g serverless
fi

# Check AWS credentials
echo "� Checking AWS credentials..."
if ! aws sts get-caller-identity &> /dev/null && ! serverless config credentials --provider aws --list &> /dev/null; then
    echo "❌ Error: AWS credentials not configured"
    echo "Please run 'aws configure' or 'serverless login'"
    echo "See README.md for detailed instructions."
    exit 1
fi

# Test the function locally first
echo "🧪 Testing function locally..."
if ! npm run test; then
    echo "❌ Error: Local test failed"
    echo "Please check your .env file and Octopus Energy credentials"
    exit 1
fi

echo ""
echo "✅ Local test passed!"
echo ""

# Clean and build
echo "🧹 Cleaning previous build..."
rm -rf dist/

echo "🔨 Building TypeScript..."
if ! npm run build; then
    echo "❌ Error: TypeScript compilation failed"
    exit 1
fi

# Deploy to AWS
echo "☁️ Deploying to AWS..."
if ! serverless deploy; then
    echo "❌ Error: Deployment failed"
    echo "Check the error message above and your AWS credentials"
    exit 1
fi

echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "📋 Your Lambda function is now running on the following schedule:"
echo "   • Every Monday from 5:00-6:30 AM UTC"
echo "   • Every 10 minutes (10 executions per Monday)"
echo ""
echo "� CloudWatch Log Groups created:"
echo "   • Lambda logs: /aws/lambda/octoplus-benefits-dev-caffenero"
echo "   • Schedule logs: /aws/events/rule/octoplus-benefits-dev-caffenero-schedule"
echo ""
echo "�🔧 Useful commands:"
echo "   • View logs:       serverless logs -f caffenero --tail"
echo "   • View logs (AWS): aws logs tail /aws/lambda/octoplus-benefits-dev-caffenero --follow"
echo "   • Test function:   serverless invoke -f caffenero"
echo "   • Update:          ./deploy.sh"
echo "   • Remove:          serverless remove"
echo ""
echo "🔍 Log monitoring tips:"
echo "   • Look for '✅ SUCCESS' for successful runs"
echo "   • Look for '❌ FAILURE' for failed runs"
echo "   • Each run has a unique REQUEST_ID for tracking"
echo ""
echo "🎉 Enjoy your automated Caffe Nero benefits! ☕️"