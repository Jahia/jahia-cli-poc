import type { FileActionResult } from './types.js';

/**
 * Attempts to parse a string as JSON. Returns the parsed value on success
 * or undefined if the string is not valid JSON.
 */
const parseJsonSafe = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
};

/**
 * Provisioning action types supported by the Jahia provisioning API.
 * - module: installs or upgrades a bundle (JAR)
 * - script: executes a provisioning script (groovy, etc.)
 */
export type FileActionType = 'module' | 'script';

/**
 * Builds the JSON script payload for the provisioning API based on action type.
 */
export const buildScriptPayload = (actionType: FileActionType, filename: string): string => {
  const payload = actionType === 'module'
    ? [{ installOrUpgradeBundle: filename, forceUpdate: true }]
    : [{ executeScript: filename }];
  return JSON.stringify(payload);
};

/**
 * Submits a single file to the Jahia provisioning API.
 *
 * The `script` form field is sent as a plain text string (not a file blob),
 * containing a JSON array that describes the operation.
 * The `file` form field carries the binary file content.
 *
 * Endpoint: POST {url}/modules/api/provisioning
 */
export const submitFileAction = async (options: {
  readonly url: string;
  readonly username: string;
  readonly password: string;
  readonly filename: string;
  readonly content: Buffer;
  readonly actionType: FileActionType;
}): Promise<FileActionResult> => {
  const { url, username, password, filename, content, actionType } = options;
  const endpoint = url.endsWith('/')
    ? `${url}modules/api/provisioning`
    : `${url}/modules/api/provisioning`;
  const auth = Buffer.from(`${username}:${password}`).toString('base64');

  const form = new FormData();
  form.append('script', buildScriptPayload(actionType, filename));

  const fileBlob = new Blob([content], { type: 'application/octet-stream' });
  form.append('file', fileBlob, filename);

  const start = Date.now();

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        Origin: url.endsWith('/') ? url.slice(0, -1) : url,
      },
      body: form,
    });

    const responseText = await response.text();
    const durationMs = Date.now() - start;

    return {
      success: response.ok,
      statusCode: response.status,
      message: responseText,
      responseBody: parseJsonSafe(responseText),
      filename,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - start;
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      statusCode: 0,
      message,
      responseBody: undefined,
      filename,
      durationMs,
    };
  }
};
