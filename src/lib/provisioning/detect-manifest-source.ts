import type { ManifestSource } from './types.js';

/**
 * Detects whether a manifest reference is a local file path or a URL.
 * URLs start with http:// or https://, everything else is treated as a file.
 */
export const detectManifestSource = (manifest: string): ManifestSource =>
  manifest.startsWith('http://') || manifest.startsWith('https://') ? 'url' : 'file';
