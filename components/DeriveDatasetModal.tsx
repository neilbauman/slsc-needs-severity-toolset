"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function DeriveDatasetModal({ onClose, onDerived, datasets }) {
  const [source1, setSource1] = useState("");
  const [source2, setSource2] = useState("");
  const [operation, setOperation] = useState("scalar");
  const [scalarValue, setScalarValue] = useState("");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("Derived");
  const [description, setDescription] = useState("");
  const [targetAdmin, setTargetAdmin] = useState("ADM3");
  const [aggMethod, setAggMethod] = useState("sum");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    const source_datasets = [source1];
    if (operation !== "scalar" && source2) source_datasets.push(source2);

    const { error } = await supabase.rpc("derive_dataset", {
      source_datasets,
      new_name: newName,
      operation,
      scalar_value: parseFloat(scalarValue) || null,
      new_category: newCategory,
      new_description: description,
      target_admin_level: targetAdmin,
    });

    setLoading(false);
    if (error) {
      alert(`Error: ${error.message}`);
      console.error(error);
    } else {
      onDerived();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-5 text-sm">
        <h2 className="text-lg font-semibold mb-3 text-gray-800">
          Create Derived Dataset
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-gray-600 mb-1">Dataset 1</label>
            <select
              value={source1}
              onChange={(e) => setSource1(e.target.value)}
              className="w-full border rounded-md p-2"
              required
            >
              <option value="">Select dataset</option>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {operation !== "scalar" && (
            <div>
              <label className="block text-gray-600 mb-1">Dataset 2</label>
              <select
                value={source2}
                onChange={(e) => setSource2(e.target.value)}
                className="w-full border rounded-md p-2"
              >
                <option value="">Select dataset</option>
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-gray-600 mb-1">Operation</label>
            <select
              value={operation}
              onChange={(e) => setOperation(e.target.value)}
              className="w-full border rounded-md p-2"
            >
              <option value="add">Add (Aggregation)</option>
              <option value="subtract">Subtract (Aggregation)</option>
              <option value="multiply">Multiply (Aggregation)</option>
              <option value="divide">Divide (Aggregation)</option>
              <option value="scalar">Multiply by Scalar (Disaggregation)</option>
            </select>
          </div>

          {operation === "scalar" && (
            <div>
              <label className="block text-gray-600 mb-1">Scalar Value</label>
              <input
                type="number"
                value={scalarValue}
                onChange={(e) => setScalarValue(e.target.value)}
                className="w-full border rounded-md p-2"
              />
            </div>
          )}

          <div>
            <label className="block text-gray-600 mb-1">New Dataset Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full border rounded-md p-2"
              required
            />
          </div>

          <div>
            <label className="block text-gray-600 mb-1">Category</label>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="w-full border rounded-md p-2"
            >
              <option>Core</option>
              <option>SSC Framework - P1</option>
              <option>SSC Framework - P2</option>
              <option>SSC Framework - P3</option>
              <option>Underlying Vulnerability</option>
              <option>Derived</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-600 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border rounded-md p-2"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-gray-600 mb-1">Target Admin Level</label>
            <select
              value={targetAdmin}
              onChange={(e) => setTargetAdmin(e.target.value)}
              className="w-full border rounded-md p-2"
            >
              <option>ADM0</option>
              <option>ADM1</option>
              <option>ADM2</option>
              <option>ADM3</option>
              <option>ADM4</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-600 mb-1">
              Aggregation / Disaggregation Method
            </label>
            <select
              value={aggMethod}
              onChange={(e) => setAggMethod(e.target.value)}
              className="w-full border rounded-md p-2"
            >
              <option value="sum">Sum</option>
              <option value="average">Average</option>
              <option value="weighted">Weighted</option>
              <option value="distribute">Distribute</option>
            </select>
          </div>

          <div className="flex justify-end space-x-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
