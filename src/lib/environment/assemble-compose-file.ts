import type { ServiceSelection } from './types.js';

/**
 * Updates an existing docker-compose.yml file content by appending
 * new service includes to the existing `include:` section.
 *
 * Preserves all existing includes and adds the selected optional services.
 * The include section is expected to sit between the `include:` line
 * and the `networks:` line.
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
  const existingIncludes = lines.slice(includeIndex + 1, networksIndex).filter(
    (line) => line.trim() !== '',
  );
  const footer = lines.slice(networksIndex);

  const newIncludeLines = selectedServices.map(
    (service) => `  - path: ./services/${service.filename}`,
  );

  // Deduplicate: only add services not already included
  const allIncludes = [
    ...existingIncludes,
    ...newIncludeLines.filter((line) => !existingIncludes.includes(line)),
  ];

  const includeSection =
    allIncludes.length > 0 ? ['include:', ...allIncludes, ''] : [];

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

