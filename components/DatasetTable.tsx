"use client";

import React, { useState, useMemo } from "react";
import { createClient } from "@/lib/supabaseClient";

interface DatasetTableProps {
  datasets: any[];
  onEdit: (dataset: any) => void;
  onView: (dataset: any) => void;
  onDelete: (dataset: any) => void;
}

/**
 * Compact, sortable table for displaying datasets
 * Includes admin name lookup (for numeric/categorical datasets)
 */
export default function DatasetTable({
  datasets,
  onEdit,
  onView,
  onDelete,
}: DatasetTableProps) {
  const supabase = createClient();
  const [sortKey, setSortKey] = useState<keyof any>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [adminNames, setAdminNames] = useState<Record<string, string>>({});

  // Fetch admin names only once (for view mode joins)
  useMemo(() => {
    const loadNames = async () => {
      const { data, error } = await supabase
        .from("admin_boundaries")
        .select("admin_pcode, name");
      if (!error && data) {
        const map: Record<string, string> = {};
        data.forEach((row) => (map[row.admin_pcode] = row.name));
        setAdminNames(map);
      }
    };
    loadNames();
  }, [supabase]);

  const toggleSort = (key: keyof any) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const sorted = useMemo(() => {
    return [...datasets].sort((a, b) => {
      const valA = a[sortKey] ?? "";
      const valB = b[sortKey] ?? "";
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [datasets, sortKey, sortAsc]);

  if (!datasets?.length) {
    return (
      <p className="text-gray-500 text-sm italic px-2 py-3 border rounded bg-white">
        No datasets available in this category.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm bg-white">
      <table className="min-w-full text-sm text-gray-800">
        <thead className="bg-gray-100 text-gray-700 text-xs uppercase">
          <tr>
            <th
              className="py-2 px-3 text-left cursor-pointer select-none"
              onClick={() => toggleSort("name")}
            >
              Name {sortKey === "name" ? (sortAsc ? "▲" : "▼") : ""}
            </th>
            <th
              className="py-2 px-3 text-left cursor-pointer select-none"
              onClick={() => toggleSort("category")}
            >
              Category {sortKey === "category" ? (sortAsc ? "▲" : "▼") : ""}
            </th>
            <th className="py-2 px-3 text-left">Admin Level</th>
            <th className="py-2 px-3 text-left">Source</th>
            <th
              className="py-2 px-3 text-left cursor-pointer select-none"
              onClick={() => toggleSort("created_at")}
            >
              Created {sortKey === "created_at" ? (sortAsc ? "▲" : "▼") : ""}
            </th>
            <th className="py-2 px-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((ds, i) => (
            <tr
              key={ds.id || i}
              className={`border-t hover:bg-gray-50 ${
                i % 2 === 0 ? "bg-white" : "bg-gray-50"
              }`}
            >
              <td className="py-2 px-3 font-medium">{ds.name}</td>
              <td className="py-2 px-3">{ds.category || "—"}</td>
              <td className="py-2 px-3">{ds.admin_level || "—"}</td>
              <td className="py-2 px-3 truncate max-w-[150px]">
                {ds.source || "—"}
              </td>
              <td className="py-2 px-3 whitespace-nowrap text-xs text-gray-500">
                {ds.created_at
                  ? new Date(ds.created_at).toLocaleDateString()
                  : "—"}
              </td>
              <td className="py-2 px-3 text-right">
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => onView(ds)}
                    className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200"
                  >
                    View
                  </button>
                  <button
                    onClick={() => onEdit(ds)}
                    className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800 hover:bg-blue-200"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(ds)}
                    className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
