'use client';

import { useEffect, useMemo, useState } from 'react';
import Papa from 'papaparse';
import { supabase } from '@/lib/supabaseClient';
import { useCountry } from '@/lib/countryContext';
import { getAdminLevelOptions } from '@/lib/adminLevelNames';

interface UploadDatasetModalProps {
  onClose: () => void;
  onUploaded: () => void;
}

type DatasetType = 'numeric' | 'categorical';

interface MappingState {
  admin_pcode: string;
  admin_name: string;
  value: string; // numeric value or primary value column (for long-format categorical)
}

interface MetaState {
  name: string;
  description: string;
  category: string;
  admin_level: 'ADM1' | 'ADM2' | 'ADM3' | 'ADM4' | 'ADM5';
  type: DatasetType;
  source: string;
  source_link: string;
}

// --- Helper functions ------------------------------------------------

function guessAdminPcodeColumn(columns: string[]): string {
  for (const c of columns) {
    const lc = c.toLowerCase();
    if (
      lc.includes('pcode') ||
      lc.includes('p_code') ||
      lc.includes('admin_pcode') ||
      (lc.includes('adm') && lc.includes('code')) ||
      lc === 'pcode' ||
      lc === 'psgc'
    ) {
      return c;
    }
  }
  return '';
}

function guessAdminNameColumn(columns: string[]): string {
  for (const c of columns) {
    const lc = c.toLowerCase();
    if (
      lc.includes('name') &&
      !lc.includes('code') &&
      !lc.includes('pcode') &&
      !lc.includes('id')
    ) {
      return c;
    }
  }
  return '';
}

function guessValueColumn(columns: string[], avoid: string[]): string {
  const avoidSet = new Set(avoid.filter(Boolean));
  const scoreish = [
    'value',
    'val',
    'score',
    'rate',
    'density',
    'pop',
    'population',
    'count',
    'total',
    'number',
    'pct',
    'percent',
    'ratio',
  ];

  // Prefer “value-like” columns not in avoid
  for (const c of columns) {
    if (avoidSet.has(c)) continue;
    const lc = c.toLowerCase();
    if (scoreish.some((k) => lc.includes(k))) {
      return c;
    }
  }

  // Otherwise just pick first non-avoided column
  for (const c of columns) {
    if (!avoidSet.has(c)) return c;
  }

  return '';
}

function headerLooksLikePercentage(header: string): boolean {
  const lc = header.toLowerCase();
  return lc.includes('percent') || lc.includes('pct') || lc.includes('%') || lc.includes('rate');
}

// normalize column header to category key
function normalizeCategoryName(header: string): string {
  return header
    .toLowerCase()
    .normalize('NFKD') // remove accents
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// detect whether categorical looks “wide-format”
function detectWideFormat(
  columns: string[],
  previewRows: any[],
  adminPcodeCol: string,
  adminNameCol: string
): { isWide: boolean; defaultCategoryColumns: string[] } {
  if (!columns.length || !previewRows.length) {
    return { isWide: false, defaultCategoryColumns: [] };
  }

  const avoid = new Set(
    [adminPcodeCol, adminNameCol].filter((x) => x && columns.includes(x))
  );

  const candidateCols = columns.filter((c) => !avoid.has(c));
  if (candidateCols.length < 3) {
    // small number of non-admin columns → probably long format or simple numeric
    return { isWide: false, defaultCategoryColumns: [] };
  }

  // Heuristic: many candidate columns have mostly numeric values in preview
  let numericishCount = 0;
  for (const col of candidateCols) {
    let numericSamples = 0;
    let totalSamples = 0;
    for (const row of previewRows) {
      const val = row[col];
      if (val === null || val === undefined || val === '') continue;
      totalSamples++;
      const n = typeof val === 'number' ? val : Number(val);
      if (!Number.isNaN(n)) {
        numericSamples++;
      }
    }
    if (totalSamples > 0 && numericSamples / totalSamples >= 0.6) {
      numericishCount++;
    }
  }

  const isWide = numericishCount >= 2 && numericishCount / candidateCols.length >= 0.5;

  return {
    isWide,
    defaultCategoryColumns: isWide ? candidateCols : [],
  };
}

// --- Component -------------------------------------------------------

export default function UploadDatasetModal({
  onClose,
  onUploaded,
}: UploadDatasetModalProps) {
  const { adminLevels } = useCountry();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);

  const [mapping, setMapping] = useState<MappingState>({
    admin_pcode: '',
    admin_name: '',
    value: '',
  });

  const [meta, setMeta] = useState<MetaState>({
    name: '',
    description: '',
    category: '',
    admin_level: 'ADM3',
    type: 'numeric',
    source: '',
    source_link: '',
  });

  const [isPercentage, setIsPercentage] = useState<boolean>(false);

  // categorical-wide state
  const [isWide, setIsWide] = useState<boolean>(false);
  const [wideCategoryColumns, setWideCategoryColumns] = useState<string[]>([]);
  const [autoWideDetected, setAutoWideDetected] = useState<boolean>(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Must match DB check constraint exactly
  const categories = [
    'Core',
    'SSC Framework - P1',
    'SSC Framework - P2',
    'SSC Framework - P3',
    'Hazard',
    'Underlying Vulnerability',
  ];

  // When new columns arrive, guess mapping & possibly wide-format
  useEffect(() => {
    if (!columns.length) return;

    const admin_pcode = guessAdminPcodeColumn(columns);
    const admin_name = guessAdminNameColumn(columns);
    const value = guessValueColumn(columns, [admin_pcode, admin_name]);

    setMapping((prev) => ({
      admin_pcode: admin_pcode || prev.admin_pcode,
      admin_name: admin_name || prev.admin_name,
      value: value || prev.value,
    }));

    if (meta.type === 'numeric') {
      // Only care about percentage auto-flag for numeric datasets
      if (value && headerLooksLikePercentage(value)) {
        setIsPercentage(true);
      }
      setIsWide(false);
      setWideCategoryColumns([]);
      setAutoWideDetected(false);
    }
  }, [columns]);

  // Whenever dataset type changes, reset relevant state
  useEffect(() => {
    if (meta.type === 'numeric') {
      setIsWide(false);
      setWideCategoryColumns([]);
      setAutoWideDetected(false);
    } else {
      // categorical: try detecting wide shape
      if (columns.length && preview.length) {
        const { isWide: detected, defaultCategoryColumns } = detectWideFormat(
          columns,
          preview,
          mapping.admin_pcode,
          mapping.admin_name
        );
        setIsWide(detected);
        setAutoWideDetected(detected);
        setWideCategoryColumns(defaultCategoryColumns);
      }
    }
  }, [meta.type, columns, preview, mapping.admin_pcode, mapping.admin_name]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);

    Papa.parse(f, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = (results.data as any[]).filter(Boolean);
        if (!rows.length) {
          setError('CSV appears empty.');
          setPreview([]);
          setColumns([]);
          return;
        }
        setPreview(rows.slice(0, 5));
        setColumns(Object.keys(rows[0]));
        setError(null);
      },
      error: (err) => {
        console.error('Papaparse error:', err);
        setError('Failed to parse CSV. Please check the file format.');
      },
    });
  };

  const nonAdminColumns = useMemo(() => {
    const avoid = new Set(
      [mapping.admin_pcode, mapping.admin_name].filter(
        (x) => x && columns.includes(x)
      )
    );
    return columns.filter((c) => !avoid.has(c));
  }, [columns, mapping.admin_pcode, mapping.admin_name]);

  const toggleWideCategoryColumn = (col: string) => {
    setWideCategoryColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file.');
      return;
    }
    if (!meta.name.trim()) {
      setError('Please enter a dataset name.');
      return;
    }
    if (!meta.category) {
      setError('Please choose a category.');
      return;
    }
    if (!mapping.admin_pcode && !mapping.admin_name) {
      setError('Please map at least an Admin PCode or Admin Name column.');
      return;
    }

    if (meta.type === 'categorical' && isWide && wideCategoryColumns.length === 0) {
      setError(
        'This looks like a wide-format categorical dataset, but no category columns are selected. Please choose at least one category column or disable wide-format.'
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1) Create dataset metadata row
      const datasetMetadata: any = {
        name: meta.name.trim(),
        description: meta.description.trim() || null,
        category: meta.category,
        type: meta.type,
        admin_level: meta.admin_level,
      };
      
      // Add source information
      if (meta.source.trim()) {
        datasetMetadata.source = meta.source.trim();
      }
      
      // Store source link in metadata JSONB
      if (meta.source_link.trim()) {
        datasetMetadata.metadata = {
          ...(datasetMetadata.metadata || {}),
          source_link: meta.source_link.trim(),
        };
      }
      
      const { data: dataset, error: datasetError } = await supabase
        .from('datasets')
        .insert([datasetMetadata])
        .select()
        .single();

      if (datasetError) {
        throw datasetError;
      }

      // 2) Parse full CSV (raw text, not limited to preview)
      const csvText = await file.text();
      const results = Papa.parse(csvText, {
        header: true,
        dynamicTyping: false, // keep as strings for raw staging
        skipEmptyLines: true,
      });

      const rows = (results.data as any[]).filter(Boolean);
      if (!rows.length) {
        throw new Error('CSV file is empty.');
      }

      if (meta.type === 'numeric') {
        // --- NUMERIC RAW STAGING ------------------------------------------
        const values = rows.map((r) => ({
          dataset_id: dataset.id,
          admin_pcode_raw: mapping.admin_pcode
            ? String(r[mapping.admin_pcode] ?? '').trim() || null
            : null,
          admin_name_raw: mapping.admin_name
            ? String(r[mapping.admin_name] ?? '').trim() || null
            : null,
          value_raw: mapping.value
            ? String(r[mapping.value] ?? '').trim() || null
            : null,
          is_percentage: isPercentage,
          raw_row: r,
        }));

        const cleaned = values.filter(
          (v) =>
            (v.admin_pcode_raw && v.admin_pcode_raw !== '') ||
            (v.admin_name_raw && v.admin_name_raw !== '') ||
            (v.value_raw && v.value_raw !== '')
        );

        if (!cleaned.length) {
          throw new Error('No usable rows found in CSV (after cleaning).');
        }

        const chunkSize = 500;
        for (let i = 0; i < cleaned.length; i += chunkSize) {
          const chunk = cleaned.slice(i, i + chunkSize);
          const { error: chunkError } = await supabase
            .from('dataset_values_numeric_raw')
            .insert(chunk);
          if (chunkError) throw chunkError;
        }

        alert(`✅ Uploaded ${cleaned.length} raw numeric rows.`);
      } else {
        // --- CATEGORICAL RAW STAGING --------------------------------------

        const shape = isWide ? 'wide' : 'long';

        const values = rows.map((r) => {
          // Enrich raw_row with metadata about shape / categories
          let raw_row: any = { ...r };

          if (shape === 'wide') {
            const normalizedMap: Record<string, string> = {};
            for (const col of wideCategoryColumns) {
              normalizedMap[col] = normalizeCategoryName(col);
            }
            raw_row = {
              ...r,
              __ssc_shape: 'wide',
              __ssc_wide_categories: wideCategoryColumns,
              __ssc_wide_categories_normalized: normalizedMap,
            };
          } else {
            raw_row = {
              ...r,
              __ssc_shape: 'long',
              __ssc_category_value_column: mapping.value || null,
            };
          }

          return {
            dataset_id: dataset.id,
            admin_pcode_raw: mapping.admin_pcode
              ? String(r[mapping.admin_pcode] ?? '').trim() || null
              : null,
            admin_name_raw: mapping.admin_name
              ? String(r[mapping.admin_name] ?? '').trim() || null
              : null,
            shape,
            raw_row,
          };
        });

        const cleaned = values.filter(
          (v) =>
            (v.admin_pcode_raw && v.admin_pcode_raw !== '') ||
            (v.admin_name_raw && v.admin_name_raw !== '')
        );

        if (!cleaned.length) {
          throw new Error(
            'No usable rows found in CSV (after cleaning). At minimum, Admin code or name must be present.'
          );
        }

        const chunkSize = 500;
        for (let i = 0; i < cleaned.length; i += chunkSize) {
          const chunk = cleaned.slice(i, i + chunkSize);
          const { error: chunkError } = await supabase
            .from('dataset_values_categorical_raw')
            .insert(chunk);
          if (chunkError) throw chunkError;
        }

        alert(`✅ Uploaded ${cleaned.length} raw categorical rows.`);
      }

      await onUploaded();
      onClose();
    } catch (err: any) {
      console.error('Upload failed:', err);
      setError(err.message || 'Upload failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center border-b px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-800">
            Upload Dataset (raw)
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
            disabled={loading}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3 text-sm">
          {error && <p className="text-red-600">{error}</p>}

          {/* File chooser */}
          <div>
            <label className="block text-gray-700 font-medium">CSV File</label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFile}
              className="mt-1 border rounded px-2 py-1 w-full"
              disabled={loading}
            />
          </div>

          {columns.length > 0 && (
            <>
              {/* Metadata */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium">Dataset Name</label>
                  <input
                    type="text"
                    value={meta.name}
                    onChange={(e) =>
                      setMeta((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="border rounded px-2 py-1 w-full"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block font-medium">Category</label>
                  <select
                    value={meta.category}
                    onChange={(e) =>
                      setMeta((prev) => ({ ...prev, category: e.target.value }))
                    }
                    className="border rounded px-2 py-1 w-full"
                    disabled={loading}
                  >
                    <option value="">Select category</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium">Type</label>
                  <select
                    value={meta.type}
                    onChange={(e) =>
                      setMeta((prev) => ({
                        ...prev,
                        type: e.target.value as DatasetType,
                      }))
                    }
                    className="border rounded px-2 py-1 w-full"
                    disabled={loading}
                  >
                    <option value="numeric">Numeric</option>
                    <option value="categorical">Categorical</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium">Admin Level</label>
                  <select
                    value={meta.admin_level}
                    onChange={(e) =>
                      setMeta((prev) => ({
                        ...prev,
                        admin_level: e.target
                          .value as MetaState['admin_level'],
                      }))
                    }
                    className="border rounded px-2 py-1 w-full"
                    disabled={loading}
                  >
                    {getAdminLevelOptions(adminLevels).map((option) => (
                      <option key={option.levelNumber} value={`ADM${option.levelNumber}`}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium">Description</label>
                <textarea
                  value={meta.description}
                  onChange={(e) =>
                    setMeta((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="border rounded px-2 py-1 w-full"
                  rows={2}
                  disabled={loading}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium">Source</label>
                  <input
                    type="text"
                    value={meta.source}
                    onChange={(e) =>
                      setMeta((prev) => ({ ...prev, source: e.target.value }))
                    }
                    className="border rounded px-2 py-1 w-full"
                    placeholder="e.g., OCHA HDX, World Bank"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block font-medium">Source Link</label>
                  <input
                    type="url"
                    value={meta.source_link}
                    onChange={(e) =>
                      setMeta((prev) => ({ ...prev, source_link: e.target.value }))
                    }
                    className="border rounded px-2 py-1 w-full"
                    placeholder="https://..."
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Numeric-only options */}
              {meta.type === 'numeric' && (
                <div className="flex items-center gap-2">
                  <input
                    id="is_percentage"
                    type="checkbox"
                    checked={isPercentage}
                    onChange={(e) => setIsPercentage(e.target.checked)}
                    disabled={loading}
                  />
                  <label htmlFor="is_percentage" className="text-gray-700">
                    Values are percentages (rates, % or 0–1 scale)
                  </label>
                </div>
              )}

              {/* Categorical wide-format toggle */}
              {meta.type === 'categorical' && (
                <div className="border rounded p-3 bg-gray-50 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      id="wide_toggle"
                      type="checkbox"
                      checked={isWide}
                      onChange={(e) => setIsWide(e.target.checked)}
                      disabled={loading}
                    />
                    <label htmlFor="wide_toggle" className="text-gray-800">
                      Dataset is wide-format (columns are categories, values are in
                      rows)
                    </label>
                  </div>
                  {autoWideDetected && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      Auto-detected wide-format structure based on CSV preview.
                      You can override this using the toggle.
                    </p>
                  )}

                  {isWide && (
                    <div className="mt-2">
                      <p className="text-sm font-medium mb-1">
                        Category Columns (from headers, will be{' '}
                        <span className="italic">normalized</span>):
                      </p>
                      <div className="max-h-40 overflow-y-auto border rounded p-2 bg-white">
                        {nonAdminColumns.length === 0 && (
                          <p className="text-xs text-gray-500">
                            No candidate columns found. Check your admin code/name
                            mapping above.
                          </p>
                        )}
                        {nonAdminColumns.map((c) => (
                          <label
                            key={c}
                            className="flex items-center gap-2 text-xs py-0.5"
                          >
                            <input
                              type="checkbox"
                              checked={wideCategoryColumns.includes(c)}
                              onChange={() => toggleWideCategoryColumn(c)}
                              disabled={loading}
                            />
                            <span className="text-gray-800">{c}</span>
                            <span className="text-gray-400">
                              ({normalizeCategoryName(c)})
                            </span>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        These headers will be normalized (lowercase, underscores)
                        and stored in raw metadata for the cleaning step.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Column mapping */}
              <div className="border-t pt-3">
                <h3 className="font-semibold text-gray-800 mb-1">
                  Column Mapping
                </h3>
                <p className="text-xs text-gray-600 mb-2">
                  Admin PCode or Admin Name is required. Value column is required
                  for numeric datasets. For categorical datasets, value column is
                  primarily used for long-format; wide-format uses multiple
                  category columns instead.
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-gray-700 text-sm">
                      Admin PCode Column
                    </label>
                    <select
                      value={mapping.admin_pcode}
                      onChange={(e) =>
                        setMapping((prev) => ({
                          ...prev,
                          admin_pcode: e.target.value,
                        }))
                      }
                      className="border rounded px-2 py-1 w-full"
                      disabled={loading}
                    >
                      <option value="">Select</option>
                      {columns.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-700 text-sm">
                      Admin Name Column
                    </label>
                    <select
                      value={mapping.admin_name}
                      onChange={(e) =>
                        setMapping((prev) => ({
                          ...prev,
                          admin_name: e.target.value,
                        }))
                      }
                      className="border rounded px-2 py-1 w-full"
                      disabled={loading}
                    >
                      <option value="">Select</option>
                      {columns.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Value column: required for numeric, optional for categorical long-format */}
                  <div>
                    <label className="block text-gray-700 text-sm">
                      {meta.type === 'numeric'
                        ? 'Value Column (numeric)'
                        : 'Primary Value Column (long-format categorical)'}
                    </label>
                    <select
                      value={mapping.value}
                      onChange={(e) =>
                        setMapping((prev) => ({
                          ...prev,
                          value: e.target.value,
                        }))
                      }
                      className="border rounded px-2 py-1 w-full"
                      disabled={loading || (meta.type === 'categorical' && isWide)}
                    >
                      <option value="">
                        {meta.type === 'numeric'
                          ? 'Select'
                          : 'Select (optional in wide mode)'}
                      </option>
                      {columns.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    {meta.type === 'categorical' && isWide && (
                      <p className="text-xs text-gray-500 mt-1">
                        In wide-format mode, this value column is ignored; each
                        selected category column provides its own values.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="border-t pt-3">
                <h3 className="font-semibold text-gray-800 mb-1">
                  Preview (first 5 rows)
                </h3>
                <div className="overflow-x-auto border rounded">
                  <table className="w-full text-xs border-collapse">
                    <thead className="bg-gray-100 text-gray-700">
                      <tr>
                        {columns.map((c) => (
                          <th
                            key={c}
                            className="px-2 py-1 border-b text-left whitespace-nowrap"
                          >
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr key={i} className="border-t">
                          {columns.map((c) => (
                            <td
                              key={c}
                              className="px-2 py-1 border-b whitespace-nowrap"
                            >
                              {String(row[c] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-3 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded bg-gray-200 hover:bg-gray-300"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? 'Uploading…' : 'Upload to Raw Staging'}
          </button>
        </div>
      </div>
    </div>
  );
}
