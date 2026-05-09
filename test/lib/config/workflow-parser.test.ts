import { describe, expect, test } from 'vitest';

import {
  parseWorkflowConfig,
  validateConfig,
  validateWorkflowStep,
} from '../../../src/lib/config/parser.js';

describe('Workflow Config Parser', () => {
  describe('validateWorkflowStep', () => {
    test('accepts a valid run step', () => {
      const step = validateWorkflowStep({ name: 'build', run: 'npm run build' }, 0);
      expect(step.name).toBe('build');
      expect(step.run).toBe('npm run build');
      expect(step.uses).toBeUndefined();
    });

    test('accepts a valid uses step', () => {
      const step = validateWorkflowStep({ name: 'create env', uses: 'environment:create' }, 0);
      expect(step.name).toBe('create env');
      expect(step.uses).toBe('environment:create');
      expect(step.run).toBeUndefined();
    });

    test('accepts a uses step with "with" flags', () => {
      const step = validateWorkflowStep(
        { uses: 'environment:alive', with: { timeout: '300' } },
        0,
      );
      expect(step.uses).toBe('environment:alive');
      expect(step.with).toEqual({ timeout: '300' });
    });

    test('accepts a step with working_dir', () => {
      const step = validateWorkflowStep(
        { run: 'npm test', working_dir: './tests' },
        0,
      );
      expect(step.working_dir).toBe('./tests');
    });

    test('rejects a step with neither run nor uses', () => {
      expect(() => validateWorkflowStep({ name: 'bad' }, 0)).toThrow(
        'must have either "run"',
      );
    });

    test('rejects a step with both run and uses', () => {
      expect(() =>
        validateWorkflowStep({ run: 'echo hi', uses: 'environment:create' }, 0),
      ).toThrow('must have either "run" or "uses", not both');
    });

    test('rejects a non-object step', () => {
      expect(() => validateWorkflowStep('bad', 0)).toThrow('must be an object');
    });

    test('rejects an array step', () => {
      expect(() => validateWorkflowStep(['bad'], 0)).toThrow('must be an object');
    });

    test('omits undefined optional fields from output', () => {
      const step = validateWorkflowStep({ run: 'echo hi' }, 0);
      expect(Object.keys(step)).toEqual(['run']);
    });
  });

  describe('parseWorkflowConfig', () => {
    test('returns undefined for undefined input', () => {
      expect(parseWorkflowConfig(undefined)).toBeUndefined();
    });

    test('parses a valid workflow with steps', () => {
      const result = parseWorkflowConfig({
        steps: [{ run: 'echo hello' }, { uses: 'environment:create' }],
      });
      expect(result).toBeDefined();
      expect(result?.steps).toHaveLength(2);
    });

    test('rejects non-object workflow', () => {
      expect(() => parseWorkflowConfig('bad')).toThrow('must be an object');
    });

    test('rejects workflow without steps', () => {
      expect(() => parseWorkflowConfig({})).toThrow('must include a "steps" array');
    });

    test('rejects workflow with empty steps', () => {
      expect(() => parseWorkflowConfig({ steps: [] })).toThrow(
        'must contain at least one step',
      );
    });

    test('rejects workflow with non-array steps', () => {
      expect(() => parseWorkflowConfig({ steps: 'bad' })).toThrow(
        'must include a "steps" array',
      );
    });
  });

  describe('validateConfig with workflow', () => {
    test('validates config with workflow section', () => {
      const config = validateConfig({
        workflow: {
          steps: [{ name: 'test', run: 'echo hello' }],
        },
      });
      expect(config.workflow).toBeDefined();
      expect(config.workflow?.steps).toHaveLength(1);
    });

    test('validates config with all three sections', () => {
      const config = validateConfig({
        environment: { components: ['jahia'] },
        tests: { 'jahia-cypress': 'v1.0.0' },
        workflow: {
          steps: [{ uses: 'environment:create' }],
        },
      });
      expect(config.environment).toBeDefined();
      expect(config.tests).toBeDefined();
      expect(config.workflow).toBeDefined();
    });

    test('validates config without workflow', () => {
      const config = validateConfig({
        environment: { components: ['jahia'] },
      });
      expect(config.workflow).toBeUndefined();
    });
  });
});
