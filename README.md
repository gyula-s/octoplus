# Octoplus Caffe Nero Auto-Claimer

Automatically claim your weekly Caffe Nero coffee vouchers from Octopus Energy's Octoplus rewards program, with email notifications containing QR codes ready to scan at the store.

---

## ✨ Features

- ☕ **Automatic Weekly Claims** - Claims vouchers every Monday morning (5:00-6:30 AM UTC)
- 📧 **Email Notifications** - Sends QR code directly to your inbox, ready to use
- 🔄 **Multi-Account Support** - Manages unlimited Octopus Energy accounts in parallel
- 🗂️ **Smart State Management** - Prevents duplicate claims with DynamoDB tracking
- 🔒 **Secure Credentials** - Stores API keys in AWS SSM Parameter Store (encrypted)
- 🚀 **CI/CD Pipeline** - Auto-deploys on git push via GitHub Actions
- 💰 **Zero Cost** - Runs entirely within AWS free tier

---

## 🏗️ Architecture

```
EventBridge Scheduler (Monday 5-6:30 AM UTC)
  ├─ Account 1 → Lambda → SSM (credentials) → DynamoDB (state) → Octopus API → QR Email
  ├─ Account 2 → Lambda → SSM (credentials) → DynamoDB (state) → Octopus API → QR Email
  └─ Account 3 → Lambda → SSM (credentials) → DynamoDB (state) → Octopus API → QR Email
```

**Key Components:**
- **AWS Lambda**: Serverless function (Node.js 20.x)
- **EventBridge**: Multiple schedules (one per account) for parallel execution
- **DynamoDB**: State tracking with automatic weekly reset (Saturday 9 AM UTC)
- **SSM Parameter Store**: Encrypted credential storage
- **AWS SES**: Email delivery with QR code attachments
- **GitHub Actions**: Automated deployments on main branch changes

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- AWS Account with CLI configured
- Octopus Energy account(s) with API keys
- GitHub account (for CI/CD)

### Installation

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/octoplus.git
cd octoplus

# Install dependencies
npm install

# Build TypeScript
npm run build
```

### Configuration

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for complete setup guide.

**Quick summary:**
1. Create AWS IAM user for deployments
2. Verify sender email in AWS SES
3. Store credentials in AWS SSM Parameter Store
4. Configure GitHub secrets for CI/CD
5. Deploy via `serverless deploy`

---

## 🔧 How It Works

### Weekly Cycle

**Monday 5:00-6:30 AM UTC** (Claim Window):
1. EventBridge triggers Lambda for each account (parallel execution)
2. Lambda fetches credentials from SSM Parameter Store
3. Checks DynamoDB state - skip if already processed this week
4. Calls Octopus API to claim Caffe Nero voucher
5. Generates QR code from barcode value
6. Sends email with QR code attachment
7. Saves state to DynamoDB

**Saturday 9:00 AM UTC** (Reset Boundary):
- State becomes "stale" and can be claimed again next Monday

**Monday-Friday**: No executions (Lambda never runs)

### State Management

State stored in DynamoDB per account:
```json
{
  "accountNumber": "A-12345678",
  "voucherCode": "ABC123XYZ",
  "lastClaimedAt": 1729843200000,
  "emailSentAt": 1729843200000,
  "ttl": 1732435200
}
```

### Email Notifications

Each successful claim sends an HTML email containing:
- Voucher code
- QR code (PNG attachment + embedded in email body)
- Expiration date
- Usage instructions
- Redemption steps

**Email Configuration:**
- **Optional per account** - Set `EMAIL_ADDRESS_X` in SSM for each account
- **Graceful degradation** - If no email configured, claim still succeeds (no email sent)
- **SES Sandbox Mode** - Works with verified emails only (default)

---

## 📦 Adding/Removing Accounts

### Add New Account

```bash
# 1. Add SSM parameters
aws ssm put-parameter \
  --name "/octoplus/dev/account-4/api-key" \
  --value "sk_live_..." \
  --type "SecureString" \
  --region eu-west-1

aws ssm put-parameter \
  --name "/octoplus/dev/account-4/account-number" \
  --value "A-XXXXXXXX" \
  --type "String" \
  --region eu-west-1

aws ssm put-parameter \
  --name "/octoplus/dev/account-4/email" \
  --value "your-email@example.com" \
  --type "String" \
  --region eu-west-1

# 2. Update serverless.yml (add new schedule event)
# 3. Push to main branch (GitHub Actions deploys automatically)
```

See [DEPLOYMENT.md#addingremoving-accounts](./DEPLOYMENT.md#addingremoving-accounts) for details.

---

## 📊 Monitoring

### View Logs

```bash
# Real-time logs
aws logs tail /aws/lambda/octoplus-benefits-dev-caffenero --follow

# Last 100 lines
aws logs tail /aws/lambda/octoplus-benefits-dev-caffenero --since 1h
```

### Check State

```bash
# View DynamoDB state
aws dynamodb scan --table-name octoplus-benefits-state-dev

# Check SSM parameters
aws ssm get-parameters-by-path --path /octoplus/dev --recursive
```

### Test Manual Invocation

```bash
# Test account 1
aws lambda invoke \
  --function-name octoplus-benefits-dev-caffenero \
  --payload '{"accountNumber":"1"}' \
  response.json

cat response.json | jq .
```

---

## 💰 Cost Breakdown

**Monthly Usage (3 accounts):**
- Lambda: 120 invocations × ~2s = **$0.00** (1M free requests/month)
- DynamoDB: 120 reads + 12 writes = **$0.00** (25 GB-seconds free/month)
- SSM Parameters: 9 parameters = **$0.00** (Standard parameters always free)
- SES: 12 emails = **$0.00** (62,000 free emails/month from Lambda)
- CloudWatch Logs: ~15 MB = **$0.00** (5 GB free/month)

**Total Monthly Cost: $0.00** ✅

---

## 🔒 Security

### Credentials Storage

- ✅ API keys stored in **AWS SSM Parameter Store** (encrypted at rest)
- ✅ Never committed to git
- ✅ Not stored in GitHub secrets
- ✅ Not in environment variables

### IAM Permissions

Lambda role has minimal permissions:
- SSM: Read-only access to `/octoplus/*` parameters
- DynamoDB: Read/write to state table only
- SES: Send emails only
- CloudWatch: Write logs only

### Email Security

- Sender verified in AWS SES
- Emails contain voucher codes (sensitive data)
- Recommend using personal email only
- SES sandbox mode by default (can only email verified addresses)

---

## 🐛 Troubleshooting

### Common Issues

**1. "Parameter /octoplus/dev/account-X/api-key not found"**
- ✅ Solution: Add SSM parameters (see [DEPLOYMENT.md](./DEPLOYMENT.md))

**2. "Email address is not verified"**
- ✅ Solution: Verify sender in AWS SES console (`soosgyul@gmail.com`)

**3. Lambda skips account every Monday**
- ✅ Check: DynamoDB state shows `lastClaimedAt` after Saturday 9 AM UTC?
- ✅ Solution: State is fresh - wait until next Saturday's reset

**4. GitHub Actions deployment fails**
- ✅ Check: AWS credentials in GitHub secrets?
- ✅ Check: IAM user has deployment permissions?

**5. No email received after successful claim**
- ✅ Check: `EMAIL_ADDRESS_X` parameter exists in SSM?
- ✅ Check: Recipient email verified in SES (if sandbox mode)?
- ✅ Check: CloudWatch logs for email sending errors

See [DEPLOYMENT.md#troubleshooting](./DEPLOYMENT.md#troubleshooting) for detailed solutions.

---

## 🛠️ Development

### Local Testing

```bash
# Run for single account (uses real SSM/DynamoDB)
npm run build
sls invoke local -f caffenero -d '{"accountNumber":"1"}'
```

### Project Structure

```
octoplus/
├── src/
│   ├── services/
│   │   ├── parameters.ts    # SSM Parameter Store
│   │   ├── state.ts          # DynamoDB state tracking
│   │   └── email.ts          # QR code generation + SES
│   └── types.ts              # TypeScript interfaces
├── lambda.ts                 # Lambda handler (single account)
├── index.ts                  # Main logic (Octopus API)
├── serverless.yml            # Infrastructure config
├── DEPLOYMENT.md             # Setup guide
└── .github/workflows/
    └── deploy.yml            # CI/CD pipeline
```

### Key Files

- **lambda.ts**: Entry point for Lambda invocations
- **src/services/parameters.ts**: Fetches credentials from SSM
- **src/services/state.ts**: Manages DynamoDB state with weekly reset logic
- **src/services/email.ts**: Generates QR codes and sends via SES
- **serverless.yml**: Defines EventBridge schedules, DynamoDB table, IAM permissions

---

## 📖 Documentation

- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Complete deployment guide
  - AWS IAM setup
  - SES email verification
  - SSM parameter configuration
  - GitHub Actions secrets
  - Testing and monitoring

---

## 🎯 Roadmap

Future enhancements:
- [ ] Web dashboard for viewing claim history
- [ ] Slack/Discord notification support
- [ ] Support for other Octoplus partner offers
- [ ] Cost optimization insights
- [ ] Advanced scheduling options

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🙏 Acknowledgments

- Octopus Energy for the Octoplus rewards program
- AWS for generous free tier
- Serverless Framework for infrastructure management

---

## 💬 Support

Need help?
1. Check [DEPLOYMENT.md](./DEPLOYMENT.md)
2. Review [Troubleshooting](#troubleshooting)
3. Check CloudWatch logs
4. Open a GitHub issue

---

**Enjoy your free weekly coffee!** ☕✨
