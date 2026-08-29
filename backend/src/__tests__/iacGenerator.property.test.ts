import { IaCGenerator } from '../iacGenerator';
import type { IacFormat } from '../types';

const cases: Array<{
  format: IacFormat;
  requiredTerms: string[];
}> = [
  {
    format: 'cloudformation',
    requiredTerms: ['CloudFormation', 'YAML'],
  },
  {
    format: 'terraform',
    requiredTerms: ['Terraform', 'HCL'],
  },
  {
    format: 'cdk',
    requiredTerms: ['AWS CDK', 'TypeScript'],
  },
];

describe.each(cases)('IaC prompt for $format', ({ format, requiredTerms }) => {
  test('combines format guidance with shared safety controls', () => {
    const prompt = new IaCGenerator().getSystemPromptSection(format);

    for (const term of requiredTerms) {
      expect(prompt).toContain(term);
    }
    expect(prompt).toContain('least privilege');
    expect(prompt).toContain('encryption');
    expect(prompt).toContain('destructive changes');
    expect(prompt).toContain('validation commands');
  });
});
