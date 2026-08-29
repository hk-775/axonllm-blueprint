import fc from 'fast-check';
import { ConfigAnalyzer } from '../configAnalyzer';

/**
 * Property 6: Config analysis prompt includes severity classification and remediation instructions
 *
 * For any config-analysis intent, the system prompt produced by ConfigAnalyzer
 * should instruct the model to identify security issues, misconfigurations, and
 * improvement opportunities, categorize findings by severity (Critical, Warning,
 * Informational), and provide a remediation suggestion for each finding.
 *
 * **Validates: Requirements 4.1, 4.2, 4.3**
 */
describe('ConfigAnalyzer Property Tests', () => {
  const analyzer = new ConfigAnalyzer();

  test('Property 6: Config analysis prompt includes severity classification and remediation instructions', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const prompt = analyzer.getSystemPromptSection();

        // Should contain analysis instructions for security and misconfigurations
        expect(prompt).toContain('Security issues');
        expect(prompt).toContain('Misconfigurations');
        expect(prompt).toContain('performance');

        // Should contain all severity levels
        expect(prompt).toContain('Critical');
        expect(prompt).toContain('Warning');
        expect(prompt).toContain('Informational');

        // Should contain remediation instructions
        expect(prompt).toContain('Response Contract');
        expect(prompt).toContain('remediation suggestion');
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 7: Unrecognized configuration formats are rejected
   *
   * For any string that does not match a recognized infrastructure configuration
   * format, ConfigAnalyzer.isRecognizedFormat should return false, and
   * getSupportedFormats should return a non-empty list of supported format names.
   *
   * **Validates: Requirements 4.4**
   */
  test('Property 7: Unrecognized configuration formats are rejected', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 200 }).filter((s) => {
          // Filter out strings that could accidentally match infra patterns
          const lower = s.toLowerCase();
          return (
            !lower.includes('awstemplateformatversion') &&
            !lower.includes('resources:') &&
            !lower.includes('type:') &&
            !/resource\s+"/.test(lower) &&
            !/provider\s+"/.test(lower) &&
            !/terraform\s*\{/.test(lower) &&
            !/^from\s+/im.test(s) &&
            !/^run\s+/im.test(s) &&
            !/^copy\s+/im.test(s) &&
            !/^entrypoint\s+/im.test(s) &&
            !/apiversion:/i.test(s) &&
            !/kind:\s*(deployment|service|pod|configmap|statefulset|daemonset|ingress|job|cronjob)/i.test(s)
          );
        }),
        (randomContent) => {
          // isRecognizedFormat should return false for non-infrastructure content
          expect(analyzer.isRecognizedFormat(randomContent)).toBe(false);

          // getSupportedFormats should return a non-empty list
          const formats = analyzer.getSupportedFormats();
          expect(formats.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
