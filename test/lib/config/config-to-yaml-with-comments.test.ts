import { describe, expect, test } from 'vitest';

import { insertSectionComments } from '../../../src/lib/config/config-to-yaml-with-comments.js';
import { configToYamlWithComments } from '../../../src/lib/config/config-to-yaml-with-comments.js';
import type { JahiaCliConfig } from '../../../src/lib/config/types.js';

describe('insertSectionComments', () => {
  test('inserts environment comment before environment section', () => {
    const yaml = 'environment:\n  name: test\n';
    const result = insertSectionComments(yaml);
    expect(result).toContain('# ── Environment');
    expect(result).toContain('environment:\n');
  });

  test('inserts tests comment before tests section', () => {
    const yaml = 'tests:\n  scaffolding:\n';
    const result = insertSectionComments(yaml);
    expect(result).toContain('# ── Tests');
    expect(result).toContain('tests:\n');
  });

  test('inserts workflows comment before workflows section', () => {
    const yaml = 'workflows:\n  main:\n';
    const result = insertSectionComments(yaml);
    expect(result).toContain('# ── Workflows');
    expect(result).toContain('workflows:\n');
  });

  test('inserts all three comments for full config', () => {
    const yaml = 'environment:\n  name: test\ntests:\n  key: val\nworkflows:\n  main:\n';
    const result = insertSectionComments(yaml);
    expect(result).toContain('# ── Environment');
    expect(result).toContain('# ── Tests');
    expect(result).toContain('# ── Workflows');
  });

  test('adds blank line between sections', () => {
    const yaml = 'environment:\n  name: test\ntests:\n  key: val\n';
    const result = insertSectionComments(yaml);
    const lines = result.split('\n');
    const testsCommentIndex = lines.findIndex((l) => l.includes('# ── Tests'));
    expect(testsCommentIndex).toBeGreaterThan(0);
    expect(lines[testsCommentIndex - 1]).toBe('');
  });

  test('does not add blank line before first section', () => {
    const yaml = 'environment:\n  name: test\n';
    const result = insertSectionComments(yaml);
    expect(result.startsWith('# ── Environment')).toBe(true);
  });

  test('preserves content without matching sections', () => {
    const yaml = 'custom:\n  key: val\n';
    const result = insertSectionComments(yaml);
    expect(result).toBe(yaml);
  });
});

describe('configToYamlWithComments', () => {
  test('produces commented YAML for full config', () => {
    const config: JahiaCliConfig = {
      environment: {
        name: 'my-env',
        provider: 'docker',
        components: [{ name: 'jahia' }],
      },
      tests: {
        scaffolding: {
          repository: 'https://github.com/Jahia/jahia-cypress',
          path: 'scaffolding/',
          version: 'latest',
        },
      },
      workflows: {
        main: {
          default: true,
          steps: [{ name: 'test', run: 'echo hello' }],
        },
      },
    };

    const result = configToYamlWithComments(config);
    expect(result).toContain('# ── Environment');
    expect(result).toContain('# ── Tests');
    expect(result).toContain('# ── Workflows');
    expect(result).toContain('name: my-env');
    expect(result).toContain('echo hello');
  });

  test('includes documentation hints in comments', () => {
    const config: JahiaCliConfig = {
      environment: {
        name: 'test',
        provider: 'docker',
        components: [],
      },
    };

    const result = configToYamlWithComments(config);
    expect(result).toContain('provider');
    expect(result).toContain('components');
  });
});
