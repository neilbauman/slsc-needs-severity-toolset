'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { supabase } from '@/lib/supabaseClient';

interface UploadDatasetModalProps {
  onClose: () => void;
  onUploaded: () => void;
}

export default function UploadDatasetModal({
  onClose,
  onUploaded,
}: UploadDatasetModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState<'numeric' | 'categorical'>('numeric');
  const [adminLevel, setAdminLevel] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const categories = [
    'Core',
    'SSC Framework - P1',
    'SSC Framework - P2',
    'SSC Framework - P3',
    'Hazards',
    'Underlying Vulnerability',
  ];

  const adminLevels = ['ADM2', 'ADM3', 'ADM4'];
  const types = ['numeric', 'categorical'];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleUpload = async () => {
    if (!name || !category || !adminLevel || !file) {
      alert('Please complete all required fields.');
      return;
    }

    setUploading(true);

    try {
      // 1️⃣ Parse CSV
      const text = await file.text();
      const parsed = Papa.parse(text, { header: true });
      if (!parsed.data || parsed.data.length === 0) {
        alert('CSV is empty or invalid.');
        setUploading(false);
        return;
      }

      // 2️⃣ Create dataset record
      const { data: dataset, error: datasetError } = await supabase
        .from('datasets')
        .insert([
          {
            name,
            category,
            type,
            admin_level: adminLevel,
            description,
            created_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (datasetError) throw datasetError;

      // 3️⃣ Prepare rows for insertion
      const rows = parsed.data
        .filter((r: any) => r.PCode && r.Value !== undefined)
        .map((r: any) => ({
          dataset_id: dataset.id,
          admin_pcode: r.PCode.trim(),
          value: type === 'numeric' ? Number(r.Value) : r.Value,
        }));

      if (rows.length === 0) {
        alert('No valid rows found in CSV.');
        setUploading(false);
        return;
      }

      // 4️⃣ Insert dataset values
      const targetTable =
        type === 'numeric'
          ? 'dataset_values_numeric'
          : 'dataset_values_categorical';

      const { error: insertError } = await supabase
        .from(targetTable)
        .insert(rows);

      if (insertError) throw insertError;

      alert('Dataset uploaded successfully.');
      onUploaded();
      onClose();
    } catch (error: any) {
      console.error('Upload error:', error);
      alert('Failed to upload dataset.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Upload Dataset
        </h2>

        <div className="space-y-4">
          {/* Dataset Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm focus:ring focus:ring-blue-200"
              placeholder="Dataset name"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm focus:ring focus:ring-blue-200"
            >
              <option value="">Select category</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type <span className="text-red-500">*</span>
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'numeric' | 'categorical')}
              className="w-full border rounded-md px-3 py-2 text-sm focus:ring focus:ring-blue-200"
            >
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Admin Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Admin Level <span className="text-red-500">*</span>
            </label>
            <select
              value={adminLevel}
              onChange={(e) => setAdminLevel(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm focus:ring focus:ring-blue-200"
            >
              <option value="">Select admin level</option>
              {adminLevels.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full border rounded-md px-3 py-2 text-sm focus:ring focus:ring-blue-200"
              placeholder="Describe the dataset..."
            />
          </div>

          {/* File Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CSV File <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="w-full text-sm text-gray-700"
            />
            <p className="text-xs text-gray-500 mt-1">
              Expected headers: <code>PCode, Value</code>
            </p>
          </div>
        </div>

        <div className="flex justify-end mt-6 space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md"
            disabled={uploading}
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md"
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}
