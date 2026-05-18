import type { WorkflowConfig, WorkflowsMap } from '../config/types.js';

/**
 * Builds a sample workflows configuration with representative steps
 * to help users get started quickly. Returns a named workflows map
 * with a single "main" workflow marked as default.
 */
export const buildSampleWorkflows = (): WorkflowsMap => ({
  main: {
    default: true,
    steps: [
      {
        name: 'Initialize test scaffolding',
        uses: 'tests:init',
      },
      {
        name: 'Create Jahia environment',
        uses: 'environment:create',
        with: { force: 'true' },
      },
      {
        name: 'Wait for Jahia to be healthy',
        uses: 'jahia:alive',
        with: { timeout: '300' },
      },
      {
        name: 'Install test dependencies',
        run: 'yarn',
      },
      {
        name: 'Run tests',
        run: 'yarn run e2e:ci',
      },
      {
        name: 'Cleanup environment',
        uses: 'environment:delete',
      },
    ],
  } satisfies WorkflowConfig,
});
