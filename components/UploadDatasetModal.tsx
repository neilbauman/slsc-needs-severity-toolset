'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { supabase } from '@/lib/supabaseClient';

interface UploadDatasetModalProps {
  onClose: () => void;
  onUploaded: () => Promise<void>;
}

export default function UploadDatasetModal({ onClose, onUploaded }: UploadDatasetModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<any[]>([]);
  const [pcodeColumn, setPcodeColumn] = useState('');
  const [valueColumn, setValueColumn] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Core');
  const [adminLevel, setAdminLevel] = useState('ADM3');
  const [type, setType] = useState<'numeric' | 'categorical'>('numeric');
  const [uploading, setUploading] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      Papa.parse(f, {
        header: true,
        complete: (results) => {
          setParsed(results.data);
        },
      });
    }
  };

  const handleUpload = async () => {
    if (!parsed.length || !pcodeColumn || !valueColumn || !name) {
      alert('Missing required fields.');
      return;
    }

    setUploading(true);

    const { data: newDataset, error: dsErr } = await supabase
      .from('datasets')
      .insert([
        {
          name,
          category,
          admin_level: adminLevel,
          type,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (dsErr) {
      alert(`Error creating dataset: ${dsErr.message}`);
      setUploading(false);
      return;
    }

    const valuesTable = type === 'categorical' ? 'dataset_values_categorical' : 'dataset_values_numeric';
    const rows = parsed.map((r) => ({
      dataset_id: newDataset.id,
      admin_pcode: r[pcodeColumn],
      value: r[valueColumn],
    }));

    const { error: valErr } = await supabase.from(valuesTable).insert(rows);
    setUploading(false);

    if (valErr) alert(`Error inserting values: ${valErr.message}`);
    else {
      await onUploaded();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Upload Dataset</h2>

        <div className="space-y-3 text-sm">
          <input type="file" accept=".csv" onChange={handleFile} />

          {parsed.length > 0 && (
            <>
              <div>
                <label className="block text-gray-700 mb-1">Dataset Name</label>
                <input
                  className="w-full border rounded-md px-3 py-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-1">Category</label>
                <select
                  className="w-full border rounded-md px-3 py-2"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="Core">Core</option>
                  <option value="SSC Framework - P1">SSC Framework - P1</option>
                  <option value="SSC Framework - P2">SSC Framework - P2</option>
                  <option value="SSC Framework - P3">SSC Framework - P3</option>
                  <option value="Hazards">Hazards</option>
                  <option value="Underlying Vulnerabilities">Underlying Vulnerabilities</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 mb-1">PCode Column</label>
                  <select
                    className="w-full border rounded-md px-3 py-2"
                    onChange={(e) => setPcodeColumn(e.target.value)}
                  >
                    <option value="">Select...</option>
                    {Object.keys(parsed[0]).map((col) => (
                      <option key={col}>{col}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 mb-1">Value Column</label>
                  <select
                    className="w-full border rounded-md px-3 py-2"
                    onChange={(e) => setValueColumn(e.target.value)}
                  >
                    <option value="">Select...</option>
                    {Object.keys(parsed[0]).map((col) => (
                      <option key={col}>{col}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 mb-1">Admin Level</label>
                  <select
                    className="w-full border rounded-md px-3 py-2"
                    value={adminLevel}
                    onChange={(e) => setAdminLevel(e.target.value)}
                  >
                    <option value="ADM1">ADM1</option>
                    <option value="ADM2">ADM2</option>
                    <option value="ADM3">ADM3</option>
                    <option value="ADM4">ADM4</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 mb-1">Type</label>
                  <select
                    className="w-full border rounded-md px-3 py-2"
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                  >
                    <option value="numeric">Numeric</option>
                    <option value="categorical">Categorical</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleUpload}
                disabled={uploading}
                className="bg-blue-600 text-white px-4 py-2 rounded-md w-full mt-3 hover:bg-blue-700 disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Upload Dataset'}
              </button>
            </>
          )}
        </div>

        <button
          onClick={onClose}
          className="text-sm text-gray-600 hover:text-gray-900 mt-3 block mx-auto"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
