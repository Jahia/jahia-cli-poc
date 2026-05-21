import { select, checkbox } from '@inquirer/prompts';

import type { DiscoveredService, ServiceSelection, ServicesConfig } from './types.js';

/**
 * Sorts group entries by their order field.
 */
const sortGroupsByOrder = (
  groups: ServicesConfig['groups'],
): readonly (readonly [string, ServicesConfig['groups'][string]])[] =>
  Object.entries(groups).sort(([, a], [, b]) => a.order - b.order);

/**
 * Filters services belonging to a specific group.
 */
const servicesForGroup = (
  services: readonly DiscoveredService[],
  groupId: string,
): readonly DiscoveredService[] => services.filter((s) => s.metadata.group === groupId);

/**
 * Processes a single group and returns selected services for that group.
 */
const processGroup = async (
  groupId: string,
  groupConfig: ServicesConfig['groups'][string],
  groupServices: readonly DiscoveredService[],
  onInfo?: ((message: string) => void)  ,
): Promise<readonly ServiceSelection[]> => {
  if (groupServices.length === 0) {
    return [];
  }

  if (groupConfig.selection === 'always_included') {
    return groupServices.map((service) => {
      onInfo?.(`  ✓ ${groupConfig.label}: ${service.metadata.name} (auto-included)`);
      return { filename: service.filename, metadata: service.metadata };
    });
  }

  if (groupConfig.selection === 'at_most_one') {
    const choices = [
      { name: 'None (skip)', value: '__none__' as string },
      ...groupServices.map((s) => ({
        name: `${s.metadata.name} — ${s.metadata.description}`,
        value: s.filename,
      })),
    ];

    const selected = await select({
      message: `${groupConfig.label}: ${groupConfig.description}`,
      choices,
    });

    if (selected === '__none__') {
      return [];
    }

    const service = groupServices.find((s) => s.filename === selected);
    return service ? [{ filename: service.filename, metadata: service.metadata }] : [];
  }

  // zero_or_more
  const choices = groupServices.map((s) => ({
    name: `${s.metadata.name} — ${s.metadata.description}`,
    value: s.filename,
  }));

  const selected = await checkbox({
    message: `${groupConfig.label}: ${groupConfig.description} (select with space, enter to confirm)`,
    choices,
  });

  return selected
    .map((filename) => groupServices.find((s) => s.filename === filename))
    .filter((s): s is DiscoveredService => s !== undefined)
    .map((service) => ({ filename: service.filename, metadata: service.metadata }));
};

/**
 * Prompts the user for service selection based on group configuration.
 * Groups are presented in order. Selection rules determine prompt type:
 * - always_included: auto-selected, user informed
 * - at_most_one: single select with "None" option
 * - zero_or_more: multi-select checkbox
 */
export const promptServiceSelection = async (params: {
  readonly groups: ServicesConfig;
  readonly services: readonly DiscoveredService[];
  readonly onInfo?: ((message: string) => void) | undefined;
}): Promise<readonly ServiceSelection[]> => {
  const sortedGroups = sortGroupsByOrder(params.groups.groups);

  return sortedGroups.reduce(
    async (accPromise, [groupId, groupConfig]) => {
      const acc = await accPromise;
      const groupServices = servicesForGroup(params.services, groupId);
      const groupSelections = await processGroup(groupId, groupConfig, groupServices, params.onInfo);
      return [...acc, ...groupSelections];
    },
    Promise.resolve([] as readonly ServiceSelection[]),
  );
};
