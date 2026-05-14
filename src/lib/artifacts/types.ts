/**
 * Result of copying a single artifact path from a container.
 */
export interface ArtifactCopyResult {
  readonly path: string;
  readonly success: boolean;
  readonly error?: string | undefined;
}

/**
 * Outcome of collecting all artifacts for a single component.
 */
export interface ComponentCollectionResult {
  readonly componentName: string;
  readonly containerId: string;
  readonly logFile: string | undefined;
  readonly logSource: 'victorialogs' | 'docker' | undefined;
  readonly logError?: string | undefined;
  readonly artifacts: readonly ArtifactCopyResult[];
}

/**
 * Overall result of collecting artifacts for the entire environment.
 */
export interface CollectionResult {
  readonly envName: string;
  readonly outputDir: string;
  readonly components: readonly ComponentCollectionResult[];
}
