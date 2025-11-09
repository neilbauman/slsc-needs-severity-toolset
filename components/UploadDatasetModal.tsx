"use client";

import React, { useState } from "react";
import Papa from "papaparse";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

const UploadDatasetModal: React.FC<Props> = ({ isOpen, onClose, onSave }) => {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState("");
  const [adminLevel, setAdminLevel] = useState("adm3");
  const [type, setType] = useState("numeric");
  const [columnAdminCode, setColumnAdminCode] = useState("");
  const [columnValue, setColumnValue] = useState("");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;
    setFile(uploadedFile);

    Papa.parse(uploadedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as any[];
        setCsvData(data);
        setHeaders(Object.keys(data[0] || {}));
      },
    });
  };

  const handleSubmit = async () => {
    if (!file || !name || !columnAdminCode || !columnValue) return;

    const { data: datasetMeta, error: metaError } = await supabase
      .from("datasets")
      .insert({
        name,
        description,
        source,
        admin_level: adminLevel,
        type,
        column_admin_code: columnAdminCode,
        column_value: columnValue,
      })
      .select()
      .single();

    if (metaError || !datasetMeta) {
      console.error("Metadata upload failed:", metaError);
      return;
    }

    const datasetId = datasetMeta.id;
    const valueRows = csvData.map((row) => ({
      dataset_id: datasetId,
      admin_code: row[columnAdminCode],
      value: row[columnValue],
    }));

    const { error: dataError } = await supabase
      .from("dataset_values")
      .insert(valueRows);

    if (dataError) {
      console.error("Value upload failed:", dataError);
      return;
    }

    onSave();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex justify-between items-center border-b pb-2">
          <h2 className="text-xl font-semibold text-gray-800">Upload Dataset</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-red-500">✕</button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Upload CSV</label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="mt-1 block w-full text-sm text-gray-700 border border-gray-300 rounded p-1"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Dataset Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Source</label>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Admin Level</label>
            <select
              value={adminLevel}
              onChange={(e) => setAdminLevel(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value="adm0">Adm0</option>
              <option value="adm1">Adm1</option>
              <option value="adm2">Adm2</option>
              <option value="adm3">Adm3</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value="numeric">Numeric</option>
              <option value="categorical">Categorical</option>
              <option value="binary">Binary</option>
              <option value="gradient">Gradient</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Admin Code Column</label>
            <select
              value={columnAdminCode}
              onChange={(e) => setColumnAdminCode(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value="">Select column</option>
              {headers.map((header) => (
                <option key={header} value={header}>{header}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Value Column</label>
            <select
              value={columnValue}
              onChange={(e) => setColumnValue(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value="">Select column</option>
              {headers.map((header) => (
                <option key={header} value={header}>{header}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded px-2 py-1 text-sm"
            rows={3}
          />
        </div>

        {csvData.length > 0 && (
          <div className="border rounded p-2 max-h-64 overflow-y-scroll text-sm font-mono bg-gray-50">
            <table className="table-auto w-full text-xs">
              <thead className="bg-gray-200 sticky top-0">
                <tr>
                  {Object.keys(csvData[0]).map((key) => (
                    <th key={key} className="text-left p-1 border-b border-gray-300">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvData.slice(0, 10).map((row, idx) => (
                  <tr key={idx} className="even:bg-white odd:bg-gray-100">
                    {Object.keys(row).map((key) => (
                      <td key={key} className="p-1 whitespace-nowrap">
                        {row[key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end space-x-2 pt-4 border-t">
          <button
            onClick={onClose}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            Upload
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadDatasetModal;
