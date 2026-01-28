# Category & Pillar Systems Audit

This doc lists where framework categories and pillars are defined and used, so we can avoid legacy mismatches and consolidate over time.

## Canonical source for baseline “Framework Datasets” presentation

**Use this for grouping baseline_datasets by section when presenting them:**

- **Lib:** `lib/categoryToSection.ts`
- **Function:** `getSectionHeadingForCategory(category: string)`
- **Section keys:** `"P1" | "P2" | "P3" | "Hazards" | "Underlying Vulnerabilities" | "Uncategorized"`
- **Display order:** P1 → P2 → P3 → Hazards (P3.2) → Underlying Vulnerabilities (P3.1) → Uncategorized (see `FRAMEWORK_SECTION_ORDER`)

**Used in:** `components/BaselineConfigPanel.tsx`. Sections and labels come from `get_framework_structure` (DB). It builds `frameworkSections` (pillars, themes, subthemes) and groups by section code (longest match). Fallback: five sections if RPC fails.

**Category values:** Come from `baseline_datasets.category`, set when the user picks from `HierarchicalCategorySelector` (e.g. `"P3.1.2 - Market"`, `"P3.2.2 - Community DRR"`). Mapping is **name-aware**: if the category string contains “Hazard” it goes to Hazards; if “Underlying” or “Vulnerability”/“Vuln” it goes to Underlying Vulnerabilities; else code-based (P3.1* → Underlying Vulnerabilities, P3.2* → Hazards).

---

## Legacy / alternate systems (different from baseline Framework Datasets)

These use **different** category/pillar keys and **are not** the same as `baseline_datasets.category` → section mapping above.

| System | Keys / convention | Where used | Notes |
|--------|-------------------|------------|--------|
| **SSC Framework - P1/P2/P3, Hazard, Underlying Vulnerability** | `'SSC Framework - P1'`, `'SSC Framework - P2'`, `'SSC Framework - P3'`, `'Hazard'`, `'Underlying Vulnerability'` | `FrameworkScoringModal`, `FrameworkConfigModal`, `InstanceScoringModal`, `ScoreLayerSelector`, `UploadDatasetModal`, `DatasetTable`, `DatasetDetailDrawer`, `app/countries/[country]/page.tsx` (pillar summary), `app/datasets/page.tsx` (SSC_P1/SSC_P2/SSC_P3), `app/countries/[country]/page-reorganized.tsx` | Legacy instance/framework scoring and dataset metadata. Do not mix with baseline_datasets.category. |
| **Country dashboard “pillar”** | `PillarKey`: Core, SSC Framework - P1/P2/P3, Hazard, Underlying Vulnerability, Other | `app/countries/[country]/page.tsx` → `determinePillar(dataset)` | Derived from `dataset.metadata.pillar` / `metadata.category` etc., not from baseline_datasets. |
| **DatasetTable categoryOrder** | Core, SSC Framework - P1/P2/P3, Hazards, Underlying Vulnerabilities | `components/DatasetTable.tsx` | Groups by `dataset.category === cat`. Different from baseline_datasets.category. |
| **ComputeFrameworkRollupButton** | P1, P2, P3 (short codes) | `components/ComputeFrameworkRollupButton.tsx` | RPC config uses `{ P1, P2, P3 }` for aggregation. |

---

## Recommendations

1. **Baseline “Framework Datasets”**: Always use `getSectionHeadingForCategory()` from `lib/categoryToSection.ts` when grouping or labelling baseline_datasets by section. Do not re-implement or hardcode P3.1/P3.2 → Hazards/Vuln in UI.
2. **Adding new “dataset by category” views**: Prefer extending `lib/categoryToSection.ts` (or a small wrapper) rather than new ad‑hoc mappings.
3. **Legacy instance/framework UIs**: When touching FrameworkScoringModal, InstanceScoringModal, or country/datasets pillar logic, treat “SSC Framework - P1/P2/P3” and “Hazard / Underlying Vulnerability” as a **separate** system from baseline_datasets; document any bridge (e.g. if instance datasets are ever sourced from baseline categories) in this file.
4. **Cleanup over time**: If we ever unify “instance pillar” and “baseline section”, we should introduce a single shared enum or mapping and migrate both sides to it; until then, keep the two systems clearly separated and referenced in this audit.

---

## Reference: framework structure (DB)

- **Tables:** `framework_pillars`, `framework_themes`, `framework_subthemes`
- **RPC:** `get_framework_structure()` returns pillars → themes → subthemes (used by BaselineConfigPanel for display names and by HierarchicalCategorySelector for options).
- **Category string format** from HierarchicalCategorySelector: `"P{pillar}.{theme}.{subtheme} - {name}"` (e.g. `"P3.1.2 - Market"`). Themes/subthemes are ordered by `order_index`; “P3.1” = first theme under P3, “P3.2” = second, etc. Per diagram, P3.1 → Vuln, P3.2 → Hazard; the DB theme order might differ, so `getSectionHeadingForCategory` uses name-based logic when the label contains “Hazard” or “Underlying”/“Vulnerability”.
