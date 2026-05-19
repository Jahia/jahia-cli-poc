/**
 * A host-to-container bind mount for Docker.
 * Uses `--mount type=bind` syntax for cross-platform safety (Windows paths contain colons).
 */
export interface BindMount {
  readonly host: string;
  readonly container: string;
  readonly readOnly?: boolean | undefined;
}

/**
 * Configuration for Docker container log driver.
 */
export interface LogDriverConfig {
  readonly driver: string;
  readonly options: Readonly<Record<string, string>>;
}
