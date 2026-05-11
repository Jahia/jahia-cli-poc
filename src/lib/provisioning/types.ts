/**
 * Result of a provisioning script submission.
 */
export interface ProvisioningResult {
  readonly success: boolean;
  readonly statusCode: number;
  readonly message: string;
  readonly manifest: string;
  readonly durationMs: number;
}

/**
 * Options for submitting a provisioning script to Jahia.
 */
export interface ProvisioningOptions {
  readonly url: string;
  readonly username: string;
  readonly password: string;
  readonly manifestContent: Buffer;
  readonly manifestFilename: string;
  readonly attachments: readonly ProvisioningAttachment[];
}

/**
 * A file attachment to include alongside the provisioning script.
 */
export interface ProvisioningAttachment {
  readonly filename: string;
  readonly content: Buffer;
}

/**
 * The source type of a provisioning manifest.
 */
export type ManifestSource = 'file' | 'url';
