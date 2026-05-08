import { execa } from 'execa';

import type { WorkflowStep } from '../config/types.js';
import type { StepResult, WorkflowResult } from './types.js';
import { buildFlagsFromWith, getStepDisplayName } from './types.js';

/**
 * Options for executing a workflow.
 */
export interface ExecuteWorkflowOptions {
  readonly steps: readonly WorkflowStep[];
  readonly configPath: string;
  readonly statePath?: string | undefined;
  readonly cwd: string;
  readonly onStepStart?: ((name: string, index: number) => void) | undefined;
  readonly onStepComplete?: ((result: StepResult, index: number) => void) | undefined;
  readonly cliEntryPoint: string;
}

/**
 * Executes a shell command (`run:` step) via execa.
 * Inherits stdio so output streams to the terminal in real time.
 */
const executeRunStep = async (
  command: string,
  cwd: string,
  env: Readonly<Record<string, string>>,
): Promise<void> => {
  await execa({
    shell: true,
    cwd,
    env: { ...env },
    stdio: 'inherit',
  })`${command}`;
};

/**
 * Executes a jahia-cli command (`uses:` step) by spawning a subprocess.
 * Automatically passes --config and --state flags when available.
 */
const executeUsesStep = async (
  command: string,
  withFlags: Readonly<Record<string, string>> | undefined,
  cwd: string,
  env: Readonly<Record<string, string>>,
  configPath: string,
  statePath: string | undefined,
  cliEntryPoint: string,
): Promise<void> => {
  const baseFlags = buildFlagsFromWith(withFlags);

  const autoFlags = [
    '--config',
    configPath,
    ...(statePath !== undefined ? ['--state', statePath] : []),
  ];

  const args = [cliEntryPoint, ...command.split(' '), ...baseFlags, ...autoFlags];

  await execa('node', args, {
    cwd,
    env: { ...env },
    stdio: 'inherit',
  });
};

/**
 * Internal state accumulated across workflow steps.
 */
interface WorkflowState {
  readonly results: readonly StepResult[];
  readonly env: Readonly<Record<string, string>>;
  readonly halted: boolean;
}

/**
 * Processes a single workflow step, returning updated state.
 */
const processStep = async (
  statePromise: Promise<WorkflowState>,
  step: WorkflowStep,
  index: number,
  options: ExecuteWorkflowOptions,
): Promise<WorkflowState> => {
  const state = await statePromise;

  if (state.halted) {
    return state;
  }

  const {
    configPath,
    statePath,
    cwd,
    onStepStart,
    onStepComplete,
    cliEntryPoint,
  } = options;

  const name = getStepDisplayName(step, index);
  const stepCwd = step.working_dir ?? cwd;
  const stepStart = Date.now();

  onStepStart?.(name, index);

  try {
    if (step.run !== undefined) {
      await executeRunStep(step.run, stepCwd, state.env);
    } else if (step.uses !== undefined) {
      await executeUsesStep(
        step.uses,
        step.with,
        stepCwd,
        state.env,
        configPath,
        statePath,
        cliEntryPoint,
      );
    }

    const result: StepResult = {
      name,
      success: true,
      durationMs: Date.now() - stepStart,
    };
    onStepComplete?.(result, index);

    return {
      results: [...state.results, result],
      env: state.env,
      halted: false,
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    const result: StepResult = {
      name,
      success: false,
      error: errorMessage,
      durationMs: Date.now() - stepStart,
    };
    onStepComplete?.(result, index);

    return {
      results: [...state.results, result],
      env: state.env,
      halted: true,
    };
  }
};

/**
 * Executes a workflow's steps sequentially.
 * Each step's environment is accumulated and passed to subsequent steps.
 * Stops on first failure.
 */
export const executeWorkflow = async (options: ExecuteWorkflowOptions): Promise<WorkflowResult> => {
  const workflowStart = Date.now();

  const initialState: WorkflowState = {
    results: [],
    env: {},
    halted: false,
  };

  const finalState = await options.steps.reduce(
    (acc, step, index) => processStep(acc, step, index, options),
    Promise.resolve(initialState),
  );

  return {
    success: !finalState.halted,
    steps: finalState.results,
    totalDurationMs: Date.now() - workflowStart,
  };
};
