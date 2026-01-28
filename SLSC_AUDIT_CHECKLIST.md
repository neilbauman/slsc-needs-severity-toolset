# SLSC Toolset — Deep Audit Checklist

Use this checklist to decide **keep / remove / archive** for the clean-slate repo. Fill the **Your decision** column as we go (see “How to input” at the end).

---

## 1. Root-level markdown / misc

| Item | Purpose (from audit) | Your decision |
|------|------------------------|---------------|
| `RUN_FIRST.md` | One-off setup / run-first instructions | |
| `GET_STARTED_NOW.md` | Getting started guide | |
| `QUICK_START.md` | Quick start guide | |
| `AUTOMATED_SETUP_COMPLETE.md` | Post-automation notice | |
| `DEPLOY_QUICK_START.md` | Deploy quick start | |
| `NEXT_STEPS_AFTER_ENV.md` | Next steps after env setup | |
| `SEE_THE_CHANGES.md` | “See the changes” guide | |
| `VERIFIED_CHANGES.md` | Verified changes log | |
| `SETUP_NEW_REPO.md` | New-repo setup | |
| `STEP_3_HELP.md` | Step 3 help | |
| `SUPABASE_SETUP_GUIDE.md` | Supabase setup | |
| `VERCEL_DEPLOYMENT.md` | Vercel deployment | |
| `VERCEL_CONNECT_REPO.md` | Vercel repo connection | |
| `APPLY_FRAMEWORK_MIGRATION.md` | Framework migration steps | |
| `FIX_LOOP_ERROR.md` | Loop error fix | |
| `ADD_SERVICE_ROLE_KEY.md` | Service role key instructions | |
| `AGENT_SETUP_CHECKLIST.md` | Agent setup checklist | |
| `AGENT_SUMMARY.md` | Agent summary | |
| `DATA_AUDIT_REPORT.md` | Data audit report | |
| `GET_CHANGES_TO_APPEAR.md` | “Get changes to appear” | |
| `QUICK_MIGRATION_GUIDE.md` | Quick migration guide | |
| `VERCEL_STEP_BY_STEP.md` | Vercel step-by-step | |
| `DEPLOY_NOW.md` | Deploy now | |
| `dump_zsh_state` | Shell state dump (non-doc) | |

**Suggested:** Remove or archive most one-off setup/deploy/“run first” docs; keep only what you still use (e.g. one canonical setup + one deploy doc).

---

## 2. `docs/` folder (34 files → sample; full list below)

| Item | Purpose (from audit) | Your decision |
|------|------------------------|---------------|
| `README.md` | Docs index/overview | |
| `SSC_BACKGROUND.md` | SSC context | |
| `SUPABASE_SCHEMA.md` | Schema reference (used by .cursorrules) | |
| `MULTI_COUNTRY_IMPLEMENTATION.md` | Multi-country design | |
| `DATA_IMPORT_GUIDE.md` | Data import | |
| `QUERY_UPDATE_GUIDE.md` | Query/RPC update guide | |
| `HOW_TO_APPLY_RPC_FUNCTION.md` | How to apply RPCs | |
| `IFRAME_EMBEDDING.md` | Embedding behavior | |
| `CRASH_PREVENTION.md` | Crash prevention | |
| `LOCAL_RUN_RELIABLE.md` | Reliable local run | |
| `QUICK_START_CHECKLIST.md` | Quick start checklist | |
| `BEGINNER_DEBUGGING_GUIDE.md` | Debugging | |
| `CURSOR_SETUP.md` | Cursor/IDE setup | |
| `HOW_TO_SEE_CHANGES.md` | See changes in app | |
| `FIX_PREVIEW_TIMEOUT.md` | Preview timeout fix | |
| `DISK_IO_OPTIMIZATION.md` | Disk I/O | |
| `INSTANCE_PAGE_DEBUGGING.md` | Instance page debugging | |
| `HAZARD_EVENT_PREPROCESSING.md` | Hazard preprocessing | |
| `SCORING_NORMALIZATION_ISSUE.md` | Scoring normalization | |
| `RESTORE_DATASETS_FROM_SOURCE.md` | Restore datasets | |
| `RESTORE_INSTRUCTIONS.md` | Restore instructions | |
| `QUICK_RESTORE_GUIDE.md` | Quick restore | |
| `AUTOMATED_MIGRATION.md` | Automated migration | |
| `FRAMEWORK_CONFIG_MIGRATION.md` | Framework config migration | |
| `FRAMEWORK_STRUCTURE_MIGRATION.md` | Framework structure migration | |
| `UPDATE_FRAMEWORK_CONFIG.md` | Update framework config | |
| `CATEGORY_AND_PILLAR_AUDIT.md` | Category/pillar audit | |
| `COUNTRY_CONFIGURATION_AUDIT.md` | Country config audit | |
| `DATASET_AUDIT_REPORT.md` | Dataset audit | |
| `NEXT_STEPS.md` | Next steps | |
| `HDX_UPLOAD_STATUS.md` | HDX upload status | |
| `BANGLADESH_DATASET_HEALTH_EXPLANATION.md` | Country-specific | |
| `MADAGASCAR_DATASET_HEALTH_EXPLANATION.md` | Country-specific | |
| `SRI_LANKA_DATASET_HEALTH_EXPLANATION.md` | Country-specific | |

**Suggested:** Keep README, SUPABASE_SCHEMA, MULTI_COUNTRY_IMPLEMENTATION, DATA_IMPORT_GUIDE, IFRAME_EMBEDDING, and maybe one debugging + one restore doc; archive or remove the rest unless you refer to them often.

---

## 3. Scripts (`scripts/`)

Grouped by apparent purpose. **Your decision** can be per file or per group.

### 3a. Dev / env / run

| Item | Your decision |
|------|----------------|
| `ensure-cache-dirs.js` | **(Used by package.json build/start)** |
| `complete-setup.sh` | |
| `configure-dev-env.sh` | |
| `setup-dev-env.sh` | |
| `restart-dev-server.sh` | |
| `run-reliable.sh` | |
| `fix-crashes.sh` | |
| `cleanup_data_directory.sh` | |

### 3b. One-off migrations / schema / config

| Item | Your decision |
|------|----------------|
| `add-instance-columns.js` | |
| `migrate-data.js` | |
| `migrate-data.sh` | |
| `migrate-dataset-categories.js` | |
| `migrate-geometry-data.js` | |
| `migrate-scoring-config.js` | |
| `migrate-scoring-config.sh` | |
| `discover_framework_structure.py` | |
| `discover_source_schema.sql` | |
| `export_framework_config_from_source.sql` | |
| `export_framework_structure_from_source.sql` | |
| `export_framework_structure_generic.sql` | |
| `import_framework_config_to_target.sql` | |
| `import_framework_structure.py` | |
| `auto_migrate_framework_structure.py` | |
| `migrate_framework_auto.py` | |
| `migrate_framework_with_service_key.py` | |
| `migrate_categorical_data.py` | |
| `check-geometry-data.sql` | |
| `verify-setup.sql` | |
| `verify-geometry-migration.md` | |
| `README_HDX_DOWNLOAD.md` | |

### 3c. Country-specific import / fix

| Item | Your decision |
|------|----------------|
| `import_philippines_data.sql` | |
| `export_philippines_data.sql` | |
| `replace_phl_adm0.py` | |
| `import_bangladesh_data.py` | |
| `fix_bangladesh_pcode_alignment.py` | |
| `upload_bgd_adm3_batches.py` | |
| `upload_all_bgd_adm3.py` | |
| `import_sri_lanka_data.py` | |
| `import_sri_lanka_adm4_boundaries.py` | |
| `audit_and_import_sri_lanka_boundaries.py` | |
| `upload_lka_remaining.py` | |
| `add_madagascar_country.py` | |
| `fix_madagascar_names.py` | |
| `create_mozambique_poverty_placeholder.py` | |
| `import_mozambique_population.py` | |
| `import_mozambique_poverty.py` | |
| `add_palestine_data.py` | |

### 3d. Boundaries / HDX / geometry

| Item | Your decision |
|------|----------------|
| `download_hdx_boundaries.py` | |
| `upload_boundaries_to_supabase.py` | |
| `reimport_all_boundaries.py` | |
| `reimport_boundaries_single_country.py` | |

### 3e. Datasets / restore / health

| Item | Your decision |
|------|----------------|
| `restore_datasets.js` | |
| `restore_datasets.py` | |
| `restore_datasets.sh` | |
| `restore_datasets_simple.sql` | |
| `audit_datasets.py` | |
| `run_cleaning.py` | |
| `update_dataset_health_metadata.py` | |
| `create_population_density_datasets.py` | |

### 3f. Upload / MCP / batch

| Item | Your decision |
|------|----------------|
| `upload_batch.py` | |
| `upload_via_json.py` | |
| `upload_via_mcp.py` | |
| `upload_to_supabase_mcp.py` | |
| `upload_all_mcp.py` | |
| `upload_level_by_level.py` | |

### 3g. Admin / users

| Item | Your decision |
|------|----------------|
| `assign_user_countries.sh` | |
| `quick-assign-user.sql` | |
| `fix_user_countries.sql` | |

**Suggested:** Keep `ensure-cache-dirs.js` (required by build). For the rest: keep only scripts you still run or want as reference; move the rest to `scripts-archive/` or remove.

---

## 4. App routes and pages

| Route / file | Purpose | Your decision |
|--------------|---------|---------------|
| `app/page.tsx` | Home; framework config/structure | |
| `app/layout.tsx` | Root layout; Header, Breadcrumb, ErrorBoundary | |
| `app/login/page.tsx` | Login | |
| `app/signup/page.tsx` | Signup | |
| `app/countries/[country]/page.tsx` | Country dashboard (main) | |
| `app/countries/[country]/page-reorganized.tsx` | **Alternate country page – not routed** (only mentioned in docs) | |
| `app/instances/page.tsx` | Instances list | |
| `app/instances/[id]/page.tsx` | Instance detail (scoring, layers, affected area) | |
| `app/instances/[id]/view/page.tsx` | View-only instance | |
| `app/instances/[id]/embed/page.tsx` + `layout.tsx` | Embed view | |
| `app/datasets/page.tsx` | Datasets list | |
| `app/datasets/[dataset_id]/page.tsx` | Dataset detail | |
| `app/datasets/raw/page.tsx` | Raw datasets list | |
| `app/datasets/raw/[dataset_id]/page.tsx` | Raw dataset (cleaning UI) | |
| `app/baselines/page.tsx` | Baselines list | |
| `app/baselines/[id]/page.tsx` | Baseline config | |
| `app/responses/page.tsx` | Responses list | |
| `app/responses/[id]/page.tsx` | Response detail (layers, recompute) | |
| `app/admin/page.tsx` | Admin | |
| `app/admin/users/page.tsx` | User admin | |
| `app/admin/admin-levels/page.tsx` | Admin levels config | |
| `app/api/deriveDataset/route.ts` | Derive dataset API | |
| `app/api/datasetValues/route.ts` | Dataset values API | |
| `app/api/hazard-event-scores/route.ts` | Hazard event scores API | |
| `app/api/admin/*` | Admin APIs (assign-user-countries, create-user, get-all-users, reset-user-password) | |

**Suggested:** **Remove** `app/countries/[country]/page-reorganized.tsx` (dead route) unless you plan to switch to it.

---

## 5. Components

### 5a. Used in app or layout (keep unless you retire the flow)

| Component | Used by |
|-----------|---------|
| `AuthProvider` | app, signup, login, admin |
| `Header` | layout |
| `Breadcrumb` | layout |
| `ErrorBoundary` | layout |
| `ChunkErrorHandler` | layout |
| `ProtectedRoute` | countries/[country] |
| `CountrySelector` | Header |
| `CountryDashboardMap` | countries/[country] |
| `DatasetDetailDrawer` | countries/[country], datasets |
| `DatasetCleaningWorkflow` | DatasetDetailDrawer |
| `UnmatchedRowsViewer` | DatasetDetailDrawer |
| `PCodeMatchingConfig` | DatasetCleaningWorkflow |
| `CleanNumericDatasetModal` | datasets/raw/[dataset_id] |
| `CleanCategoricalDatasetModal` | InstanceDatasetConfigModal |
| `FrameworkConfigModal` | app/page |
| `FrameworkStructureManager` | app/page |
| `HierarchicalCategorySelector` | BaselineConfigPanel |
| `BaselineConfigPanel` | baselines/[id] |
| `ImportFromInstanceModal` | baselines/[id] |
| `CreateResponseModal` | responses |
| `ResponsesSummaryDashboard` | responses |
| `ScoreLayerSelector` | instances/[id], instances/[id]/view |
| `InstanceMetricsPanel` | instances/[id], instances/[id]/view |
| `VulnerableLocationsPanel` | instances/[id], instances/[id]/view |
| `UploadHazardEventModal` | instances/[id] |
| `HazardEventScoringModal` | instances/[id] |
| `ImportHazardEventModal` | instances/[id] |
| `ExportInstanceButton` | instances/[id] |
| `DefineAffectedAreaModal` | instances/[id], instances/page |
| `InstanceScoringModal` | instances/[id] |
| `InstanceDatasetConfigModal` | instances/[id] |
| `CategoricalScoringModal` | InstanceDatasetConfigModal |
| `LayerManagementPanel` | responses/[id] |
| `AffectedAreaEditor` | responses/[id] |
| `ValidationMetricsPanel` | responses/[id] |
| `NormalizationSettings` | responses/[id] |
| `ExportResponseButton` | responses/[id] |
| `CloneResponseButton` | responses/[id] |
| `LayerTimelineNavigation` | responses/[id] |
| `LayerScoreProgression` | responses/[id] |
| `ScoringFlowDiagram` | responses/[id] |
| `LayerScoreMap` | responses/[id] |
| `ResponseComparisonMap` | responses/[id] |
| `LayerEffectPreview` | LayerManagementPanel |
| `LoginModal` | login |
| `SignupModal` | signup |
| `CountryAdminLevelsConfig` | admin/admin-levels |

### 5b. Orphan (never imported) — remove or archive unless you plan to wire them in

| Component | Notes |
|-----------|-------|
| `AffectedAreaModal` | Superseded by DefineAffectedAreaModal in current UI |
| `DashboardMap` | Not used; CountryDashboardMap is used |
| `DatasetTable` | Not used in any page |
| `ViewDatasetModal` | Not used |
| `UploadDatasetModal` | Not used (upload likely elsewhere or not in UI) |
| `DeleteDatasetModal` | Not used; DatasetDetailDrawer does delete inline |
| `TransformDatasetModal` | Not used |
| `DeriveDatasetModal` | Not used (API route exists; no UI) |
| `DerivedDatasetPreviewModal` | Not used |
| `CleanDatasetModal` | Replaced by DatasetCleaningWorkflow + CleanNumeric/CleanCategorical modals |
| `DatasetScoreSummaryTable` | Not used |
| `FrameworkScoringModal` | Not used; InstanceScoringModal handles framework scoring |
| `InstanceConfigModal` | Not used |
| `InstanceCategoryConfigModal` | Not used |
| `InstanceRecomputePanel` | Not used; responses/[id] has its own “Recompute” |
| `ComputeFrameworkRollupButton` | Not used |
| `ComputeFinalRollupButton` | Not used |
| `ComputePriorityRankingButton` | Not used |
| `ScoringPreviewModal` | Not used |

**Your decision (for 5b):** list which to **keep** (for future use) vs **remove** vs **archive** (e.g. move to `components-archive/`).

---

## 6. Lib

| File | Purpose | Your decision |
|------|---------|---------------|
| `supabaseClient.ts` | Main browser client; used everywhere | **Keep** |
| `supabaseServer.ts` | Server client for admin API routes | **Keep** |
| `supabasePreview.ts` | Preview RPCs (cleaning, alignment, data health) | **Keep** |
| `supabaseBrowser.ts` | **Never imported** — duplicate/unused client | **Remove** or archive |
| `countryContext.tsx` | Country selection state | **Keep** |
| `adminLevelNames.ts` | Admin level labels | **Keep** |
| `aggregationMethods.ts` | Scoring aggregation | **Keep** |
| `categoryToSection.ts` | Category → section mapping | **Keep** |
| `crashRecovery.ts` | Crash recovery | **Keep** (if used) or archive |
| `fetchHazardEventScoresClient.ts` | Hazard event scores | **Keep** |
| `pageConfig.ts` | Page config | **Keep** (if used) |

**Suggested:** Remove or archive `supabaseBrowser.ts`.

---

## 7. Supabase (database audit — efficiency & functionality)

### 7a. RPCs referenced by app code (likely need to stay)

From codebase grep, these RPCs are called by the app:

- `get_framework_structure`
- `score_baseline`
- `get_admin_boundaries_geojson`
- `compute_validation_metrics`
- `normalize_response_scores`
- `preview_layer_effect`
- `get_hazard_events_for_instance`
- `diagnose_map_data`
- `get_affected_adm3`
- `get_response_score_summary`
- `compute_response_scores`
- `get_timeline_score_progression`
- `get_country_admin_levels`
- `score_numeric_auto`
- `score_framework_aggregate`
- `score_final_aggregate`
- `score_final_aggregate_all_methods`
- `get_method_comparison`
- `score_priority_ranking`
- `get_framework_config`
- `compute_data_health`
- `preview_pcode_alignment`
- `preview_numeric_cleaning_v2`
- `preview_categorical_cleaning_v2`
- `clean_numeric_dataset`
- `clean_categorical_dataset`
- `transform_admin_level`
- `preview_derived_dataset`
- `preview_derived_dataset_v3`
- `materialize_derived_dataset_v3`
- `score_building_typology`
- `get_instance_summary`
- `get_admin_boundaries_list`
- `insert_hazard_event`
- `clone_hazard_event`
- `derive_dataset` (via API route)

**Suggested:** In Supabase, list all existing RPCs and mark: **keep** / **remove** / **review for efficiency**. Any RPC not in this list is a candidate for removal or consolidation.

### 7b. Migrations

- **~64+ migration files** under `supabase/migrations/`, including many `42_upload_hdx_boundaries_part_*` and country-specific uploads (BGD, LKA, etc.).
- **Suggested:** Treat migrations as historical record; do **not** delete. For the *live* database, run a separate “current schema + RPC” dump and document that as the source of truth. Use the migration list to decide what to keep in the new repo (e.g. only migrations that still apply to the current SLSC project).

### 7c. Efficiency / functionality review (to do with you)

- Indexes on `admin_boundaries`, `datasets`, `instance_*`, `dataset_values_*`, etc.
- RLS policies and whether they’re still correct for multi-country.
- Unused or duplicate tables/views.
- Heavy or duplicate RPCs that could be merged or optimized.

We can do 7b/7c in a follow-up pass once you’re happy with the app/source list.

---

## 8. Config and package

| Item | Your decision |
|------|----------------|
| `package.json` — name is `ssc-dashboard` | Rename to `slsc-toolset` or similar? |
| `package.json` — scripts (prestart, build use `ensure-cache-dirs.js`) | Keep as-is if keeping that script |
| `next.config.js` (redirects, webpack, headers) | Keep |
| `vercel.json` | Keep (Vercel project unchanged) |
| `.cursorrules` | Update for “SLSC Toolset” and cleaned structure |
| `.gitignore` / `.vercelignore` | Keep |

---

# How to input your decisions

You can reply in any of these ways; we’ll go section by section.

1. **By section**  
   Example: *“Section 1 (root docs): keep only QUICK_START and SUPABASE_SETUP_GUIDE; remove the rest.”*

2. **By table**  
   Copy the table, fill the “Your decision” column with **keep** / **remove** / **archive**, and paste it back (or paste the rows you changed).

3. **By list**  
   Example: *“Root docs to KEEP: QUICK_START, SUPABASE_SETUP_GUIDE. Root docs to REMOVE: RUN_FIRST, GET_STARTED_NOW, …”*

4. **One category at a time**  
   We’ll take one category (e.g. “Root-level markdown”) and you say keep/remove/archive for each item (or group). Then we move to the next.

5. **Shortcuts**  
   - *“Remove all orphans in 5b”* = remove every component in section 5b.  
   - *“Archive all scripts except ensure-cache-dirs and scripts I still run”* — then you list the ones you still run.  
   - *“Keep docs/README, docs/SUPABASE_SCHEMA, docs/MULTI_COUNTRY_IMPLEMENTATION; archive the rest of docs/”*

**Suggested order:**  
1 → 2 → 3 (scripts we can do by group) → 4 → 5 → 6 → 8.  
Do section 7 (Supabase) as a separate pass after the codebase checklist is settled.

When you’re ready, reply with the section number and your decisions (e.g. “Section 1: …”) and we’ll record them and move on.

---

# Migration playbook (run after the checklist is decided)

Use this **after** you’ve filled in “Your decision” for each section. Order of steps:

1. **Create new GitHub repo**  
   - Name: `SLSC Toolset` (or `slsc-toolset`).  
   - Do **not** import the old repo (clean slate).

2. **Create new local folder**  
   - e.g. `~/Desktop/SLSC Toolset` or `~/Desktop/slsc-toolset`.  
   - `git init` and add remote pointing at the new repo.

3. **Copy only what you kept**  
   - From this repo, copy into the new folder only items you marked **keep**.  
   - For **archive**: copy into an `_archive/` or `archive/` subfolder in the new repo if you want them in git, or leave them in the old folder and do not copy.

4. **Apply renames / cleanups**  
   - Rename `package.json` “name” to `slsc-toolset` (or your chosen name).  
   - Remove or replace “Philippines SSC” / “SSC” in user-facing strings if you’re standardizing on “SLSC Toolset”.  
   - Delete `app/countries/[country]/page-reorganized.tsx` if you decided to remove it.  
   - Delete `lib/supabaseBrowser.ts` if you decided to remove it.  
   - Remove any components you marked **remove** and fix imports (or leave imports broken only if the component is unused).

5. **Root `.md` and `docs/`**  
   - In the new repo, keep only the root and `docs/` files you marked **keep**.  
   - Optionally add a single `README.md` at root that points to `docs/` and env setup.

6. **Scripts**  
   - Copy only scripts you **keep** into `scripts/` in the new repo.  
   - Ensure `package.json` still references `scripts/ensure-cache-dirs.js` in `build`/`prestart` if you kept it.

7. **First commit**  
   - Add all files, commit as “Initial commit – SLSC Toolset clean slate”, push to the new GitHub repo.

8. **Point Vercel at the new repo**  
   - In the existing project **SLSC-needs-severity-toolset**, change the connected repo from the old one to the new “SLSC Toolset” repo.  
   - Preserve env vars (Supabase URL, anon key, etc.).  
   - Trigger a deploy and fix any build errors (missing files, wrong paths).

9. **Supabase**  
   - Keep using the same project; no change to URL/keys.  
   - Run the **database** audit (Section 7) in a separate pass: list RPCs/tables, mark keep/remove, then optimize indexes and RLS as needed.
