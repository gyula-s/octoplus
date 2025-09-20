#!/bin/bash

# Health check script to verify everything is working
echo "🏥 Octoplus Health Check"
echo "======================="
echo ""

# Check Node.js
if command -v node &> /dev/null; then
    echo "✅ Node.js: $(node --version)"
else
    echo "❌ Node.js: Not installed"
fi

# Check npm
if command -v npm &> /dev/null; then
    echo "✅ npm: $(npm --version)"
else
    echo "❌ npm: Not installed"
fi

# Check Serverless
if command -v serverless &> /dev/null; then
    echo "✅ Serverless: $(serverless --version | head -1)"
else
    echo "❌ Serverless: Not installed"
fi

# Check AWS CLI
if command -v aws &> /dev/null; then
    echo "✅ AWS CLI: $(aws --version | cut -d' ' -f1)"
    
    # Check AWS credentials
    if aws sts get-caller-identity &> /dev/null; then
        echo "✅ AWS Credentials: Configured"
    else
        echo "❌ AWS Credentials: Not configured"
    fi
else
    echo "⚠️  AWS CLI: Not installed (optional)"
fi

echo ""

# Check .env file
if [ -f ".env" ]; then
    echo "✅ .env file: Exists"
    
    # Check for accounts
    account_count=0
    
    # Check numbered accounts
    for i in {1..5}; do
        api_key_var="OCTOPUS_API_KEY_$i"
        account_var="OCTOPUS_ACCOUNT_NUMBER_$i"
        
        if grep -q "$api_key_var=" .env && ! grep -q "$api_key_var=your_.*_api_key_here" .env; then
            if grep -q "$account_var=" .env && ! grep -q "$account_var=A-.*XXXX" .env; then
                account_count=$((account_count + 1))
                echo "✅ Account $i: Configured"
            fi
        fi
    done
    
    # Check legacy format
    if grep -q "OCTOPUS_API_KEY=" .env && ! grep -q "OCTOPUS_API_KEY=your_api_key_here" .env; then
        if grep -q "OCTOPUS_ACCOUNT_NUMBER=" .env && ! grep -q "OCTOPUS_ACCOUNT_NUMBER=A-XXXXXXXX" .env; then
            if [ $account_count -eq 0 ]; then
                account_count=1
                echo "✅ Legacy Account: Configured"
            fi
        fi
    fi
    
    if [ $account_count -eq 0 ]; then
        echo "❌ No Octopus accounts configured"
        echo "💡 Configure at least one account in .env file"
    else
        echo "✅ Total accounts configured: $account_count"
    fi
else
    echo "❌ .env file: Missing"
    if [ -f ".env.sample" ]; then
        echo "💡 Found .env.sample - run: cp .env.sample .env"
    fi
fi

echo ""

# Check dependencies
if [ -d "node_modules" ]; then
    echo "✅ Dependencies: Installed"
else
    echo "❌ Dependencies: Run 'npm install'"
fi

# Check if TypeScript compiles
if [ -f "tsconfig.json" ]; then
    echo "✅ TypeScript config: Found"
    
    if npx tsc --noEmit &> /dev/null; then
        echo "✅ TypeScript: Compiles successfully"
    else
        echo "❌ TypeScript: Compilation errors"
    fi
else
    echo "❌ TypeScript config: Missing"
fi

echo ""
echo "🎯 Ready to deploy? Run: ./deploy.sh"