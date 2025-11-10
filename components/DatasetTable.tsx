'use client';

import React from 'react';

interface DatasetTableProps {
  datasets: any[];
  onEdit: (dataset: any) => void;
  onView: (dataset: any) => void;
  onDelete: (dataset: any) => void;
}

const categoryOrder = [
  'Core',
  'SSC Framework - P1',
  'SSC Framework - P2',
  'SSC Framework - P3',
  'Hazards',
  'Underlying Vulnerabilities',
];

export default function DatasetTable({ datasets, onEdit, onView, onDelete }: DatasetTableProps) {
  const grouped = categoryOrder.map(cat => ({
    name: cat,
    items: datasets.filter(d => d.category === cat),
  }));

  return (
    <div className="space-y-6">
      {grouped.map(group => (
        <div key={group.name}>
          <h2 className="text-md font-semibold text-gray-800 mb-2">{group.name}</h2>
          <div className="overflow-x-auto border border-gray-200 rounded-md">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Admin Level</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map(ds => (
                  <tr key={ds.id} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2">{ds.name}</td>
                    <td className="px-3 py-2">{ds.admin_level}</td>
                    <td className="px-3 py-2">{ds.type}</td>
                    <td className="px-3 py-2 text-right space-x-2">
                      <button
                        onClick={() => onView(ds)}
                        className="text-blue-600 hover:underline text-xs"
                      >
                        View
                      </button>
                      <button
                        onClick={() => onEdit(ds)}
                        className="text-yellow-600 hover:underline text-xs"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDelete(ds)}
                        className="text-red-600 hover:underline text-xs"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {group.items.length === 0 && (
                  <tr>
                    <td className="px-3 py-2 text-gray-400 italic" colSpan={4}>
                      No datasets in this category
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
