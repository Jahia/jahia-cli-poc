import { describe, expect, test } from 'vitest';

import {
  resolveWorkflowByName,
  resolveDefaultWorkflow,
  detectCircularCall,
} from '../../../src/lib/workflow/resolve-workflow.js';
import type { WorkflowsMap } from '../../../src/lib/config/types.js';

const sampleWorkflows: WorkflowsMap = {
  setup: {
    steps: [{ uses: 'environment:create' }],
  },
  test: {
    steps: [{ run: 'yarn test' }],
  },
  full: {
    default: true,
    steps: [
      { uses: 'workflow:run', with: { name: 'setup' } },
      { uses: 'workflow:run', with: { name: 'test' } },
    ],
  },
};

describe('resolveWorkflowByName', () => {
  test('resolves an existing workflow by name', () => {
    const workflow = resolveWorkflowByName(sampleWorkflows, 'setup');
    expect(workflow.steps).toHaveLength(1);
    expect(workflow.steps[0]?.uses).toBe('environment:create');
  });

  test('throws for non-existent workflow name', () => {
    expect(() => resolveWorkflowByName(sampleWorkflows, 'missing')).toThrow(
      'Workflow "missing" not found',
    );
  });

  test('includes available workflow names in error', () => {
    expect(() => resolveWorkflowByName(sampleWorkflows, 'missing')).toThrow(
      'setup',
    );
  });
});

describe('resolveDefaultWorkflow', () => {
  test('resolves the default workflow', () => {
    const { name, workflow } = resolveDefaultWorkflow(sampleWorkflows);
    expect(name).toBe('full');
    expect(workflow.default).toBe(true);
  });

  test('throws when no default exists', () => {
    const noDefault: WorkflowsMap = {
      a: { steps: [{ run: 'echo a' }] },
      b: { steps: [{ run: 'echo b' }] },
    };
    expect(() => resolveDefaultWorkflow(noDefault)).toThrow(
      'No default workflow found',
    );
  });

  test('includes available names in error', () => {
    const noDefault: WorkflowsMap = {
      setup: { steps: [{ run: 'echo' }] },
    };
    expect(() => resolveDefaultWorkflow(noDefault)).toThrow('setup');
  });
});

describe('detectCircularCall', () => {
  test('does nothing when no cycle exists', () => {
    expect(() => {
      detectCircularCall('test', ['full']);
    }).not.toThrow();
  });

  test('throws when cycle is detected', () => {
    expect(() => {
      detectCircularCall('full', ['full', 'setup']);
    }).toThrow('Circular workflow detected');
  });

  test('includes the call chain in error', () => {
    expect(() => {
      detectCircularCall('setup', ['full', 'setup']);
    }).toThrow('full → setup → setup');
  });

  test('does not throw for empty call stack', () => {
    expect(() => {
      detectCircularCall('full', []);
    }).not.toThrow();
  });
});
