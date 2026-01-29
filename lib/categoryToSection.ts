/**
 * Canonical mapping from framework category strings (e.g. from baseline_datasets.category
 * or HierarchicalCategorySelector) to the simplified section headings used when presenting
 * datasets. Use this anywhere we group or display datasets by pillar/section.
 *
 * Section keys: "P1" | "P2" | "P3" | "Hazards" | "Underlying Vulnerabilities" | "Uncategorized"
 * Order in UI (per ScoringFlowDiagram): P1 → P2 → P3 → Hazards (P3.2) → Underlying Vulnerabilities (P3.1)
 */

export type FrameworkSectionHeading =
  | 'P1'
  | 'P2'
  | 'P3'
  | 'Hazards'
  | 'Underlying Vulnerabilities'
  | 'Uncategorized';

/** Display order for Framework Datasets sections (matches diagram) */
export const FRAMEWORK_SECTION_ORDER: FrameworkSectionHeading[] = [
  'P1',
  'P2',
  'P3',
  'Hazards',
  'Underlying Vulnerabilities',
  'Uncategorized',
];

/**
 * Map a category string (e.g. "P3.1.2 - Market", "P3.2.2 - Community DRR") to the
 * section heading used for presentation. Prefers name-based matching so we respect
 * the actual framework labels even if DB theme order differs from P3.1=Vuln, P3.2=Hazard.
 */
export function getSectionHeadingForCategory(category: string): FrameworkSectionHeading {
  const c = (category || '').trim();
  if (!c) return 'Uncategorized';

  const lower = c.toLowerCase();

  // Name-based: respect "Hazard" vs "Underlying/Vulnerability" in the label so presentation
  // matches what the user selected, regardless of P3.1/P3.2 code order in the DB
  if (lower.includes('hazard') && !lower.includes('underlying') && !lower.includes('vuln')) {
    return 'Hazards';
  }
  if (
    lower.includes('underlying') ||
    lower.includes('vulnerability') ||
    (lower.includes('vuln') && !lower.includes('hazard'))
  ) {
    return 'Underlying Vulnerabilities';
  }

  // Code-based (per ScoringFlowDiagram: P3.1→Vuln, P3.2→Hazard)
  if (/^P?3\.1(\b|\.)/.test(c)) return 'Underlying Vulnerabilities';
  if (/^P?3\.2(\b|\.)/.test(c)) return 'Hazards';

  // UV prefix (e.g. "UV.2 - Socio-economic") → Underlying Vulnerabilities
  if (/^UV[.\s-]/i.test(c) || lower === 'uv') return 'Underlying Vulnerabilities';

  // Pillar-level
  if (/^P1\s*-/.test(c)) return 'P1';
  if (/^P2\s*-/.test(c)) return 'P2';
  if (/^P3\s*-/.test(c)) return 'P3';

  if (c.startsWith('P1')) return 'P1';
  if (c.startsWith('P2')) return 'P2';
  if (c.startsWith('P3')) return 'P3';

  return 'Uncategorized';
}
