/**
 * Result of cloning the environment scaffolding.
 */
export interface EnvironmentScaffoldingResult {
  readonly version: string;
  readonly repositoryUrl: string;
  readonly checkoutDir: string;
  readonly environmentDir: string;
  readonly servicesDir: string;
}
