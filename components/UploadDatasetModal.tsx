'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Papa from 'papaparse';

interface UploadDatasetModalProps {
  onClose: () => void;
  onUploaded: () => void;
}

export default function UploadDatasetModal({ onClose, onUploaded }: UploadDatasetModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState({
    admin_pcode: '',
    admin_name: '',
    value: '',
  });

  const [meta, setMeta] = useState({
    name: '',
    description: '',
    category: '',
    admin_level: 'ADM3',
    type: 'numeric',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = [
    'Core',
    'SSC Framework - P1',
    'SSC Framework - P2',
    'SSC Framework - P3',
    'Hazards',
    'Underlying Vulnerability',
  ];

  const handleFile = (e: any) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    Papa.parse(f, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as any[];
        if (rows.length === 0) {
          setError('CSV appears empty.');
          return;
        }
        setPreview(rows.slice(0, 5));
        setColumns(Object.keys(rows[0]));
        setError(null);
      },
    });
  };

  const handleUpload = async () => {
    if (!file) return setError('Please select a file.');
    if (!mapping.admin_pcode || !mapping.value)
      return setError('Please map Admin PCode and Value columns.');
    if (!meta.name) return setError('Please enter a dataset name.');

    setLoading(true);
    setError(null);

    try {
      // Insert dataset metadata
      const { data: dataset, error: insertError } = await supabase
        .from('datasets')
        .insert([
          {
            name: meta.name,
            description: meta.description,
            category: meta.category,
            type: meta.type,
            admin_level: meta.admin_level,
          },
        ])
        .select()
        .single();

      if (insertError) throw insertError;

      // Parse the entire CSV synchronously
      const csvText = await file.text();
      const results = Papa.parse(csvText, { header: true, dynamicTyping: true });
      const rows = results.data as any[];

      if (!rows || rows.length === 0) throw new Error('CSV file is empty.');

      // Build dataset values
      const values = rows
        .filter((r) => r[mapping.admin_pcode] && r[mapping.value] !== undefined)
        .map((r) => ({
          dataset_id: dataset.id,
          admin_pcode: String(r[mapping.admin_pcode]).trim(),
          admin_name: mapping.admin_name ? String(r[mapping.admin_name] || '').trim() : null,
          value: meta.type === 'numeric' ? Number(r[mapping.value]) : String(r[mapping.value]),
        }));

      if (values.length === 0) throw new Error('No valid rows found in CSV.');

      const table =
        meta.type === 'numeric' ? 'dataset_values_numeric' : 'dataset_values_categorical';

      // Insert in chunks to avoid payload limits
      const chunkSize = 500;
      for (let i = 0; i < values.length; i += chunkSize) {
        const chunk = values.slice(i, i + chunkSize);
        const { error: insertChunkError } = await supabase.from(table).insert(chunk);
        if (insertChunkError) throw insertChunkError;
      }

      alert(`✅ Uploaded ${values.length} rows to ${table}`);
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
        <div className="flex justify-between items-center border-b px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-800">Upload Dataset</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl">
            ×
          </button>
        </div>

        <div className="p-4 space-y-3 text-sm">
          {error && <p className="text-red-600">{error}</p>}

          <div>
            <label className="block text-gray-700 font-medium">CSV File</label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFile}
              className="mt-1 border rounded px-2 py-1 w-full"
            />
          </div>

          {columns.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium">Dataset Name</label>
                  <input
                    type="text"
                    value={meta.name}
                    onChange={(e) => setMeta({ ...meta, name: e.target.value })}
                    className="border rounded px-2 py-1 w-full"
                  />
                </div>

                <div>
                  <label className="block font-medium">Category</label>
                  <select
                    value={meta.category}
                    onChange={(e) => setMeta({ ...meta, category: e.target.value })}
                    className="border rounded px-2 py-1 w-full"
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
                    onChange={(e) => setMeta({ ...meta, type: e.target.value })}
                    className="border rounded px-2 py-1 w-full"
                  >
                    <option value="numeric">Numeric</option>
                    <option value="categorical">Categorical</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium">Admin Level</label>
                  <select
                    value={meta.admin_level}
                    onChange={(e) => setMeta({ ...meta, admin_level: e.target.value })}
                    className="border rounded px-2 py-1 w-full"
                  >
                    <option value="ADM1">ADM1</option>
                    <option value="ADM2">ADM2</option>
                    <option value="ADM3">ADM3</option>
                    <option value="ADM4">ADM4</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium">Description</label>
                <textarea
                  value={meta.description}
                  onChange={(e) => setMeta({ ...meta, description: e.target.value })}
                  className="border rounded px-2 py-1 w-full"
                  rows={2}
                />
              </div>

              <div className="border-t pt-3">
                <h3 className="font-semibold text-gray-800 mb-1">Column Mapping</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-gray-700">Admin PCode Column</label>
                    <select
                      value={mapping.admin_pcode}
                      onChange={(e) =>
                        setMapping({ ...mapping, admin_pcode: e.target.value })
                      }
                      className="border rounded px-2 py-1 w-full"
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
                    <label className="block text-gray-700">Admin Name (optional)</label>
                    <select
                      value={mapping.admin_name}
                      onChange={(e) =>
                        setMapping({ ...mapping, admin_name: e.target.value })
                      }
                      className="border rounded px-2 py-1 w-full"
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
                    <label className="block text-gray-700">Value Column</label>
                    <select
                      value={mapping.value}
                      onChange={(e) => setMapping({ ...mapping, value: e.target.value })}
                      className="border rounded px-2 py-1 w-full"
                    >
                      <option value="">Select</option>
                      {columns.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="border-t pt-3">
                <h3 className="font-semibold text-gray-800 mb-1">Preview (first 5 rows)</h3>
                <div className="overflow-x-auto border rounded">
                  <table className="w-full text-xs border-collapse">
                    <thead className="bg-gray-100 text-gray-700">
                      <tr>
                        {columns.map((c) => (
                          <th key={c} className="px-2 py-1 border-b text-left">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr key={i} className="border-t">
                          {columns.map((c) => (
                            <td key={c} className="px-2 py-1 border-b">
                              {String(row[c])}
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
            className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            {loading ? 'Uploading…' : 'Upload Dataset'}
          </button>
        </div>
      </div>
    </div>
  );
}
