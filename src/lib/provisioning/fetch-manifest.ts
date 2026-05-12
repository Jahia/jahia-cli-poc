import { basename } from 'node:path';

/**
 * Downloads a provisioning manifest from a public URL.
 * Returns the content as a Buffer and the inferred filename.
 */
export const fetchManifest = async (
  url: string,
): Promise<{ readonly content: Buffer; readonly filename: string }> => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to download manifest from ${url}: HTTP ${String(response.status)} ${response.statusText}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const content = Buffer.from(arrayBuffer);
  const urlPath = new URL(url).pathname;
  const filename = basename(urlPath) || 'manifest.yaml';

  return { content, filename };
};
