# SLSC Toolset — Deep Review (Instances, Responses, Framework, Auth)

This document summarizes what exists, where the gaps are, and what to change so the app matches your requirements (responses as primary, population/PoC/PiN per layer, framework preserved, auth by country).

---

## 0. Agreed Nomenclature

| Term | Definition |
|------|-------------|
| **People of Concern (PoC)** | Population in the affected area with severity score ≥ 3. |
| **People in Need (PiN)** | The proportion of PoC calculated to have high needs in those locations. Represents the **humanitarian caseload**. In many cases PiN = PoC × poverty rate (or another factor). Sometimes called **“people targeted”** (for shelter / SLSC interventions). |
| **People targeted** | Same as PiN in this context — the humanitarian caseload for shelter/SLSC interventions. |

**In code and DB:** Use **PoC** (not “people_concern”) and **PiN** (not “people_need”) in user-facing labels and docs where possible. Existing `get_instance_summary` returns `people_concern` (= PoC) and `people_need` (= PiN); the logic is correct; naming can be aligned in UI and in any new response-summary RPC.

---

## 1. What Exists Today

### 1.1 Framework (Pillars → Themes → Subthemes → Indicators)

- **Tables:** `framework_pillars`, `framework_themes`, `framework_subthemes`, `framework_indicators`, `dataset_indicators`.
- **RPC:** `get_framework_structure()` returns the full hierarchy with codes (e.g. P1, P1-T1, P1-T1-ST1, P1-T1-ST1-I1).
- **Migration 53:** Indicators can attach to pillar, theme, or subtheme (not only subtheme).
- **Used by:** `FrameworkStructureManager`, `FrameworkConfigModal`, `BaselineConfigPanel` (via `HierarchicalCategorySelector`), baseline scoring.
- **Status:** Structure is in place and near-final; numbering and hierarchy are important to keep.

### 1.2 Instances (Legacy, Keep for Reference and Reuse)

- **Tables:** `instances`, `instance_datasets`, `instance_dataset_scores`, `instance_category_scores`.
- **Instance columns:** `admin_scope`, `population_dataset_id`, `poverty_dataset_id`, `country_id`, etc. (migration 03).
- **Calculations:**
  - **get_instance_summary(in_instance_id)** → `total_population`, `people_concern` (= **PoC**: pop in areas with severity ≥ 3), `people_need` (= **PiN**: e.g. PoC × poverty rate; humanitarian caseload / “people targeted”).
  - **score_priority_ranking** → relative 1–5 “Priority” from “Overall” severity.
  - Scoring flow: dataset scores → framework rollup → final rollup → overall; priority ranking is a separate step.
- **UI:** `instances/[id]` uses `InstanceMetricsPanel` (population, PoC, PiN, avg severity, areas of concern, affected locations), `ExportInstanceButton` (CSV with population, PiN per ADM3), layer selector (Overall, Priority, P1/P2/P3, Hazard, dataset layers), affected area, hazard events, scoring modals.
- **Status:** Logic and UI are the main reference for “same results per layer” and for reuse in the response world.

### 1.3 Responses and Layers (New Architecture)

- **Tables (migrations 51, 52):**  
  `country_baselines`, `baseline_datasets`, `baseline_scores`  
  `responses`, `response_layers`, `layer_datasets`, `layer_hazard_events`, `layer_scores`, `response_scores`.
- **Response columns:** `baseline_id`, `admin_scope`, `normalization_scope`, `population_dataset_id`, `poverty_dataset_id`, `legacy_instance_id`.
- **Layer types:** `hazard_prediction`, `hazard_impact`, `assessment`, `intervention`, `monitoring`, `custom`; `order_index`, `reference_date`, `effect_direction`.
- **RPCs:**
  - **score_baseline(in_baseline_id)** — national baseline scores.
  - **score_response_baseline(in_response_id)** — baseline scores in affected area (national or affected_area normalization).
  - **score_response_layer(in_layer_id)** — scores for one layer (today: pulls from `hazard_event_scores` via `legacy_instance_id`).
  - **compute_response_scores(in_response_id, in_up_to_layer_id)** — aggregates baseline + layers into `response_scores`.
  - **get_response_score_summary(in_response_id, in_layer_id)** — summary stats (category, avg/min/max score, etc.) for scores only.
- **UI:** `responses/[id]` — tabs for configuration, affected-area, baseline, comparison, and per-layer; uses `get_response_score_summary` and `compute_response_scores`. No population, PoC, or PiN per layer.
- **Status:** Structure (response → layers → scores) matches the desired temporal flow; calculation and metrics are only partially aligned with instances.

### 1.4 Auth and Country Access

- **Tables:** `user_countries(user_id, country_id, role)` with `role` in `{'admin','user'}`.
- **Logic:** `countryContext` loads `user_countries`; `isSiteAdmin` = has admin for any country; `currentCountry` drives which country the user works in.
- **Admin UI:** `admin/users` can assign/remove country access and roles.
- **RLS:** Layered-response tables (e.g. `responses`, `response_layers`, `response_scores`) use broad “authenticated read/write all” policies — no filtering by `country_id` or by user’s assigned countries.
- **Status:** Country-based assignment exists; RLS does not yet enforce “users only see/edit data for their countries.”

---

## 2. Gaps vs Your Requirements

| Requirement | Current state | Gap |
|-------------|----------------|-----|
| **Responses primary; instances kept for reuse** | Responses exist; instances still hold the main calculation and UI patterns. | Use instance logic and UI as the reference when implementing response-layer calculations and metrics. No need to change instance schema; treat as read-only reference. |
| **Population, PoC, PiN for every layer** | Instances: `get_instance_summary` gives total_population, PoC (people_concern), PiN (people_need). Responses: only score summaries per layer; no population/PoC/PiN. | Response/layer path has no equivalent of `get_instance_summary`. Need a way to compute (and display) population, PoC, and PiN per response and per layer. PiN = humanitarian caseload (“people targeted” for shelter/SLSC); calculation may be PoC × poverty rate or another factor. |
| **Publish per layer per response** | No `published` or visibility flag on responses or layers. | **Deferred.** Publishing and public view will be designed later. |
| **Framework (pillars/themes/subthemes) preserved** | Framework tables and `get_framework_structure` exist and are used by baselines. | Keep as-is. Ensure new response-layer scoring can drive from the same framework (e.g. baseline categories → P1/P2/P3/UV/Hazard) and, where useful, from themes/indicators. |
| **Temporal flow: baseline → hazards → assessments → interventions** | Response layers and `layer_type` already support this. | Strengthen UI and defaults so “baseline → hazard → assessment → intervention” is the default timeline and tab order; ensure each step can show the same metrics (population, PiN, targeted). |
| **Global framework config by you; per-country/per-response config by country users** | Framework is global in DB; there is no explicit “global vs country” split in app logic. Country users are constrained by `user_countries`, not by RLS. | Keep framework editing as super-admin only. Add RLS (and possibly UI checks) so country users can only create/edit responses and config for their assigned countries. |
| **All results publicly viewable (after publish)** | No public routes; no anon read policies. | **Deferred.** Publishing and public view will be designed later. |

---

## 3. Suggested Improvements (Prioritized)

### P0 — Required for “same results per layer” and parity with instances

1. **Population / PoC / PiN per response and per layer** — **DONE**
   - **get_response_summary(in_response_id, in_layer_id)** in `supabase/migrations/55_create_get_response_summary.sql`. Returns total_population, PoC, PiN, total_affected_locations, areas_of_concern_count, avg_severity. Uses response_scores (baseline or layer) for severity ≥ 3. PiN = PoC × poverty rate. Applied to SLSCToolset project.

2. **Expose these metrics in the responses UI** — **DONE**
   - **ResponseMetricsPanel** (`components/ResponseMetricsPanel.tsx`) calls get_response_summary(responseId, layerId) and shows Total Population, People of Concern (PoC), People in Need (PiN), Avg Severity, Areas of Concern, Affected Locations. Wired on `app/responses/[id]/page.tsx` for baseline and layer tabs; refreshKey bumped after Recompute.

### P1 — Deferred: public view and publishing

3. **Publish per layer per response** — *Deferred.* Publishing and public view will be designed later.

4. **Public view for published response/layer** — *Deferred.* Same as above.

### P2 — Security and consistency

5. **RLS by country and “global config”**
   - **Responses, response_layers, country_baselines:**  
     - SELECT/UPDATE/DELETE for `authenticated` only when `response.country_id` (or baseline’s `country_id`) is in the user’s `user_countries.country_id` set, or when the user is site admin.
   - **Framework tables (pillars, themes, subthemes, indicators, dataset_indicators):**  
     - Restrict INSERT/UPDATE/DELETE to a “super” role or a small set of admin user IDs that you control; keep SELECT broad so the app can read framework. That encodes “framework and global config by you; rest by country users.”

6. **Instances: read-only, referenced by responses**
   - Keep instances and `legacy_instance_id` as-is. Do not add new features to instances; reuse their logic inside response/layer RPCs and UI.
   - Optionally add a short “instance comparison” block on the response page (e.g. “Legacy instance summary” when `legacy_instance_id` is set) so you can compare old vs new numbers during transition.

### P3 — UX and consistency with diagram

7. **Temporal tabs and “layer = phase”**
   - Make the responses UI explicitly “baseline → hazard → assessment → intervention” (and monitoring if needed): default tab order and labels match `layer_type` and `order_index`.
   - Ensure layer selector and summary panels always pass the correct `layer_id` (or “baseline”) into `get_response_summary` and score APIs, so every layer shows the same metrics.

8. **Use framework in response-layer scoring**
   - When scoring layers that use datasets, drive category from framework (e.g. `baseline_datasets.category` or a mapping from theme/indicator to P1/P2/P3/UV/Hazard) so that response_scores and layer_scores align with the pillar/theme structure and with the “P1+P2+P3 → SSC, plus Hazard and Vuln → Overall” diagram.

9. **Diagram in-product**
    - Add a small “How it works” or “Framework” section (e.g. in the response config or in a footer) that shows the flow: Datasets → Categories → P1+P2+P3 → SSC + Hazard + Vuln → Overall, using the asset you already have.

---

## 4. Instance vs Response: What to Reuse Where

| Concept | In instances | In responses (today) | Reuse / add |
|---------|--------------|----------------------|-------------|
| Affected area | `instances.admin_scope` | `responses.admin_scope` | Same semantics; keep. |
| Population / poverty refs | `population_dataset_id`, `poverty_dataset_id` | Same on `responses` | Already aligned. |
| Summary metrics | `get_instance_summary` → total_population, PoC, PiN | None | **Add** `get_response_summary(response_id, layer_id)` with total_population, PoC, PiN (PiN = humanitarian caseload / “people targeted”). |
| “Overall” severity | `instance_category_scores(category='Overall')` | `response_scores(..., layer_id)` | Layer scores are the response equivalent; use them in the new summary RPC. |
| Priority (1–5) | `score_priority_ranking` → category `'Priority'` | Not in response schema | Optional: add “priority” aggregates per layer in `response_scores` or in the summary RPC if you need relative ranking per layer. |
| Score flow | dataset → framework → final → overall | baseline + layers → response_scores | Keep instance flow as reference; response flow (migrations 51/52) is the target. |
| Metrics panel UI | `InstanceMetricsPanel` (Population, PoC, PiN, Avg Severity, Areas of Concern, Affected Locations) | Missing | **Add** a “ResponseMetricsPanel” (or reuse a shared component) that calls `get_response_summary` and shows the same metrics, using PoC/PiN labels. |
| Export CSV | `ExportInstanceButton` (population, PiN per ADM3) | Missing for responses | **Add** “Export response/layer” that uses the same population/PoC/PiN logic as the new summary RPC. |

---

## 5. Database Objects to Add or Extend (Concise)

- **RPC:** `get_response_summary(in_response_id UUID, in_layer_id UUID DEFAULT NULL)`  
  → Returns `total_population`, **PoC** (people_concern), **PiN** (people_need = humanitarian caseload / “people targeted”), matching instance semantics. Uses response’s population/poverty refs and scores for the given layer (or baseline). PiN calculation may be PoC × poverty rate or another factor; allow config later if needed.
- **Publishing:** Deferred. No schema changes for publish/visibility until that is designed.
- **RLS:**  
  - Responses/baselines/layers: restrict write and read to user’s countries (or site admin).  
  - Framework: restrict writes to super/framework-admin.  
  - Public/anon read: deferred.

---

## 6. Suggested Next Steps

1. ~~**Implement `get_response_summary(response_id, layer_id)`**~~ — **DONE.** Migration 55 applied to SLSCToolset.
2. ~~**Add the metrics panel to the response detail page**~~ — **DONE.** ResponseMetricsPanel wired for baseline and layer tabs; refreshKey after Recompute.
3. ~~**Population/poverty dataset config on response**~~ — **DONE.** Configuration tab has “Reference datasets (PoC / PiN)” with Population dataset and Poverty dataset dropdowns (scoped by response.country_id); updates responses and bumps metricsRefreshKey.
4. **Tighten RLS** so country users only see/edit their countries and framework edits stay with you.
5. **Optionally** add export-CSV for responses/layers using the same population/PoC/PiN logic as the summary RPC (mirror ExportInstanceButton).
6. **Publishing and public view** — deferred until you decide how it should work.

---

## 7. Next priorities (after PoC/PiN flow)

| Priority | Action | Why |
|----------|--------|-----|
| **P2** | RLS by country on responses, baselines, layers; restrict framework writes to super-user | Security: country users only see their data; you retain framework control. |
| **P3** | Export CSV for response/layer (population, PoC, PiN per ADM3) | Mirrors ExportInstanceButton; high value for sharing results. |
| **P3** | Temporal tab ordering / defaults (baseline → hazard → assessment → intervention) | UX alignment with diagram; ensure layer_type and order_index drive the flow. |
| **Later** | Clean-slate repo (checklist → playbook → new GitHub + Vercel reconnect) | When you’re ready to cut over; use SLSC_AUDIT_CHECKLIST + migration playbook. |
