import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

import type { ProvisioningAttachment } from './types.js';

/**
 * Reads file attachments from disk and returns them as ProvisioningAttachment objects.
 */
export const loadAttachments = async (
  filePaths: readonly string[],
): Promise<readonly ProvisioningAttachment[]> => {
  const results = await Promise.all(
    filePaths.map(async (filePath) => {
      const content = await readFile(filePath);
      return { filename: basename(filePath), content };
    }),
  );
  return results;
};
