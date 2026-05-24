const REDACTED_MARKER = '***REDACTED***';
const MAX_DISPLAY_LENGTH = 200;
const AVAILABLE_LENGTH = MAX_DISPLAY_LENGTH - REDACTED_MARKER.length;
const HALF_LENGTH = Math.floor(AVAILABLE_LENGTH / 2);

/**
 * Truncates a non-secret value that exceeds 200 characters.
 * Inserts '***REDACTED***' in the middle, keeping the total at 200 characters.
 * Values of 200 characters or fewer are returned unchanged.
 * Empty values return '[EMPTY]'.
 */
export const truncateLongValue = (value: string): string =>
  value.length === 0
    ? '[EMPTY]'
    : value.length <= MAX_DISPLAY_LENGTH
      ? value
      : `${value.slice(0, HALF_LENGTH)}${REDACTED_MARKER}${value.slice(-HALF_LENGTH)}`;
