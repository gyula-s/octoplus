# Octoplus Deployment Guide

Complete step-by-step guide for deploying the Octoplus Caffe Nero Auto-Claimer with email notifications, DynamoDB state tracking, and GitHub Actions CI/CD.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [AWS IAM User Setup](#aws-iam-user-setup)
3. [AWS SES Email Verification](#aws-ses-email-verification)
4. [SSM Parameter Store Configuration](#ssm-parameter-store-configuration)
5. [GitHub Secrets Configuration](#github-secrets-configuration)
6. [Initial Manual Deployment](#initial-manual-deployment)
7. [Testing](#testing)
8. [Monitoring](#monitoring)
9. [Troubleshooting](#troubleshooting)
10. [Adding/Removing Accounts](#addingremoving-accounts)
11. [Security Enhancements (Optional)](#security-enhancements-optional)

---

## Prerequisites

Before starting, ensure you have:

- **Node.js 20+** installed ([Download](https://nodejs.org/))
- **AWS CLI** installed and configured ([Install Guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html))
- **AWS Account** with appropriate permissions
- **GitHub Account** with admin access to this repository
- **Octopus Energy Account(s)** with API key(s)

---

## AWS IAM User Setup

### Step 1: Create IAM User

```bash
aws iam create-user --user-name octoplus-deployer
```

### Step 2: Create IAM Policy

Create a file `octoplus-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "lambda:*",
        "dynamodb:*",
        "ses:*",
        "ssm:*",
        "cloudformation:*",
        "s3:*",
        "logs:*",
        "events:*",
        "iam:GetRole",
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:PassRole"
      ],
      "Resource": "*"
    }
  ]
}
```

Apply the policy:

```bash
aws iam put-user-policy \
  --user-name octoplus-deployer \
  --policy-name OctoplusDeploymentPolicy \
  --policy-document file://octoplus-policy.json
```

### Step 3: Create Access Keys

```bash
aws iam create-access-key --user-name octoplus-deployer
```


**Important**: Save the `AccessKeyId` and `SecretAccessKey` securely - you'll need them for GitHub secrets.

---

## AWS SES Email Verification

### Step 1: Verify Sender Email

Navigate to AWS SES Console (region: `eu-west-1`):

```bash
open https://eu-west-1.console.aws.amazon.com/ses/home?region=eu-west-1#/verified-identities
```

Or via AWS CLI:

```bash
aws ses verify-email-identity \
  --email-address soosgyul@gmail.com \
  --region eu-west-1
```

### Step 2: Confirm Verification Email

Check `soosgyul@gmail.com` inbox and click the verification link.

### Step 3: SES Sandbox Mode

By default, SES is in **sandbox mode**:
- ✅ Can send emails
- ⚠️ Can only send to verified email addresses
- ⚠️ Limited to 200 emails/day

**For sandbox mode**: Both sender (`soosgyul@gmail.com`) and recipient email addresses must be verified.

**To request production access** (optional):
1. Go to SES Console → Account dashboard
2. Click "Request production access"
3. Fill out the form
4. Wait for approval (usually 24 hours)

---

## SSM Parameter Store Configuration

Store credentials securely in AWS Systems Manager Parameter Store.

### Account 1

```bash
# API Key (SecureString, encrypted)
aws ssm put-parameter \
  --name "/octoplus/dev/account-1/api-key" \
  --value "sk_live_7HTsxeLcNtDGH6ZArqSKDDk8" \
  --type "SecureString" \
  --description "Octopus Energy API key for account 1" \
  --region eu-west-1

# Account Number (String)
aws ssm put-parameter \
  --name "/octoplus/dev/account-1/account-number" \
  --value "A-4FB4AE60" \
  --type "String" \
  --description "Octopus Energy account number 1" \
  --region eu-west-1

# Email Address (String, optional - supports multiple comma-separated addresses)
aws ssm put-parameter \
  --name "/octoplus/dev/account-1/email" \
  --value "soosgyul@gmail.com, other@example.com" \
  --type "String" \
  --description "Email address(es) for account 1 notifications (comma-separated)" \
  --region eu-west-1
```

### Account 2 (if applicable)

```bash
aws ssm put-parameter \
  --name "/octoplus/dev/account-2/api-key" \
  --value "sk_live_6CwNf76uUynZHbeY7OrxUviuzxNLA4qf" \
  --type "SecureString" \
  --region eu-west-1

aws ssm put-parameter \
  --name "/octoplus/dev/account-2/account-number" \
  --value "A-36CCCCC0" \
  --type "String" \
  --region eu-west-1

aws ssm put-parameter \
  --name "/octoplus/dev/account-2/email" \
  --value "soosgyul@gmail.com" \
  --type "String" \
  --region eu-west-1
```

### Account 3 (if applicable)

```bash
aws ssm put-parameter \
  --name "/octoplus/dev/account-3/api-key" \
  --value "sk_live_YOUR_API_KEY_HERE" \
  --type "SecureString" \
  --region eu-west-1

aws ssm put-parameter \
  --name "/octoplus/dev/account-3/account-number" \
  --value "A-ZZZZZZZZ" \
  --type "String" \
  --region eu-west-1

aws ssm put-parameter \
  --name "/octoplus/dev/account-3/email" \
  --value "one@example.com, other@example.com" \
  --type "String" \
  --region eu-west-1
```

### Verify Parameters

```bash
aws ssm get-parameters-by-path \
  --path "/octoplus/dev" \
  --recursive \
  --region eu-west-1 \
  --query "Parameters[].Name"
```

Expected output:
```
[
    "/octoplus/dev/account-1/api-key",
    "/octoplus/dev/account-1/account-number",
    "/octoplus/dev/account-1/email",
    "/octoplus/dev/account-2/api-key",
    ...
]
```

---

## GitHub Secrets Configuration

### Step 1: Navigate to GitHub Secrets

Go to: `https://github.com/YOUR_USERNAME/octoplus/settings/secrets/actions`

### Step 2: Add Required Secrets

Add these two secrets:

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `AWS_ACCESS_KEY_ID` | `AKIA...` | IAM user access key ID |
| `AWS_SECRET_ACCESS_KEY` | `wJalr...` | IAM user secret access key |

**That's it!** No need to store Octopus credentials in GitHub - they're in AWS SSM.

---

## Initial Manual Deployment

Before GitHub Actions can deploy automatically, you need to deploy once manually.

### Step 1: Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/octoplus.git
cd octoplus
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Build TypeScript

```bash
npm run build
```

### Step 4: Deploy to AWS

```bash
npx serverless deploy --stage dev --region eu-west-1
```

Expected output:
```
✔ Service deployed to stack octoplus-benefits-dev

endpoints: (none)
functions:
  caffenero: octoplus-benefits-dev-caffenero

Stack Outputs:
  LambdaFunctionName: octoplus-benefits-dev-caffenero
  DynamoDBTableName: octoplus-benefits-state-dev
```

### Step 5: Verify Resources Created

```bash
# Check Lambda function
aws lambda list-functions --query 'Functions[?contains(FunctionName, `octoplus`)].FunctionName'

# Check DynamoDB table
aws dynamodb list-tables --query 'TableNames[?contains(@, `octoplus`)]'

# Check EventBridge rules
aws events list-rules --name-prefix "octoplus-benefits-dev"
```

---

## Testing

### Test Single Account Invocation

```bash
aws lambda invoke \
  --function-name octoplus-benefits-dev-caffenero \
  --payload '{"accountNumber":"1"}' \
  --log-type Tail \
  --region eu-west-1 \
  response.json

cat response.json | jq .
```

Expected response:
```json
{
  "success": true,
  "accountNumber": "A-12345678",
  "voucherCode": "ABC123XYZ",
  "emailSent": true,
  "executionTime": "2345ms"
}
```

### Check CloudWatch Logs

```bash
aws logs tail /aws/lambda/octoplus-benefits-dev-caffenero \
  --follow \
  --region eu-west-1
```

### Check DynamoDB State

```bash
aws dynamodb scan \
  --table-name octoplus-benefits-state-dev \
  --region eu-west-1
```

---

## Monitoring

### View Recent Lambda Invocations

```bash
# Last 10 invocations
aws lambda list-invocations \
  --function-name octoplus-benefits-dev-caffenero \
  --max-items 10
```

### Check Email Delivery (SES)

```bash
aws ses get-send-statistics --region eu-west-1
```

### Monitor DynamoDB Table

```bash
# Table details
aws dynamodb describe-table \
  --table-name octoplus-benefits-state-dev \
  --region eu-west-1

# Scan all records
aws dynamodb scan \
  --table-name octoplus-benefits-state-dev \
  --region eu-west-1 \
  --query "Items[*].{Account:accountNumber.S,VoucherCode:voucherCode.S,LastClaimed:lastClaimedAt.N}"
```

---

## Troubleshooting

### Common Issues

#### 1. "Parameter /octoplus/dev/account-X/api-key not found"

**Cause**: SSM parameters not configured.

**Solution**: Follow [SSM Parameter Store Configuration](#ssm-parameter-store-configuration).

#### 2. "Email address is not verified"

**Cause**: SES sender/recipient not verified.

**Solution**:
- Verify sender: `soosgyul@gmail.com`
- In sandbox mode, also verify recipient emails
- Check [AWS SES Email Verification](#aws-ses-email-verification)

#### 3. "User is not authorized to perform: dynamodb:GetItem"

**Cause**: Lambda IAM role missing DynamoDB permissions.

**Solution**: Redeploy with updated `serverless.yml` (permissions are configured correctly).

#### 4. GitHub Actions deployment fails

**Cause**: Missing or incorrect AWS credentials.

**Solution**:
- Verify GitHub secrets are set correctly
- Test AWS CLI access locally with same credentials
- Check IAM user policy includes required permissions

#### 5. Lambda times out after 30 seconds

**Cause**: Octopus API slow or network issues.

**Solution**:
- Check Octopus API status
- Increase timeout in `serverless.yml` (currently 30s)
- Check CloudWatch logs for specific error

---

## Configuration Options

### Multiple Email Recipients

Each account can send emails to multiple recipients by providing a comma-separated list of email addresses in the SSM parameter:

```bash
# Single recipient (original format)
aws ssm put-parameter \
  --name "/octoplus/dev/account-1/email" \
  --value "user1@example.com" \
  --type "String" \
  --region eu-west-1

# Multiple recipients (comma-separated)
aws ssm put-parameter \
  --name "/octoplus/dev/account-1/email" \
  --value "user1@example.com, user2@example.com, user3@example.com" \
  --type "String" \
  --region eu-west-1
```

**Important**: In SES sandbox mode, ALL recipient email addresses must be verified. See [AWS SES Email Verification](#aws-ses-email-verification).

The Lambda function will automatically parse the comma-separated list and send the same email with QR code to all recipients simultaneously using SES's multi-recipient feature.

### Force Email Sending

By default, the `FORCE_EMAIL_SEND` environment variable is set to `true` in `serverless.yml`:

```yaml
environment:
  FORCE_EMAIL_SEND: ${env:FORCE_EMAIL_SEND, 'true'}
```

**Behavior**:
- **`FORCE_EMAIL_SEND=true`** (default): Email is sent on every Lambda invocation if a voucher exists
- **`FORCE_EMAIL_SEND=false`**: Email is only sent when the voucher code changes (new voucher)

To change this setting:

1. Edit `serverless.yml`:
```yaml
environment:
  FORCE_EMAIL_SEND: 'false'
```

2. Deploy:
```bash
git commit -am "Disable forced email sending"
git push origin main  # GitHub Actions will deploy automatically
```

**Use Cases**:
- **`true`**: Good for testing or if you want to receive the email reminder every time the Lambda runs
- **`false`**: Good for production to avoid duplicate emails for the same voucher

---

## Adding/Removing Accounts

### Add Account 4

#### Step 1: Add SSM Parameters

```bash
aws ssm put-parameter \
  --name "/octoplus/dev/account-4/api-key" \
  --value "sk_live_..." \
  --type "SecureString" \
  --region eu-west-1

aws ssm put-parameter \
  --name "/octoplus/dev/account-4/account-number" \
  --value "A-..." \
  --type "String" \
  --region eu-west-1

aws ssm put-parameter \
  --name "/octoplus/dev/account-4/email" \
  --value "email@example.com" \
  --type "String" \
  --region eu-west-1
```

#### Step 2: Update `serverless.yml`

Add new schedule event:

```yaml
# Account 4 Schedule
- schedule:
    name: ${self:service}-${self:provider.stage}-account-4
    description: "Claim Caffe Nero for Account 4 (Mon 5-6:30 AM UTC)"
    rate: cron(0/10 5-6 ? * MON *)
    enabled: true
    input:
      accountNumber: "4"
```

#### Step 3: Deploy

```bash
git add serverless.yml
git commit -m "Add account 4 schedule"
git push origin main  # GitHub Actions will deploy automatically
```

### Remove Account

#### Step 1: Delete SSM Parameters

```bash
aws ssm delete-parameter --name "/octoplus/dev/account-3/api-key" --region eu-west-1
aws ssm delete-parameter --name "/octoplus/dev/account-3/account-number" --region eu-west-1
aws ssm delete-parameter --name "/octoplus/dev/account-3/email" --region eu-west-1
```

#### Step 2: Remove Schedule from `serverless.yml`

Delete the corresponding schedule block.

#### Step 3: Deploy

```bash
git commit -am "Remove account 3"
git push origin main
```

---

## Security Enhancements (Optional)

### Migrate to OIDC for GitHub Actions

OIDC is more secure than IAM access keys as it uses short-lived tokens.

#### Step 1: Create OIDC Provider

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com
```

#### Step 2: Create IAM Role for GitHub Actions

Create `github-actions-role.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YOUR_USERNAME/octoplus:*"
        }
      }
    }
  ]
}
```

```bash
aws iam create-role \
  --role-name GitHubActionsOctoplusRole \
  --assume-role-policy-document file://github-actions-role.json

aws iam attach-role-policy \
  --role-name GitHubActionsOctoplusRole \
  --policy-arn arn:aws:iam::aws:policy/PowerUserAccess
```

#### Step 3: Update `.github/workflows/deploy.yml`

Replace the deploy step with:

```yaml
- name: Configure AWS Credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: arn:aws:iam::YOUR_ACCOUNT_ID:role/GitHubActionsOctoplusRole
    aws-region: eu-west-1

- name: Deploy to AWS
  run: npx serverless deploy --stage dev --region eu-west-1 --verbose
```

#### Step 4: Remove GitHub Secrets

Delete `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` from GitHub secrets.

---

## Useful Commands

```bash
# View all Lambda logs
aws logs tail /aws/lambda/octoplus-benefits-dev-caffenero --follow

# Manually invoke Lambda
aws lambda invoke --function-name octoplus-benefits-dev-caffenero --payload '{"accountNumber":"1"}' out.json

# Check DynamoDB state
aws dynamodb scan --table-name octoplus-benefits-state-dev

# List all SSM parameters
aws ssm get-parameters-by-path --path /octoplus/dev --recursive

# Update SSM parameter
aws ssm put-parameter --name "/octoplus/dev/account-1/email" --value "new-email@example.com" --overwrite

# Check SES sending stats
aws ses get-send-statistics --region eu-west-1

# Delete stack (remove everything)
npx serverless remove --stage dev --region eu-west-1
```

---

## Support

For issues or questions:
- Check [Troubleshooting](#troubleshooting) section
- Review CloudWatch logs
- Open an issue on GitHub

---

**Last Updated**: 2025-10-25
