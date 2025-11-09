import React from "react";

interface ViewDatasetModalProps {
  dataset: any;
  onClose: () => void;
}

const ViewDatasetModal: React.FC<ViewDatasetModalProps> = ({ dataset, onClose }) => {
  const previewData = dataset.preview || [];
  const interpretationType = dataset.interpretation_type;

  const getColumns = () => {
    if (interpretationType === "categorical") {
      // Get unique category values across all rows for columns
      const categories = new Set<string>();
      previewData.forEach((row: any) => {
        Object.keys(row).forEach((key) => {
          categories.add(key);
        });
      });
      return Array.from(categories);
    } else {
      // For numeric datasets, use first row's keys
      return previewData.length > 0 ? Object.keys(previewData[0]) : [];
    }
  };

  const columns = getColumns();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded shadow-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h2 className="text-xl font-semibold">Dataset Preview</h2>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-black"
          >
            ×
          </button>
        </div>

        {/* Metadata */}
        <div className="p-4 border-b text-sm text-gray-700 bg-gray-50">
          <p><strong>Name:</strong> {dataset.name}</p>
          <p><strong>Interpretation Type:</strong> {dataset.interpretation_type}</p>
          <p><strong>Admin Level:</strong> {dataset.admin_level}</p>
        </div>

        {/* Table Preview */}
        <div className="flex-1 overflow-auto p-4">
          {columns.length > 0 ? (
            <table className="table-auto w-full text-sm border">
              <thead>
                <tr className="bg-gray-200 text-left">
                  {columns.map((col) => (
                    <th key={col} className="px-3 py-2 border-b border-gray-300">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    {columns.map((col) => (
                      <td key={col} className="px-3 py-2 border-b border-gray-100">
                        {row[col] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-gray-500">No data available for preview.</p>
          )}
        </div>

        <div className="p-4 border-t bg-gray-100 text-right">
          <button
            onClick={onClose}
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewDatasetModal;
