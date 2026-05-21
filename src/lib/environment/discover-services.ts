import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import type { DiscoveredService } from './types.js';
import { parseServiceMetadata } from './parse-service-metadata.js';

const CONFIG_FILENAME = 'config.yml';
const YML_EXTENSION = '.yml';

/**
 * Discovers all service definitions in a services directory.
 * Reads each .yml file (excluding config.yml), parses its x-metadata,
 * and returns an array of DiscoveredService objects.
 */
export const discoverServices = async (servicesDir: string): Promise<readonly DiscoveredService[]> => {
  const entries = await readdir(servicesDir);

  const serviceFiles = entries.filter(
    (entry) => entry.endsWith(YML_EXTENSION) && entry !== CONFIG_FILENAME,
  );

  const services = await Promise.all(
    serviceFiles.map(async (filename) => {
      const filePath = join(servicesDir, filename);
      const content = await readFile(filePath, 'utf-8');
      const metadata = parseServiceMetadata(content, filename);
      return { filename, metadata };
    }),
  );

  return services;
};
