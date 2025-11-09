'use client';

import { useState } from 'react';

export default function DatasetUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [adminLevel, setAdminLevel] = useState('');
  const [name, setName] = useState('');
  const [source, setSource] = useState('');

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file || !adminLevel || !name) {
      alert('Please fill all required fields.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name);
    formData.append('source', source);
    formData.append('admin_level', adminLevel);

    const res = await fetch('/api/upload-dataset', {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      alert('Upload successful');
    } else {
      alert('Upload failed');
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-brand">Upload New Dataset</h1>

      <form onSubmit={handleUpload} className="space-y-4 bg-white shadow p-6 rounded-xl">
        <div>
          <label className="block text-sm font-medium mb-1">Dataset Name *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            className="w-full border rounded p-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Source</label>
          <input
            type="text"
            value={source}
            onChange={e => setSource(e.target.value)}
            className="w-full border rounded p-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Admin Level *</label>
          <select
            value={adminLevel}
            onChange={e => setAdminLevel(e.target.value)}
            required
            className="w-full border rounded p-2"
          >
            <option value="">Select level</option>
            <option value="ADM0">ADM0</option>
            <option value="ADM1">ADM1</option>
            <option value="ADM2">ADM2</option>
            <option value="ADM3">ADM3</option>
            <option value="ADM4">ADM4</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">CSV File *</label>
          <input
            type="file"
            accept=".csv"
            onChange={e => setFile(e.target.files?.[0] || null)}
            required
            className="w-full"
          />
        </div>

        <button
          type="submit"
          className="bg-brand text-white px-4 py-2 rounded hover:bg-brand-dark"
        >
          Upload Dataset
        </button>
      </form>
    </div>
  );
}
