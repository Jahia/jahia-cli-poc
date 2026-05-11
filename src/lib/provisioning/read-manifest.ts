import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

/**
 * Reads a provisioning manifest from a local file path.
 * Returns the content as a Buffer and the basename for form submission.
 */
export const readManifest = async (
  filePath: string,
): Promise<{ readonly content: Buffer; readonly filename: string }> => {
  const content = await readFile(filePath);
  const filename = basename(filePath);
  return { content, filename };
};
