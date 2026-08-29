import type { IacFormat } from './types';

const FORMAT_INSTRUCTIONS: Record<IacFormat, string[]> = {
  cloudformation: [
    '## Format: CloudFormation',
    'Generate valid AWS CloudFormation YAML.',
    'Use Parameters, Conditions, and Outputs where they improve reuse.',
    'Prefer current resource types and verify version-sensitive properties.',
  ],
  terraform: [
    '## Format: Terraform',
    'Generate valid Terraform HCL for the AWS provider.',
    'Define variables, outputs, provider constraints, and required versions.',
    'Avoid embedding credentials or account-specific identifiers.',
  ],
  cdk: [
    '## Format: AWS CDK',
    'Generate AWS CDK TypeScript.',
    'Prefer L2 constructs and explicit removal policies.',
    'Include the imports and stack code needed to understand the example.',
  ],
};

export class IaCGenerator {
  getSystemPromptSection(format: IacFormat): string {
    return [
      ...FORMAT_INSTRUCTIONS[format],
      '',
      '## IaC Best Practices',
      '- Apply least privilege to IAM roles and policies.',
      '- Enable encryption, logging, monitoring, and recovery controls.',
      '- Parameterize environment-specific values.',
      '- Add ownership, environment, and cost-allocation tagging.',
      '- Call out destructive changes and deployment prerequisites.',
      '- Return one complete template in a fenced code block.',
      '- Follow the template with assumptions and validation commands.',
    ].join('\n');
  }

  getDefaultFormat(): 'cloudformation' {
    return 'cloudformation';
  }
}
