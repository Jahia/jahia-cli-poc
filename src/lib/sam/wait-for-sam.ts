import type { SamPollEvent, SamWaitResult, WaitForSamOptions } from './types.js';
import { querySamStatus } from './query-sam-status.js';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const elapsedSeconds = (startTimeMs: number): number =>
  Math.round((Date.now() - startTimeMs) / 1000);

const makePollEvent = (
  health: SamPollEvent['health'],
  consecutiveGreen: number,
  elapsed: number,
  message: string,
): SamPollEvent => ({ health, consecutiveGreen, elapsedSeconds: elapsed, message });

const step = async (
  options: WaitForSamOptions,
  consecutiveGreen: number,
  startTimeMs: number,
): Promise<SamWaitResult> => {
  const elapsed = elapsedSeconds(startTimeMs);

  if (elapsed >= options.timeoutSeconds) {
    throw new Error(
      `Timeout after ${String(options.timeoutSeconds)}s waiting for ${String(options.consecutiveCount)} consecutive GREEN responses from SAM`,
    );
  }

  const result = await querySamStatus(options.url, options.username, options.password, options.severity);
  const newConsecutive = result.health === 'GREEN' ? consecutiveGreen + 1 : 0;
  const event = makePollEvent(result.health, newConsecutive, elapsed, result.message);

  options.onPoll?.(event);

  if (newConsecutive >= options.consecutiveCount) {
    return {
      success: true,
      elapsedSeconds: elapsed,
      consecutiveGreen: newConsecutive,
      lastHealth: 'GREEN',
      message: `SAM confirmed GREEN after ${String(elapsed)}s`,
    };
  }

  await sleep(options.intervalSeconds * 1000);
  return step(options, newConsecutive, startTimeMs);
};

/**
 * Polls the SAM endpoint until consecutiveCount GREEN responses are received
 * or the timeout is exceeded. Emits a SamPollEvent on each tick via onPoll.
 */
export const waitForSam = (options: WaitForSamOptions): Promise<SamWaitResult> =>
  step(options, 0, Date.now());
