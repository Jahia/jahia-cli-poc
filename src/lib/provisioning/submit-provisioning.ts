import type { ProvisioningOptions, ProvisioningResult } from './types.js';

/**
 * Submits a provisioning script (and optional file attachments) to the
 * Jahia provisioning API via multipart form POST.
 *
 * Endpoint: POST {url}/modules/api/provisioning
 * Form fields:
 *   - script: the YAML manifest (type=text/yaml)
 *   - file: zero or more binary attachments
 */
export const submitProvisioning = async (
  options: ProvisioningOptions,
): Promise<ProvisioningResult> => {
  const { url, username, password, manifestContent, manifestFilename, attachments } = options;
  const endpoint = url.endsWith('/')
    ? `${url}modules/api/provisioning`
    : `${url}/modules/api/provisioning`;
  const auth = Buffer.from(`${username}:${password}`).toString('base64');

  const form = new FormData();
  const scriptBlob = new Blob([manifestContent], { type: 'text/yaml' });
  form.append('script', scriptBlob, manifestFilename);

  attachments.forEach((attachment) => {
    const blob = new Blob([attachment.content], { type: 'application/octet-stream' });
    form.append('file', blob, attachment.filename);
  });

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
      manifest: manifestFilename,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - start;
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      statusCode: 0,
      message,
      manifest: manifestFilename,
      durationMs,
    };
  }
};
