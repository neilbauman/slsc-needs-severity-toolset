"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser as supabase } from "@/lib/supabase/supabaseBrowser";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import CleanNumericDatasetModal from "@/components/CleanNumericDatasetModal";
import CleanCategoricalDatasetModal from "@/components/CleanCategoricalDatasetModal";

type RawPageProps = {
  params: {
    dataset_id: string;
  };
};

type DatasetRecord = {
  id: string;
  name: string;
  // one of these should exist in your DB – we’ll check both
  value_type?: string | null;
  type?: string | null;
};

type RawRow = Record<string, any>;

export default function RawDatasetPage({ params }: RawPageProps) {
  const datasetId = params.dataset_id;

  const [dataset, setDataset] = useState<DatasetRecord | null>(null);
  const [rows, setRows] = useState<RawRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cleanModalOpen, setCleanModalOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const datasetName = dataset?.name ?? "Dataset";
  const datasetType =
    (dataset?.value_type ?? dataset?.type ?? "numeric").toLowerCase();
  const isNumeric = datasetType === "numeric";

  // Fetch dataset metadata + a small raw preview
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        // 1) Dataset record
        const { data: dsData, error: dsError } = await supabase
          .from("datasets")
          .select("*")
          .eq("id", datasetId)
          .single();

        if (dsError) throw dsError;
        if (cancelled) return;

        setDataset(dsData as DatasetRecord);

        // 2) Raw values preview (first 50)
        const { data: rawRows, error: rawError } = await supabase
          .from("dataset_values_raw")
          .select("*")
          .eq("dataset_id", datasetId)
          .limit(50);

        if (rawError) throw rawError;
        if (cancelled) return;

        setRows((rawRows ?? []) as RawRow[]);
      } catch (err: any) {
        console.error("Error loading raw dataset page", err);
        if (!cancelled) {
          setError(
            err?.message ??
              "Failed to load dataset metadata or raw values preview."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [datasetId, refreshToken]);

  function handleCleaned() {
    // re-fetch raw preview / dataset after cleaning
    setRefreshToken((x) => x + 1);
  }

  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Raw Dataset
          </h1>
          <p className="text-sm text-muted-foreground">
            {datasetName} ·{" "}
            <span className="uppercase tracking-wide text-xs">
              {isNumeric ? "NUMERIC" : "CATEGORICAL"}
            </span>
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            onClick={() => setCleanModalOpen(true)}
            disabled={!dataset}
          >
            Clean Dataset
          </Button>
        </div>
      </div>

      {/* Status / error */}
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Raw preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Raw Values (sample)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Showing up to 50 raw rows from <code>dataset_values_raw</code> for
            this dataset.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No raw rows found for this dataset.
            </div>
          ) : (
            <div className="max-h-[460px] overflow-auto border rounded-md">
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    {columns.map((col) => (
                      <th
                        key={col}
                        className="border-b px-3 py-2 text-left font-medium text-muted-foreground"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      {columns.map((col) => (
                        <td key={col} className="px-3 py-1 whitespace-nowrap">
                          {row[col] === null || row[col] === undefined
                            ? "—"
                            : String(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cleaning modals */}
      {isNumeric ? (
        <CleanNumericDatasetModal
          datasetId={datasetId}
          datasetName={datasetName}
          open={cleanModalOpen}
          onOpenChange={setCleanModalOpen}
          onCleaned={handleCleaned}
        />
      ) : (
        <CleanCategoricalDatasetModal
          datasetId={datasetId}
          datasetName={datasetName}
          open={cleanModalOpen}
          onOpenChange={setCleanModalOpen}
          onCleaned={handleCleaned}
        />
      )}
    </div>
  );
}
