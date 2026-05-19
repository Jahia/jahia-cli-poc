import type { ResolvedComponent } from '../../components/types.js';

/**
 * Sorts components by dependency order (topological sort).
 * Components with no dependencies come first.
 */
export const sortByDependencies = (
  components: readonly ResolvedComponent[],
): readonly ResolvedComponent[] => {
  const sorted: ResolvedComponent[] = [];
  const visited = new Set<string>();
  const componentMap = new Map(components.map((c) => [c.definition.name, c]));

  const visit = (component: ResolvedComponent): void => {
    if (visited.has(component.definition.name)) return;
    visited.add(component.definition.name);

    component.definition.dependsOn.forEach((depName) => {
      const dep = componentMap.get(depName);
      if (dep) visit(dep);
    });

    sorted.push(component);
  };

  components.forEach((c) => {
    visit(c);
  });

  return sorted;
};
