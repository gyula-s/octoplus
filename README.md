# Octoplus Caffe Nero Auto-Claimer

Automatically claim your weekly Caffe Nero benefit from Octoplus every Monday morning using AWS Lambda.

## 🎯 What This Does

- **Checks** if Caffe Nero benefit is available to claim
- **Claims** it automatically if available
- **Shows** your voucher code if already claimed
- **Runs** every 10 minutes between 5:00-6:30 AM on Mondays
- **Costs** $0 (within AWS free tier)

## 📋 Prerequisites

### 1. AWS Account
- Create a free AWS account at [aws.amazon.com](https://aws.amazon.com)
- You'll need AWS credentials configured

### 2. Node.js & npm
```bash
# Check if you have Node.js installed
node --version  # Should be v16+ 
npm --version
```

If not installed, download from [nodejs.org](https://nodejs.org)

### 3. Serverless Framework
```bash
# Install globally
npm install -g serverless

# Verify installation
serverless --version
```

## ⚙️ Setup Instructions

### Step 1: Clone and Install Dependencies

```bash
# Navigate to your project directory
cd /path/to/octoplus

# Install dependencies
npm install
```

### Step 2: Configure Environment Variables

Copy the sample environment file and configure your credentials:

```bash
# Copy the sample file
cp .env.sample .env
```

Edit the `.env` file and add your Octopus Energy credentials:

```bash
# Open .env file in your editor
nano .env
# or
code .env
```

Fill in your actual values:

```env
# Your Octopus Energy API Key (found in your account settings)
OCTOPUS_API_KEY=sk_live_your_actual_api_key_here

# Your Octopus Energy Account Number (format: A-XXXXXXXX)
OCTOPUS_ACCOUNT_NUMBER=A-your_account_number
```

**Where to find these values:**
- **API Key**: Octopus Energy account → Developer settings → Create API key
- **Account Number**: Octopus Energy dashboard → Account overview (format: A-XXXXXXXX)

### Step 3: Configure AWS Credentials

You need AWS credentials to deploy the Lambda function. Here are the options:

#### Option A: AWS CLI (Recommended)

1. **Install AWS CLI** (if not already installed):
   ```bash
   # macOS (using Homebrew)
   brew install awscli
   
   # macOS (using installer)
   # Download from: https://awscli.amazonaws.com/AWSCLIV2.pkg
   
   # Windows
   # Download from: https://awscli.amazonaws.com/AWSCLIV2.msi
   
   # Linux
   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
   unzip awscliv2.zip
   sudo ./aws/install
   ```

2. **Get your AWS credentials** from AWS Console:
   - Go to [AWS Console](https://console.aws.amazon.com)
   - Click your name (top right) → Security credentials
   - Scroll down to "Access keys" section
   - Click "Create access key"
   - Choose "Command Line Interface (CLI)"
   - Click "Create access key"
   - **Save both the Access Key ID and Secret Access Key**

3. **Configure AWS CLI**:
   ```bash
   aws configure
   ```
   
   Enter when prompted:
   - **AWS Access Key ID**: Your access key from step 2
   - **AWS Secret Access Key**: Your secret key from step 2
   - **Default region**: `eu-west-1` (Ireland) or your preferred region
   - **Default output format**: Just press Enter (uses json)

4. **Test the configuration**:
   ```bash
   aws sts get-caller-identity
   ```
   
   You should see something like:
   ```json
   {
       "UserId": "AIDAXX...",
       "Account": "123456789012",
       "Arn": "arn:aws:iam::123456789012:user/your-username"
   }
   ```

#### Option B: Environment Variables (Temporary)

```bash
export AWS_ACCESS_KEY_ID=your_access_key_here
export AWS_SECRET_ACCESS_KEY=your_secret_key_here
export AWS_DEFAULT_REGION=eu-west-2
```

⚠️ **Note**: These expire when you close your terminal.

#### Option C: Serverless Dashboard (Alternative)

```bash
# Login to Serverless Dashboard
serverless login

# Follow the browser authentication flow
# This will handle AWS credentials through Serverless
```

#### ⚠️ Important Security Notes:

- **Never share your AWS credentials**
- **Don't commit them to git**
- **Use IAM users, not root account**
- **Enable MFA on your AWS account**
- **Rotate keys periodically**

### Step 4: Test Locally (Optional)

```bash
# Test the function locally
npm run test
# or
tsx index.ts
```

You should see output like:
```
🔍 Checking Caffe Nero benefit status...
1️⃣ Fetching available benefits...
📋 Found: A hot or cold drink on us - any size, every week
...
```

## 🚀 Deployment

### Deploy to AWS Lambda

```bash
# Run the deployment script
./deploy.sh
```

Or manually:

```bash
# Compile TypeScript
npx tsc

# Deploy to AWS
serverless deploy
```

### Expected Output

```
✅ Service deployed to stack octoplus-benefits-dev

endpoints: (none)
functions:
  caffenero: octoplus-benefits-dev-caffenero

Stack Outputs:
  CaffeneroLambdaFunctionQualifiedArn: arn:aws:lambda:eu-west-2:...
```

## 🔧 Management Commands

### View Logs
```bash
# View recent logs
serverless logs -f caffenero

# Follow logs in real-time
serverless logs -f caffenero --tail
```

### Test Function
```bash
# Invoke function manually
serverless invoke -f caffenero
```

### Update Deployment
```bash
# After making code changes
npx tsc
serverless deploy
```

### Remove Deployment
```bash
# Delete everything from AWS
serverless remove
```

## 📅 Schedule Details

The function runs on this schedule:
- **Days**: Mondays only
- **Time**: 5:00 AM - 6:30 AM (UTC)
- **Frequency**: Every 10 minutes
- **Total runs**: 10 times per Monday

To change the schedule, edit `serverless.yml`:
```yaml
events:
  - schedule:
      rate: cron(0/10 5-6 ? * MON *)  # Modify this line
```

## 💰 Cost Breakdown

**AWS Lambda Free Tier:**
- 1,000,000 requests per month
- 400,000 GB-seconds compute time

**Your usage:**
- ~40 requests per month (10 per Monday × 4 Mondays)
- Each request takes ~2-5 seconds
- **Total cost: $0.00** ✅

## 🔍 Troubleshooting

### Common Issues

#### 1. "Cannot find module" errors
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

#### 2. AWS credentials not found
```bash
# Check AWS configuration
aws sts get-caller-identity

# If this fails, reconfigure:
aws configure
```

#### 3. Deployment fails
```bash
# Check Serverless version
serverless --version

# Update if needed
npm install -g serverless@latest
```

#### 4. Function times out
The function has a 30-second timeout. If it times out:
- Check AWS CloudWatch logs
- Verify your API credentials are correct
- Check Octopus Energy service status

### Viewing Detailed Logs

1. Go to AWS Console → CloudWatch → Log Groups
2. Find `/aws/lambda/octoplus-benefits-dev-caffenero`
3. View the latest log stream

### Testing Authentication

```bash
# Test your credentials work
tsx auth.ts
```

## 🔒 Security Notes

- Never commit your `.env` file to version control
- Use AWS IAM roles with minimal permissions
- Rotate your API keys periodically
- Monitor AWS CloudTrail for access logs

## 📞 Support

If you encounter issues:

1. **Check logs**: `serverless logs -f caffenero`
2. **Test locally**: `tsx index.ts`
3. **Verify credentials**: Check `.env` file
4. **AWS status**: Check AWS service health
5. **Octopus status**: Verify your Octopus account

## 🎉 Success!

Once deployed, your Lambda function will:
- Automatically run every Monday morning
- Claim your Caffe Nero benefit if available
- Send logs to CloudWatch for monitoring
- Cost you absolutely nothing! ☕

Enjoy your free weekly coffee! ☕️✨