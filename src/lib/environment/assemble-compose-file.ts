import type { ServiceSelection } from './types.js';

/**
 * Updates an existing docker-compose.yml file content by replacing
 * the `include:` section with directives for the selected services.
 *
 * Preserves the header comments above and the networks section below.
 * The include section is expected to sit between the last header comment
 * line and the `networks:` line.
 */
export const assembleComposeFile = (
  selectedServices: readonly ServiceSelection[],
  existingContent?: string,
): string => {
  if (existingContent === undefined || existingContent.trim() === '') {
    return buildComposeFromScratch(selectedServices);
  }

  const lines = existingContent.split('\n');
  const includeIndex = lines.findIndex((line) => line.trimEnd() === 'include:');
  const networksIndex = lines.findIndex((line) => line.trimEnd() === 'networks:');

  if (includeIndex === -1 || networksIndex === -1 || networksIndex <= includeIndex) {
    return buildComposeFromScratch(selectedServices);
  }

  const header = lines.slice(0, includeIndex);
  const footer = lines.slice(networksIndex);

  const includeLines = selectedServices.map(
    (service) => `  - path: ./services/${service.filename}`,
  );

  const includeSection =
    includeLines.length > 0 ? ['include:', ...includeLines, ''] : [];

  return [...header, ...includeSection, ...footer].join('\n');
};

/**
 * Fallback: builds a minimal compose file from scratch when no existing content is available.
 */
const buildComposeFromScratch = (selectedServices: readonly ServiceSelection[]): string => {
  const includeLines = selectedServices.map(
    (service) => `  - path: ./services/${service.filename}`,
  );

  const sections: readonly string[] = [
    ...(includeLines.length > 0 ? ['include:', ...includeLines, ''] : []),
    'networks:',
    '  stack:',
    '',
  ];

  return sections.join('\n');
};

