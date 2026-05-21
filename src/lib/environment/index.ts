export type {
  DiscoveredService,
  EnvironmentScaffoldingConfig,
  EnvironmentScaffoldingResult,
  SelectionRule,
  ServiceDependency,
  ServiceGroupConfig,
  ServiceMetadata,
  ServiceSelection,
  ServicesConfig,
} from './types.js';
export { cloneEnvironmentScaffolding } from './clone-environment-scaffolding.js';
export { parseServicesConfig } from './parse-services-config.js';
export { parseServiceMetadata } from './parse-service-metadata.js';
export { discoverServices } from './discover-services.js';
export { promptServiceSelection } from './prompt-service-selection.js';
export { validateSelection } from './validate-selection.js';
export { assembleComposeFile } from './assemble-compose-file.js';
