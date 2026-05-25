export type {
  DiscoveredService,
  EnvironmentScaffoldingResult,
  ServiceDependency,
  ServiceMetadata,
  ServiceSelection,
} from './types.js';
export { cloneEnvironmentScaffolding } from './clone-environment-scaffolding.js';
export { parseServiceMetadata } from './parse-service-metadata.js';
export { discoverServices } from './discover-services.js';
export { assembleComposeFile } from './assemble-compose-file.js';
