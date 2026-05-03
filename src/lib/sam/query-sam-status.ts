import type { SamHealth, SamQueryResult } from './types.js';

const SAM_QUERY = `
  query($severity: GqlProbeSeverity) {
    admin {
      jahia {
        healthCheck(severity: $severity) {
          status {
            health
            message
          }
        }
      }
    }
  }
`;

interface SamResponse {
  data?: {
    admin?: {
      jahia?: {
        healthCheck?: {
          status?: {
            health?: string;
            message?: string;
          };
        };
      };
    };
  };
  errors?: unknown[];
}

/**
 * Queries the SAM GraphQL endpoint and returns the current health status.
 */
export const querySamStatus = async (
  url: string,
  username: string,
  password: string,
  severity: string,
): Promise<SamQueryResult> => {
  const endpoint = url.endsWith('/') ? `${url}modules/graphql` : `${url}/modules/graphql`;
  const auth = Buffer.from(`${username}:${password}`).toString('base64');

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({ query: SAM_QUERY, variables: { severity } }),
    });

    if (!response.ok) {
      return {
        health: 'UNREACHABLE',
        message: `HTTP ${String(response.status)}: ${response.statusText}`,
      };
    }

    const data = (await response.json()) as SamResponse;

    if (data.errors && data.errors.length > 0) {
      return { health: 'ERROR', message: `GraphQL errors: ${JSON.stringify(data.errors)}` };
    }

    const status = data.data?.admin?.jahia?.healthCheck?.status;
    const health = status?.health as SamHealth | undefined;
    const message = status?.message ?? '';

    if (!health) {
      return { health: 'UNREACHABLE', message: 'No health status in response' };
    }

    return { health, message };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { health: 'UNREACHABLE', message };
  }
};
