'use client';
import { useState } from 'react';
import Papa from 'papaparse';
import Link from 'next/link';

export default function UploadDatasetPage() {
  const [csvData, setCsvData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [datasetType, setDatasetType] = useState('');
  const [adminLevel, setAdminLevel] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          setCsvData(result.data);
          setHeaders(result.meta.fields || []);
        },
      });
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <header className="border-b pb-4 mb-4">
          <h1 className="text-2xl font-semibold text-gray-800">
            Upload New Dataset
          </h1>
          <nav className="text-sm text-gray-500 mt-1">
            <Link href="/" className="hover:underline text-blue-600">
              Home
            </Link>{' '}
            /{' '}
            <Link href="/datasets" className="hover:underline text-blue-600">
              Datasets
            </Link>{' '}
            / Upload
          </nav>
        </header>

        {/* Upload Panel */}
        <div className="bg-white rounded-xl shadow p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Upload CSV File
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="block w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>

          {/* Metadata Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dataset Type
              </label>
              <select
                value={datasetType}
                onChange={(e) => setDatasetType(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option value="">Select type</option>
                <option value="numeric">Numeric</option>
                <option value="categorical">Categorical</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Admin Level
              </label>
              <select
                value={adminLevel}
                onChange={(e) => setAdminLevel(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option value="">Select level</option>
                <option value="ADM1">ADM1</option>
                <option value="ADM2">ADM2</option>
                <option value="ADM3">ADM3</option>
                <option value="ADM4">ADM4</option>
              </select>
            </div>
          </div>

          {/* Column Mapping Preview */}
          {headers.length > 0 && (
            <div className="pt-4 border-t">
              <h2 className="text-lg font-semibold text-gray-800 mb-2">
                Column Mapping
              </h2>
              <p className="text-sm text-gray-600 mb-3">
                Select which columns map to required fields.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Admin PCode
                  </label>
                  <select className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                    <option value="">Select column</option>
                    {headers.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Value Column
                  </label>
                  <select className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                    <option value="">Select column</option>
                    {headers.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Optional Label Column
                  </label>
                  <select className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                    <option value="">(Optional)</option>
                    {headers.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
