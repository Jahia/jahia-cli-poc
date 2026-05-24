/**
 * In the docker-compose model, test containers are managed by docker compose.
 * This function is a no-op stub kept for API compatibility.
 */
export const persistTestContainer = async (
  _statePath: string,
  _name: string,
  _image: string,
  _tag: string,
  _networkAliases: readonly string[],
  _ports: readonly { readonly container: number; readonly host: number }[],
): Promise<void> => {
  // No-op: docker-compose manages container lifecycle
};
