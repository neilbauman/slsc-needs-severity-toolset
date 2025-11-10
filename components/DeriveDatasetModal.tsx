"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface DeriveDatasetModalProps {
  datasets: any[];
  onClose: () => void;
  onDerived: () => void;
}

export default function DeriveDatasetModal({
  datasets,
  onClose,
  onDerived,
}: DeriveDatasetModalProps) {
  const [form, setForm] = useState({
    source1: "",
    source2: "",
    new_name: "",
    new_category: "",
    new_description: "",
    operation: "",
    scalar_value: "",
    target_admin_level: "ADM3",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleDerive = async () => {
    if (!form.source1 || !form.operation || !form.new_name) {
      setMessage("⚠️ Please fill out required fields.");
      return;
    }

    setLoading(true);
    setMessage("");

    const sourceArray = form.source2
      ? [form.source1, form.source2]
      : [form.source1];

    const { data, error } = await supabase.rpc("derive_dataset", {
      source_datasets: sourceArray,
      new_name: form.new_name,
      operation: form.operation,
      scalar_value: form.scalar_value ? parseFloat(form.scalar_value) : null,
      new_category: form.new_category || "Derived",
      new_description: form.new_description || null,
      target_admin_level: form.target_admin_level,
    });

    if (error) {
      console.error("Error deriving dataset:", error);
      setMessage(`❌ Failed to derive dataset: ${error.message}`);
    } else {
      setMessage("✅ Derived dataset created successfully!");
      await onDerived();
      setTimeout(onClose, 1200);
    }

    setLoading(false);
  };

  // For operation explanations
  const operationDescriptions: Record<string, string> = {
    aggregate_sum: "Aggregate up (sum values to higher admin level)",
    aggregate_mean: "Aggregate up (average values to higher admin level)",
    disaggregate_population:
      "Disaggregate down using population as weighting (split values to lower admin level)",
    multiply: "Multiply two datasets together (element-wise)",
    divide: "Divide dataset 1 by dataset 2 (e.g., population / evac centers)",
    add: "Add two datasets together (element-wise)",
    subtract: "Subtract dataset 2 from dataset 1",
    scalar: "Multiply or divide by a constant (scalar value)",
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-[520px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">
            Derive New Dataset
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-4 py-3 text-sm space-y-3">
          {/* Source datasets */}
          <div>
            <label className="block text-gray-700 font-medium">
              Primary Source Dataset
            </label>
            <select
              value={form.source1}
              onChange={(e) => handleChange("source1", e.target.value)}
              className="w-full border rounded p-2 mt-1"
            >
              <option value="">Select dataset</option>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.admin_level})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-gray-700 font-medium">
              Secondary Dataset (optional)
            </label>
            <select
              value={form.source2}
              onChange={(e) => handleChange("source2", e.target.value)}
              className="w-full border rounded p-2 mt-1"
            >
              <option value="">None</option>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.admin_level})
                </option>
              ))}
            </select>
          </div>

          {/* Operation */}
          <div>
            <label className="block text-gray-700 font-medium">
              Operation Type
            </label>
            <select
              value={form.operation}
              onChange={(e) => handleChange("operation", e.target.value)}
              className="w-full border rounded p-2 mt-1"
            >
              <option value="">Select operation</option>
              <optgroup label="Aggregate">
                <option value="aggregate_sum">Aggregate (Sum)</option>
                <option value="aggregate_mean">Aggregate (Mean)</option>
              </optgroup>
              <optgroup label="Disaggregate">
                <option value="disaggregate_population">
                  Disaggregate (Weighted by Population)
                </option>
              </optgroup>
              <optgroup label="Arithmetic">
                <option value="multiply">Multiply (A × B)</option>
                <option value="divide">Divide (A ÷ B)</option>
                <option value="add">Add (A + B)</option>
                <option value="subtract">Subtract (A − B)</option>
                <option value="scalar">Multiply or Divide by Scalar</option>
              </optgroup>
            </select>
            {form.operation && (
              <p className="text-xs text-gray-500 mt-1">
                {operationDescriptions[form.operation] || ""}
              </p>
            )}
          </div>

          {/* Scalar field */}
          {form.operation === "scalar" && (
            <div>
              <label className="block text-gray-700 font-medium">
                Scalar Value
              </label>
              <input
                type="number"
                step="any"
                value={form.scalar_value}
                onChange={(e) =>
                  handleChange("scalar_value", e.target.value.trim())
                }
                className="w-full border rounded p-2 mt-1"
                placeholder="e.g., 4.8 for dividing population by average household size"
              />
            </div>
          )}

          {/* Metadata */}
          <div>
            <label className="block text-gray-700 font-medium">New Name</label>
            <input
              type="text"
              value={form.new_name}
              onChange={(e) => handleChange("new_name", e.target.value)}
              className="w-full border rounded p-2 mt-1"
              placeholder="Derived dataset name"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium">Category</label>
            <select
              value={form.new_category}
              onChange={(e) => handleChange("new_category", e.target.value)}
              className="w-full border rounded p-2 mt-1"
            >
              <option value="">Select category</option>
              <option value="SSC Framework - P1">SSC Framework - P1</option>
              <option value="SSC Framework - P2">SSC Framework - P2</option>
              <option value="SSC Framework - P3">SSC Framework - P3</option>
              <option value="Hazard">Hazard</option>
              <option value="Exposure">Exposure</option>
              <option value="Vulnerability">Vulnerability</option>
              <option value="Underlying">Underlying</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-700 font-medium">
              Description
            </label>
            <textarea
              value={form.new_description}
              onChange={(e) =>
                handleChange("new_description", e.target.value)
              }
              className="w-full border rounded p-2 mt-1 resize-none h-16"
              placeholder="Brief explanation of how this dataset is derived"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium">
              Target Admin Level
            </label>
            <select
              value={form.target_admin_level}
              onChange={(e) =>
                handleChange("target_admin_level", e.target.value)
              }
              className="w-full border rounded p-2 mt-1"
            >
              <option value="ADM1">ADM1</option>
              <option value="ADM2">ADM2</option>
              <option value="ADM3">ADM3</option>
              <option value="ADM4">ADM4</option>
            </select>
          </div>

          {message && (
            <div
              className={`text-sm text-center ${
                message.startsWith("✅") ? "text-green-600" : "text-red-600"
              }`}
            >
              {message}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-3 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-100 text-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleDerive}
            disabled={loading}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Processing..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
