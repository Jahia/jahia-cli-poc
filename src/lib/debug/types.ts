/**
 * A single collected JCLI environment variable entry.
 */
export interface JcliEnvEntry {
  readonly key: string;
  readonly value: string;
  readonly isSecret: boolean;
}
