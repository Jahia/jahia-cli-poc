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
      with: { force: 'true' },
    },
    {
      name: 'Wait for Jahia to be healthy',
      uses: 'environment:alive',
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
});
