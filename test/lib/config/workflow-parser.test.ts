import { describe, expect, test } from 'vitest';

import {
  parseSingleWorkflow,
  parseWorkflowsConfig,
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
        { uses: 'jahia:alive', with: { timeout: '300' } },
        0,
      );
      expect(step.uses).toBe('jahia:alive');
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

  describe('parseSingleWorkflow', () => {
    test('parses a valid workflow with steps', () => {
      const result = parseSingleWorkflow({
        steps: [{ run: 'echo hello' }, { uses: 'environment:create' }],
      }, 'test');
      expect(result.steps).toHaveLength(2);
    });

    test('parses workflow with default flag', () => {
      const result = parseSingleWorkflow({
        default: true,
        steps: [{ run: 'echo hello' }],
      }, 'main');
      expect(result.default).toBe(true);
    });

    test('omits default when not set', () => {
      const result = parseSingleWorkflow({
        steps: [{ run: 'echo hello' }],
      }, 'test');
      expect(result.default).toBeUndefined();
    });

    test('rejects non-object workflow', () => {
      expect(() => parseSingleWorkflow('bad', 'test')).toThrow('must be an object');
    });

    test('rejects workflow without steps', () => {
      expect(() => parseSingleWorkflow({}, 'test')).toThrow('must include a "steps" array');
    });

    test('rejects workflow with empty steps', () => {
      expect(() => parseSingleWorkflow({ steps: [] }, 'test')).toThrow(
        'must contain at least one step',
      );
    });
  });

  describe('parseWorkflowsConfig', () => {
    test('returns undefined for undefined input', () => {
      expect(parseWorkflowsConfig(undefined)).toBeUndefined();
    });

    test('parses a valid workflows map', () => {
      const result = parseWorkflowsConfig({
        main: { default: true, steps: [{ run: 'echo hello' }] },
        setup: { steps: [{ uses: 'environment:create' }] },
      });
      expect(result).toBeDefined();
      expect(Object.keys(result ?? {})).toHaveLength(2);
    });

    test('rejects non-object workflows', () => {
      expect(() => parseWorkflowsConfig('bad')).toThrow('must be a map');
    });

    test('rejects empty workflows map', () => {
      expect(() => parseWorkflowsConfig({})).toThrow('must contain at least one');
    });

    test('rejects multiple defaults', () => {
      expect(() => parseWorkflowsConfig({
        a: { default: true, steps: [{ run: 'echo a' }] },
        b: { default: true, steps: [{ run: 'echo b' }] },
      })).toThrow('Only one workflow may have "default: true"');
    });

    test('allows workflows with no default', () => {
      const result = parseWorkflowsConfig({
        setup: { steps: [{ run: 'echo setup' }] },
        test: { steps: [{ run: 'echo test' }] },
      });
      expect(result).toBeDefined();
    });

    test('rejects array workflows', () => {
      expect(() => parseWorkflowsConfig([{ steps: [{ run: 'echo' }] }])).toThrow('must be a map');
    });
  });

  describe('validateConfig with workflows', () => {
    test('validates config with workflows section', () => {
      const config = validateConfig({
        workflows: {
          main: { default: true, steps: [{ name: 'test', run: 'echo hello' }] },
        },
      });
      expect(config.workflows).toBeDefined();
      expect(config.workflows?.['main']?.steps).toHaveLength(1);
    });

    test('validates config with all three sections', () => {
      const config = validateConfig({
        environment: { components: ['jahia'] },
        tests: { 'jahia-cypress': 'v1.0.0' },
        workflows: {
          main: { default: true, steps: [{ uses: 'environment:create' }] },
        },
      });
      expect(config.environment).toBeDefined();
      expect(config.tests).toBeDefined();
      expect(config.workflows).toBeDefined();
    });

    test('validates config without workflows', () => {
      const config = validateConfig({
        environment: { components: ['jahia'] },
      });
      expect(config.workflows).toBeUndefined();
    });

    test('rejects legacy workflow: key with migration error', () => {
      expect(() => validateConfig({
        workflow: { steps: [{ run: 'echo hello' }] },
      })).toThrow('deprecated "workflow:" key');
    });
  });
});
