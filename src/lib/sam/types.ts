export type SamHealth = 'GREEN' | 'YELLOW' | 'RED';

/**
 * Result of a single SAM HTTP query.
 */
export interface SamQueryResult {
  readonly health: SamHealth | 'ERROR' | 'UNREACHABLE';
  readonly message: string;
}

/**
 * Progress event emitted on each poll tick.
 */
export interface SamPollEvent {
  readonly health: SamHealth | 'ERROR' | 'UNREACHABLE';
  readonly consecutiveGreen: number;
  readonly elapsedSeconds: number;
  readonly message: string;
}

/**
 * Configuration for the SAM wait loop.
 */
export interface WaitForSamOptions {
  readonly url: string;
  readonly username: string;
  readonly password: string;
  readonly severity: string;
  readonly intervalSeconds: number;
  readonly timeoutSeconds: number;
  readonly consecutiveCount: number;
  readonly onPoll?: ((event: SamPollEvent) => void) | undefined;
}

/**
 * Final result returned by waitForSam when polling completes.
 */
export interface SamWaitResult {
  readonly success: boolean;
  readonly elapsedSeconds: number;
  readonly consecutiveGreen: number;
  readonly lastHealth: SamHealth | 'ERROR' | 'UNREACHABLE';
  readonly message: string;
}
