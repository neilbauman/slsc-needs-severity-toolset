/**
 * Helper functions for working with country-specific admin level names
 */

export interface AdminLevelConfig {
  level_number: number;
  name: string;
  plural_name: string;
  code_prefix: string | null;
  order_index: number;
}

/**
 * Get admin level name for a country
 * Falls back to ADM1, ADM2, ADM3, ADM4 if not configured
 */
export function getAdminLevelName(
  levels: AdminLevelConfig[] | null | undefined,
  levelNumber: number,
  plural: boolean = false
): string {
  if (!levels || levels.length === 0) {
    return `ADM${levelNumber}`;
  }

  const level = levels.find((l) => l.level_number === levelNumber);
  if (!level) {
    return `ADM${levelNumber}`;
  }

  return plural ? level.plural_name : level.name;
}

/**
 * Get all admin level names for a country
 * Returns a map of level_number -> name
 */
export function getAdminLevelNamesMap(
  levels: AdminLevelConfig[] | null | undefined
): Map<number, { name: string; plural: string }> {
  const map = new Map<number, { name: string; plural: string }>();

  if (!levels || levels.length === 0) {
    // Default fallback
    for (let i = 1; i <= 5; i++) {
      map.set(i, { name: `ADM${i}`, plural: `ADM${i}` });
    }
    return map;
  }

  levels.forEach((level) => {
    map.set(level.level_number, {
      name: level.name,
      plural: level.plural_name,
    });
  });

  return map;
}

/**
 * Convert ADM1, ADM2, ADM3, ADM4 to level number
 */
export function parseAdminLevel(level: string): number | null {
  const match = level.match(/ADM(\d)/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

/**
 * Get admin level options for dropdowns
 */
export function getAdminLevelOptions(
  levels: AdminLevelConfig[] | null | undefined
): Array<{ value: string; label: string; levelNumber: number }> {
  if (!levels || levels.length === 0) {
    return [
      { value: 'ADM1', label: 'ADM1', levelNumber: 1 },
      { value: 'ADM2', label: 'ADM2', levelNumber: 2 },
      { value: 'ADM3', label: 'ADM3', levelNumber: 3 },
      { value: 'ADM4', label: 'ADM4', levelNumber: 4 },
      { value: 'ADM5', label: 'ADM5', levelNumber: 5 },
    ];
  }

  return levels
    .sort((a, b) => a.level_number - b.level_number)
    .map((level) => ({
      value: level.name.toUpperCase().replace(/\s+/g, '_'),
      label: `${level.name} (Level ${level.level_number})`,
      levelNumber: level.level_number,
    }));
}
