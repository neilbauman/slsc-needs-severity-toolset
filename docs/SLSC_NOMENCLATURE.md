# SLSC Toolset — Agreed Nomenclature

Use these terms consistently in UI copy, docs, and code comments.

---

## People-of-concern and caseload

| Term | Abbrev | Definition |
|------|--------|------------|
| **People of Concern** | **PoC** | Population in the affected area with severity score ≥ 3. |
| **People in Need** | **PiN** | The proportion of PoC calculated to have high needs in those locations. Represents the **humanitarian caseload**. In many cases PiN = PoC × poverty rate (or another factor). Sometimes called **“people targeted”** (for shelter / SLSC interventions). |
| **People targeted** | — | In this toolset, same as **PiN**: the humanitarian caseload for shelter/SLSC interventions. |

---

## In code and DB

- **PoC** is returned as `people_concern` in `get_instance_summary` (and will be in any response-summary RPC). Use **“People of Concern (PoC)”** in UI labels where space allows.
- **PiN** is returned as `people_need` in `get_instance_summary` (and will be in any response-summary RPC). Use **“People in Need (PiN)”** in UI labels. PiN = humanitarian caseload / “people targeted” for shelter/SLSC interventions.
- PiN calculation can be PoC × poverty rate or another factor; the exact formula may be configurable per response/country later.

---

## Other terms (for reference)

- **Severity** — Absolute vulnerability score (typically 1–5) per admin area.
- **Priority** — Relative ranking (1–5) derived from severity for prioritization.
- **Affected area** — Geographic scope of a response (e.g. array of ADM2 codes; ADM3 units are derived for scoring).
