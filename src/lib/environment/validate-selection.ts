import type { ServiceSelection } from './types.js';

/**
 * Validates that all dependency constraints (requires) in the selected services
 * are satisfied by the full selection.
 *
 * Returns an array of error messages. Empty array means valid.
 */
export const validateSelection = (
  selection: readonly ServiceSelection[],
): readonly string[] => {
  const selectedFilenames = new Set(selection.map((s) => s.filename));
  const selectedGroups = new Set(selection.map((s) => s.metadata.group));

  const errors: readonly string[] = selection.flatMap((selected) =>
    selected.metadata.requires
      .map((dep) => {
        if (dep.service) {
          const serviceFilename = dep.service.endsWith('.yml') ? dep.service : `${dep.service}.yml`;
          if (!selectedFilenames.has(serviceFilename)) {
            return `Service "${selected.metadata.name}" requires service "${dep.service}" but it is not selected.`;
          }
        }
        if (dep.group && !selectedGroups.has(dep.group)) {
          return `Service "${selected.metadata.name}" requires a service from group "${dep.group}" but none is selected.`;
        }
        return undefined;
      })
      .filter((msg): msg is string => msg !== undefined),
  );

  return errors;
};
