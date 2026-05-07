export type { ScaffoldingCloneResult, SyncAction, SyncedFileEntry, SyncLogger, SyncMissingFilesParams, SyncMissingFilesResult } from './types.js';
export {
  cloneScaffolding,
  buildCloneArgs,
  DEFAULT_CYPRESS_REPOSITORY,
  resolveLatestTag,
  parseLatestTagFromLsRemote,
} from './clone-scaffolding.js';
export { syncMissingFiles } from './sync-missing-files.js';
export { isExcluded, DEFAULT_EXCLUSION_PATTERNS } from './exclusion-list.js';
export { updateGitignore, buildManagedSection, replaceManagedSection } from './gitignore-manager.js';
