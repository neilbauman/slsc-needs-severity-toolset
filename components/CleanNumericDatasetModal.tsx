"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser as supabase } from "@/lib/supabase/supabaseBrowser";

type CleanNumericDatasetModalProps = {
  datasetId: string;
  datasetName?: string;
  onClose: () => void;
  onCleaned?: () => void;
};

type RawNumericRow = {
  id: string;
  dataset_id: string;
  admin_pcode_raw: string | null;
  admin_name_raw: string | null;
  raw_row: Record<string, any> | null;
};

type AdminBoundary = {
  admin_pcode: string;
  admin_name: string;
  admin_level?: number | null;
  country_code?: string | null;
};

type MatchStatus = "matched" | "unmatched";

type MappedRow = {
  raw: RawNumericRow;
  matchedBoundary?: AdminBoundary;
  status: MatchStatus;
};

type LoadingState = "idle" | "loading" | "applying";

/**
 * CleanNumericDatasetModal
 *
 * - Loads RAW numeric rows for a dataset from dataset_values_numeric_raw
 * - Loads PH ADM3 boundaries (canonical layer)
 * - Applies deterministic Rule B on the client for PREVIEW:
 *   • normalize names
 *   • drop trailing "000" from raw pcodes
 *   • match vs canonical ADM3 pcodes & names
 * - Shows stats + first 20 rows with match status
 * - On "Apply cleaning", calls RPC clean_numeric_dataset(dataset_id)
 *   which will:
 *     • read RAW table
 *     • apply same deterministic logic server-side
 *     • insert into dataset_values_numeric
 *     • mark dataset as is_cleaned = true
 *
 * NOTE: This assumes your canonical PH ADM3 layer is exposed through
 * a table called "admin_boundaries" with columns:
 *   admin_pcode, admin_name, admin_level, country_code
 * If your repo uses a different table name (e.g. gis_features), you
 * only need to adjust the single Supabase query that loads boundaries.
 */
export function CleanNumericDatasetModal({
  datasetId,
  datasetName,
  onClose,
  onCleaned,
}: CleanNumericDatasetModalProps) {
  const [loadingState, setLoadingState] = useState<LoadingState>("loading");
  const [error, setError] = useState<string | null>(null);

  const [rawRows, setRawRows] = useState<RawNumericRow[]>([]);
  const [rawCount, setRawCount] = useState<number | null>(null);

  const [adminBoundaries, setAdminBoundaries] = useState<AdminBoundary[]>([]);

  // ---------------------------------------------------------------------------
  // Helpers – normalization + Rule B
  // ---------------------------------------------------------------------------

  function normalizeName(name: string | null | undefined): string {
    if (!name) return "";
    let n = name.toUpperCase().trim();

    // Remove common noise for PH ADM3 names
    n = n.replace(/\(CAPITAL\)/gi, "");
    n = n.replace(/\bCITY OF\b/gi, "");
    n = n.replace(/\bMUNICIPALITY OF\b/gi, "");
    n = n.replace(/\bMUNICIPALITY\b/gi, "");
    n = n.replace(/\bCITY\b/gi, "");
    n = n.replace(/[.,]/g, " ");
    n = n.replace(/\s+/g, " ").trim();

    return n;
  }

  function normalizePcode(raw: string | null | undefined): string | null {
    if (!raw) return null;
    let c = raw.toUpperCase().trim();

    // Rule B: drop trailing 000 (e.g. PH012801000 => PH012801)
    if (c.endsWith("000")) {
      c = c.slice(0, -3);
    }

    return c || null;
  }

  function mapRows(
    rows: RawNumericRow[],
    boundaries: AdminBoundary[]
  ): MappedRow[] {
    if (!rows.length || !boundaries.length) {
      return rows.map((r) => ({
        raw: r,
        status: "unmatched",
      }));
    }

    // Build lookups for deterministic matching
    const boundariesByName = new Map<string, AdminBoundary[]>();
    const boundariesByPcode = new Map<string, AdminBoundary>();

    for (const b of boundaries) {
      const nameKey = normalizeName(b.admin_name);
      if (!boundariesByName.has(nameKey)) {
        boundariesByName.set(nameKey, []);
      }
      boundariesByName.get(nameKey)!.push(b);

      const pcodeKey = b.admin_pcode.toUpperCase().trim();
      if (!boundariesByPcode.has(pcodeKey)) {
        boundariesByPcode.set(pcodeKey, b);
      }
    }

    return rows.map((raw) => {
      const normName = normalizeName(raw.admin_name_raw);
      const normPcode = normalizePcode(raw.admin_pcode_raw);

      let matchedBoundary: AdminBoundary | undefined;

      // 1. Pcode-based match first
      if (normPcode) {
        const direct = boundariesByPcode.get(normPcode);
        if (direct) {
          matchedBoundary = direct;
        }
      }

      // 2. Name-based match if still not matched
      if (!matchedBoundary && normName) {
        const candidates = boundariesByName.get(normName) || [];

        if (candidates.length === 1) {
          matchedBoundary = candidates[0];
        } else if (candidates.length > 1 && normPcode) {
          // If multiple candidates by name, pick one that shares the pcode prefix
          const byPrefix = candidates.find((c) =>
            c.admin_pcode.toUpperCase().startsWith(normPcode)
          );
          if (byPrefix) {
            matchedBoundary = byPrefix;
          }
        }
      }

      return {
        raw,
        matchedBoundary,
        status: matchedBoundary ? "matched" : "unmatched",
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Data loading – RAW rows + PH ADM3 boundaries
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoadingState("loading");
        setError(null);

        // RAW preview rows for this dataset
        const { data: rawData, error: rawError, count } = await supabase
          .from("dataset_values_numeric_raw")
          .select(
            "id, dataset_id, admin_pcode_raw, admin_name_raw, raw_row",
            { count: "exact" }
          )
          .eq("dataset_id", datasetId)
          .limit(200); // more than enough for a 20-row preview

        if (rawError) throw rawError;

        // Canonical PH ADM3 boundaries
        const { data: boundaryData, error: boundaryError } = await supabase
          .from("admin_boundaries")
          .select("admin_pcode, admin_name, admin_level, country_code")
          .eq("country_code", "PH")
          .eq("admin_level", 3);

        if (boundaryError) throw boundaryError;

        if (cancelled) return;

        setRawRows((rawData || []) as RawNumericRow[]);
        setRawCount(count ?? (rawData ? rawData.length : 0));
        setAdminBoundaries((boundaryData || []) as AdminBoundary[]);
        setLoadingState("idle");
      } catch (err: any) {
        if (cancelled) return;
        console.error("Failed to load cleaning preview", err);
        setError(err?.message || "Failed to load cleaning preview.");
        setLoadingState("idle");
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [datasetId]);

  const mappedRows: MappedRow[] = useMemo(
    () => mapRows(rawRows, adminBoundaries),
    [rawRows, adminBoundaries]
  );

  const stats = useMemo(() => {
    const total = rawCount ?? rawRows.length;
    let matched = 0;

    for (const r of mappedRows) {
      if (r.status === "matched") matched += 1;
    }

    const unmatched = total - matched;

    return { total, matched, unmatched };
  }, [mappedRows, rawCount, rawRows.length]);

  // ---------------------------------------------------------------------------
  // Apply Cleaning – call RPC clean_numeric_dataset(dataset_id)
  // ---------------------------------------------------------------------------

  async function handleApplyCleaning() {
    try {
      setLoadingState("applying");
      setError(null);

      const { error: rpcError } = await supabase.rpc("clean_numeric_dataset", {
        dataset_id: datasetId,
      });

      if (rpcError) throw rpcError;

      setLoadingState("idle");

      if (onCleaned) onCleaned();
      onClose();
    } catch (err: any) {
      console.error("Failed to apply cleaning", err);
      setError(err?.message || "Failed to apply cleaning.");
      setLoadingState("idle");
    }
  }

  const isBusy = loadingState !== "idle";

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-6xl rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">
              Clean Numeric Dataset{" "}
              {datasetName ? (
                <span className="ml-1 text-sm font-normal text-gray-500">
                  ({datasetName})
                </span>
              ) : null}
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Applies deterministic Philippine ADM3 matching (Rule B) to this
              raw numeric dataset. Matched rows go into the cleaned table;
              unmatched rows stay in RAW for later fuzzy/manual tools.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
          >
            <span className="sr-only">Close</span>×
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
          {loadingState === "loading" && (
            <div className="py-10 text-center text-sm text-gray-500">
              Loading raw rows and admin boundaries…
            </div>
          )}

          {error && (
            <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          {loadingState !== "loading" && !error && (
            <>
              {/* Stats cards */}
              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border bg-gray-50 px-4 py-3">
                  <div className="text-xs font-medium text-gray-500">
                    Total raw rows
                  </div>
                  <div className="mt-1 text-lg font-semibold text-gray-900">
                    {stats.total}
                  </div>
                </div>
                <div className="rounded-lg border bg-green-50 px-4 py-3">
                  <div className="text-xs font-medium text-green-700">
                    Deterministic matches
                  </div>
                  <div className="mt-1 text-lg font-semibold text-green-800">
                    {stats.matched}
                  </div>
                </div>
                <div className="rounded-lg border bg-amber-50 px-4 py-3">
                  <div className="text-xs font-medium text-amber-700">
                    Unmatched (remain in RAW)
                  </div>
                  <div className="mt-1 text-lg font-semibold text-amber-800">
                    {stats.unmatched}
                  </div>
                </div>
              </div>

              <p className="mb-3 text-xs text-gray-500">
                Preview uses deterministic Rule B:
                <br />
                • normalize Philippine ADM3 names
                <br />
                • drop trailing <code>000</code> from raw pcodes
                <br />
                • match against official ADM3 boundaries by pcode and/or name
              </p>

              {/* Preview table */}
              <div className="overflow-x-auto rounded-lg border">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Raw ADM3 name</th>
                      <th className="px-3 py-2">Raw pcode</th>
                      <th className="px-3 py-2">Matched pcode</th>
                      <th className="px-3 py-2">Matched name</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {mappedRows.slice(0, 20).map((row) => (
                      <tr key={row.raw.id}>
                        <td className="px-3 py-2">
                          {row.raw.admin_name_raw || (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {row.raw.admin_pcode_raw || (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {row.matchedBoundary?.admin_pcode || (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {row.matchedBoundary?.admin_name || (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {row.status === "matched" ? (
                            <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-800">
                              matched
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                              unmatched
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}

                    {mappedRows.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-3 py-6 text-center text-xs text-gray-500"
                        >
                          No raw rows found for this dataset.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {mappedRows.length > 20 && (
                <div className="mt-2 text-[11px] text-gray-400">
                  Showing first 20 rows of {mappedRows.length} loaded.
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-6 py-3">
          <div className="text-[11px] text-gray-500">
            You can apply cleaning even if some rows remain unmatched. Matched
            rows are copied into the cleaned numeric table, while unmatched rows
            are left in RAW for later fuzzy/manual processing.
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyCleaning}
              disabled={isBusy || mappedRows.length === 0}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingState === "applying"
                ? "Applying cleaning…"
                : "Apply cleaning"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CleanNumericDatasetModal;
