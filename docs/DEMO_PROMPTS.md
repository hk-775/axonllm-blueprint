# Demo prompts

## Architecture

```text
Design a secure multi-account event ingestion platform on AWS. Include trust boundaries, failure modes, service tradeoffs, and a phased delivery plan.
```

## Terraform

```text
Create Terraform for a private API Gateway endpoint backed by Lambda and DynamoDB. Include least-privilege IAM, encryption, logging, variables, provider constraints, and outputs.
```

## Configuration review

```text
Review the following CloudFormation for security and reliability issues. Categorize findings by severity, explain impact, and show corrected snippets:

Resources:
  DataBucket:
    Type: AWS::S3::Bucket
    Properties:
      AccessControl: PublicRead
```

## Troubleshooting

```text
Troubleshoot an AccessDeniedException from a Lambda function calling Bedrock Converse. Give read-only checks first, then remediation and prevention.
```
