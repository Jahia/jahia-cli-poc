import type { WorkflowConfig } from '../config/types.js';

/**
 * Builds a sample workflow configuration with representative steps
 * to help users get started quickly.
 */
export const buildSampleWorkflow = (): WorkflowConfig => ({
  steps: [
    {
      name: 'Initialize test scaffolding',
      uses: 'tests:init',
    },
    {
      name: 'Create Jahia environment',
      uses: 'environment:create',
    },
    {
      name: 'Wait for Jahia to be healthy',
      uses: 'environment:alive',
      with: { timeout: '300' },
    },
    {
      name: 'Run tests',
      run: 'echo "Replace this with your test command, e.g.: npx cypress run"',
    },
    {
      name: 'Cleanup environment',
      uses: 'environment:delete',
    },
  ],
});
