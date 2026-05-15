/**
 * Network access mode — how the CLI reaches containers.
 *
 * - `'host'`:           CLI runs on the host → use localhost:<hostPort>
 * - `'docker-network'`: CLI runs inside a Docker container on the same network → use <alias>:<containerPort>
 */
export type NetworkMode = 'host' | 'docker-network';

/**
 * Where the resolved URL originated.
 *
 * - `'flag'`:    Explicitly provided via a CLI flag (e.g. --url)
 * - `'state'`:   Derived from the persisted state file endpoints
 * - `'default'`: Hardcoded fallback (no state, no flag)
 */
export type UrlSource = 'flag' | 'state' | 'default';

/**
 * Result of resolving a component URL from state + context.
 */
export interface ResolvedUrl {
  readonly url: string;
  readonly source: UrlSource;
  readonly networkMode: NetworkMode;
}
