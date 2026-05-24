import type { ServiceSelection } from './types.js';

/**
 * Assembles the content of a master docker-compose.yml file
 * with `include` directives for selected services.
 *
 * The generated file uses relative paths (./services/<filename>)
 * suitable for a docker-compose.yml located in the environment/ directory.
 */
export const assembleComposeFile = (
  selectedServices: readonly ServiceSelection[],
): string => {
  const includeLines = selectedServices.map(
    (service) => `  - path: ./services/${service.filename}`,
  );

  const sections: readonly string[] = [
    ...(includeLines.length > 0
      ? ['include:', ...includeLines, '']
      : []),
    'networks:',
    '  stack:',
    '',
  ];

  return sections.join('\n');
};
