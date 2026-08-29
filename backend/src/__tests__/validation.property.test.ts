import * as fc from 'fast-check';
import { validateInferenceParams } from '../validation';
import { PARAM_RANGES } from '../constants';

const FC_CONFIG = { numRuns: 100 };

describe('Property 10: Parameter validation accepts valid values and rejects out-of-range values', () => {
  test('temperature within range is accepted, outside range is rejected with boundaries', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
        (value) => {
          const result = validateInferenceParams({ temperature: value });
          const { min, max } = PARAM_RANGES.temperature;
          if (value >= min && value <= max) {
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
          } else {
            expect(result.valid).toBe(false);
            expect(result.error).toContain(String(min));
            expect(result.error).toContain(String(max));
          }
        }
      ),
      FC_CONFIG
    );
  });

  test('maxTokens within range is accepted, outside range is rejected with boundaries', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 10000 }),
        (value) => {
          const result = validateInferenceParams({ maxTokens: value });
          const { min, max } = PARAM_RANGES.maxTokens;
          if (value >= min && value <= max) {
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
          } else {
            expect(result.valid).toBe(false);
            expect(result.error).toContain(String(min));
            expect(result.error).toContain(String(max));
          }
        }
      ),
      FC_CONFIG
    );
  });

  test('topP within range is accepted, outside range is rejected with boundaries', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
        (value) => {
          const result = validateInferenceParams({ topP: value });
          const { min, max } = PARAM_RANGES.topP;
          if (value >= min && value <= max) {
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
          } else {
            expect(result.valid).toBe(false);
            expect(result.error).toContain(String(min));
            expect(result.error).toContain(String(max));
          }
        }
      ),
      FC_CONFIG
    );
  });

  test('empty params are considered valid', () => {
    const result = validateInferenceParams({});
    expect(result.valid).toBe(true);
  });
});
