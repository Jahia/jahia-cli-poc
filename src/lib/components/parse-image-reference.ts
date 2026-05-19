/**
 * Parses a Docker image reference that may include a tag (e.g. "jahia/jahia-ee:8.3.0.0").
 * Returns the image name and optional embedded tag separately.
 */
export const parseImageReference = (
  ref: string,
): { readonly image: string; readonly tag: string | undefined } => {
  // A colon after a slash-separated path segment indicates a tag.
  // We split on the *last* colon that isn't part of a registry port (registry:port/repo).
  // Simple heuristic: if the part after the last colon contains '/' it's not a tag.
  const lastColon = ref.lastIndexOf(':');
  if (lastColon === -1) {
    return { image: ref, tag: undefined };
  }

  const afterColon = ref.slice(lastColon + 1);
  // If afterColon contains '/' it's likely a registry:port/repo pattern, not a tag
  if (afterColon.includes('/')) {
    return { image: ref, tag: undefined };
  }

  return { image: ref.slice(0, lastColon), tag: afterColon };
};
