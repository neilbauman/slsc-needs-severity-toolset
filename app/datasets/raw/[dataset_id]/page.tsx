'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import CleanNumericDatasetModal from '@/components/CleanNumericDatasetModal';
import CleanCategoricalDatasetModal from '@/components/CleanCategoricalDatasetModal';

type DatasetType = 'numeric' | 'categorical';

type AdminLevel = 'ADM1' | 'ADM2' | 'ADM3' | 'ADM4';

interface Dataset {
  id: string;
  name: string;
  description: string | null;
  type: DatasetType;
  category: string | null;
  admin_level: AdminLevel;
}

interface NumericRawRow {
  id: string;
  admin_pcode_raw: string | null;
  admin_name_raw: string | null;
  value_raw: number | string | null;
}

interface CategoricalRawRow {
  id: string;
  admin_pcode_raw: string | null;
  admin_name_raw: string | null;
  raw_row: any;
}

type RawShape = 'wide' | 'long' | 'unknown';

interface WideColumn {
  rawKey: string;
  label: string;
}

export default function RawDatasetPage() {
  const params = useParams();
  const datasetId = params?.dataset_id as string | undefined;

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [numericRows, setNumericRows] = useState<NumericRawRow[]>([]);
  const [categoricalRows, setCategoricalRows] = useState<CategoricalRawRow[]>([]);
  const [rawShape, setRawShape] = useState<RawShape>('unknown');
  const [wideColumns, setWideColumns] = useState<WideColumn[]>([]);

  const [showNumericModal, setShowNumericModal] = useState(false);
  const [showCategoricalModal, setShowCategoricalModal] = useState(false);

  // ------------------------------------------------------
  // Loader
  // ------------------------------------------------------
  const load = async () => {
    if (!datasetId) return;
    setLoading(true);
    setError(null);

    // 1) Load dataset meta
    const { data: ds, error: dsErr } = await supabase
      .from('datasets')
      .select('id, name, description, type, category, admin_level')
      .eq('id', datasetId)
      .single();

    if (dsErr || !ds) {
      console.error(dsErr);
      setError('Unable to load dataset metadata.');
      setLoading(false);
      return;
    }

    setDataset(ds as Dataset);

    // 2) Load raw rows based on type
    if (ds.type === 'numeric') {
      await loadNumericRaw(ds.id);
    } else {
      await loadCategoricalRaw(ds.id);
    }

    setLoading(false);
  };

  const loadNumericRaw = async (id: string) => {
    const { data, error: rawErr } = await supabase
      .from('dataset_values_numeric_raw')
      .select('id, admin_pcode_raw, admin_name_raw, value_raw')
      .eq('dataset_id', id)
      .order('admin_pcode_raw', { ascending: true })
      .limit(200);

    if (rawErr) {
      console.error(rawErr);
      setError('Unable to load numeric raw values.');
      setNumericRows([]);
      return;
    }

    setNumericRows((data || []) as NumericRawRow[]);
  };

  const loadCategoricalRaw = async (id: string) => {
    const { data, error: rawErr } = await supabase
      .from('dataset_values_categorical_raw')
      .select('id, admin_pcode_raw, admin_name_raw, raw_row')
      .eq('dataset_id', id)
      .limit(200);

    if (rawErr) {
      console.error(rawErr);
      setError('Unable to load categorical raw values.');
      setCategoricalRows([]);
      setRawShape('unknown');
      setWideColumns([]);
      return;
    }

    const rows = (data || []) as CategoricalRawRow[];
    setCategoricalRows(rows);

    if (!rows.length) {
      setRawShape('unknown');
      setWideColumns([]);
      return;
    }

    // Auto-detect shape from first row
    const first = rows[0];
    const rr = (first.raw_row || {}) as any;

    let shape: RawShape = 'unknown';
    const shapeHint = String(
      rr.__ssc_shape || rr.shape || ''
    ).toLowerCase();

    if (shapeHint === 'wide') shape = 'wide';
    else if (shapeHint === 'long' || shapeHint === 'normalized') shape = 'long';

    setRawShape(shape);

    if (shape === 'wide') {
      // Try to derive category columns from normalized mapping,
      // then from __ssc_wide_categories, then fallback to all keys.
      const normalizedMap = rr.__ssc_wide_categories_normalized;
      const wideList = rr.__ssc_wide_categories;

      let cols: WideColumn[] = [];

      if (normalizedMap && typeof normalizedMap === 'object') {
        cols = Object.entries(normalizedMap).map(([rawKey, normalized]) => ({
          rawKey,
          label: String(normalized || rawKey),
        }));
      } else if (Array.isArray(wideList)) {
        cols = wideList.map((rawKey: string) => ({
          rawKey,
          label: rawKey,
        }));
      } else {
        const metaKeys = new Set([
          '__ssc_shape',
          '__ssc_wide_categories',
          '__ssc_wide_categories_normalized',
        ]);

        cols = Object.keys(rr)
          .filter((k) => !metaKeys.has(k))
          .map((k) => ({ rawKey: k, label: k }));
      }

      setWideColumns(cols);
    } else {
      setWideColumns([]);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId]);

  const refresh = async () => {
    if (!dataset) return;
    if (dataset.type === 'numeric') {
      await loadNumericRaw(dataset.id);
    } else {
      await loadCategoricalRaw(dataset.id);
    }
  };

  // ------------------------------------------------------
  // Render helpers
  // ------------------------------------------------------

  const renderNumericRawTable = () => {
    if (!numericRows.length) {
      return (
        <p className="text-sm text-gray-500 mt-2">
          No raw numeric rows found for this dataset.
        </p>
      );
    }

    return (
      <div className="mt-3 border rounded-md overflow-x-auto">
        <table className="min-w-full text-sm border-collapse">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-3 py-2 border-b">Admin PCode (raw)</th>
              <th className="px-3 py-2 border-b">Admin Name (raw)</th>
              <th className="px-3 py-2 border-b">Value (raw)</th>
            </tr>
          </thead>
          <tbody>
            {numericRows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-3 py-1 whitespace-nowrap">
                  {row.admin_pcode_raw ?? '—'}
                </td>
                <td className="px-3 py-1 whitespace-nowrap">
                  {row.admin_name_raw ?? '—'}
                </td>
                <td className="px-3 py-1 text-right">
                  {row.value_raw ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderCategoricalRawTable = () => {
    if (!categoricalRows.length) {
      return (
        <p className="text-sm text-gray-500 mt-2">
          No raw categorical rows found for this dataset.
        </p>
      );
    }

    if (rawShape === 'wide' && wideColumns.length) {
      // Wide-format preview: one row per admin, columns are categories
      return (
        <div className="mt-3 border rounded-md overflow-x-auto">
          <table className="min-w-full text-xs border-collapse">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="px-3 py-2 border-b">Admin PCode (raw)</th>
                <th className="px-3 py-2 border-b">Admin Name (raw)</th>
                {wideColumns.map((col) => (
                  <th key={col.rawKey} className="px-3 py-2 border-b">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categoricalRows.map((row) => {
                const rr = (row.raw_row || {}) as any;
                return (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-1 whitespace-nowrap">
                      {row.admin_pcode_raw ?? '—'}
                    </td>
                    <td className="px-3 py-1 whitespace-nowrap">
                      {row.admin_name_raw ?? '—'}
                    </td>
                    {wideColumns.map((col) => {
                      const rawVal = rr[col.rawKey];
                      return (
                        <td key={col.rawKey} className="px-3 py-1 text-right">
                          {rawVal ?? '—'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }

    // Long / unknown shape: simple JSON preview per row
    return (
      <div className="mt-3 border rounded-md overflow-x-auto">
        <table className="min-w-full text-xs border-collapse">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-3 py-2 border-b">Admin PCode (raw)</th>
              <th className="px-3 py-2 border-b">Admin Name (raw)</th>
              <th className="px-3 py-2 border-b">Raw row (JSON)</th>
            </tr>
          </thead>
          <tbody>
            {categoricalRows.map((row) => (
              <tr key={row.id} className="border-t align-top">
                <td className="px-3 py-1 whitespace-nowrap">
                  {row.admin_pcode_raw ?? '—'}
                </td>
                <td className="px-3 py-1 whitespace-nowrap">
                  {row.admin_name_raw ?? '—'}
                </td>
                <td className="px-3 py-1 font-mono text-[11px] whitespace-pre-wrap">
                  {JSON.stringify(row.raw_row ?? {}, null, 2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ------------------------------------------------------
  // Main render
  // ------------------------------------------------------

  if (!datasetId) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600">
          Missing dataset_id in route.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Raw Dataset: {dataset?.name ?? '…'}
          </h1>
          {dataset && (
            <p className="text-sm text-gray-600 mt-1">
              Type:{' '}
              <span className="font-medium capitalize">
                {dataset.type}
              </span>{' '}
              · Admin level:{' '}
              <span className="font-medium">{dataset.admin_level}</span>{' '}
              {dataset.category && (
                <>
                  · Category:{' '}
                  <span className="font-medium">{dataset.category}</span>
                </>
              )}
            </p>
          )}
          {dataset?.description && (
            <p className="mt-1 text-sm text-gray-600">
              {dataset.description}
            </p>
          )}
        </div>

        {dataset && (
          <div className="flex gap-2">
            {dataset.type === 'numeric' ? (
              <button
                onClick={() => setShowNumericModal(true)}
                className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
              >
                Clean numeric dataset
              </button>
            ) : (
              <button
                onClick={() => setShowCategoricalModal(true)}
                className="px-4 py-2 rounded-md bg-purple-600 text-white text-sm font-medium hover:bg-purple-700"
              >
                Clean categorical dataset
              </button>
            )}
          </div>
        )}
      </div>

      {/* How this works */}
      <div className="border rounded-md bg-gray-50 px-4 py-3 text-sm text-gray-800">
        <p className="font-semibold mb-1">How this works</p>
        <ul className="list-disc list-inside space-y-1">
          <li>
            Numeric cleaning uses{' '}
            <code className="px-1 py-0.5 bg-white border rounded text-xs">
              preview_numeric_cleaning_v2
            </code>{' '}
            to preview matching, then{' '}
            <code className="px-1 py-0.5 bg-white border rounded text-xs">
              clean_numeric_dataset
            </code>{' '}
            to write into{' '}
            <code className="px-1 py-0.5 bg-white border rounded text-xs">
              dataset_values_numeric
            </code>
            .
          </li>
          <li>
            Categorical cleaning reshapes wide/long input using{' '}
            <code className="px-1 py-0.5 bg-white border rounded text-xs">
              preview_categorical_cleaning
            </code>{' '}
            and writes matches into{' '}
            <code className="px-1 py-0.5 bg-white border rounded text-xs">
              dataset_values_categorical
            </code>
            .
          </li>
          <li>
            Raw rows in{' '}
            <code className="px-1 py-0.5 bg-white border rounded text-xs">
              dataset_values_numeric_raw
            </code>{' '}
            and{' '}
            <code className="px-1 py-0.5 bg-white border rounded text-xs">
              dataset_values_categorical_raw
            </code>{' '}
            are never modified.
          </li>
        </ul>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {loading && (
        <p className="text-sm text-gray-500">Loading raw values…</p>
      )}

      {!loading && dataset && (
        <div>
          <h2 className="text-sm font-semibold text-gray-800 mb-2">
            Raw values (preview)
          </h2>
          {dataset.type === 'numeric'
            ? renderNumericRawTable()
            : (
              <>
                <p className="text-xs text-gray-600 mb-1">
                  Detected layout:{' '}
                  <span className="font-medium">
                    {rawShape === 'wide'
                      ? 'Wide (columns are categories)'
                      : rawShape === 'long'
                      ? 'Long / normalized'
                      : 'Unknown'}
                  </span>
                </p>
                {renderCategoricalRawTable()}
              </>
            )}
        </div>
      )}

      {/* Numeric cleaning modal */}
      {dataset && dataset.type === 'numeric' && (
        <CleanNumericDatasetModal
          open={showNumericModal}
          onOpenChange={setShowNumericModal}
          datasetId={dataset.id}
          datasetName={dataset.name}
          onCleaned={refresh}
        />
      )}

      {/* Categorical cleaning modal */}
      {dataset && dataset.type === 'categorical' && (
        <CleanCategoricalDatasetModal
          open={showCategoricalModal}
          onOpenChange={setShowCategoricalModal}
          datasetId={dataset.id}
          datasetName={dataset.name}
          onCleaned={refresh}
        />
      )}
    </div>
  );
}
