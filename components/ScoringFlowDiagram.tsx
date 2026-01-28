'use client';

interface ScoringFlowDiagramProps {
  compact?: boolean;
  className?: string;
}

export default function ScoringFlowDiagram({ compact = true, className = '' }: ScoringFlowDiagramProps) {
  if (compact) {
    return (
      <div className={`bg-gradient-to-r from-gray-50 to-blue-50 border border-gray-200 rounded-lg p-3 ${className}`}>
        <div className="flex items-center justify-center gap-1 text-xs flex-wrap">
          <div className="px-1.5 py-0.5 bg-white border rounded shadow-sm font-medium">Datasets</div>
          <span className="text-gray-400">→</span>
          <div className="px-1.5 py-0.5 bg-white border rounded shadow-sm">Categories</div>
          <span className="text-gray-400">→</span>
          <div className="flex items-center gap-0.5">
            <div className="px-1 py-0.5 bg-red-100 border border-red-300 rounded text-red-800 font-medium text-[10px]">P1</div>
            <span className="text-gray-400">+</span>
            <div className="px-1 py-0.5 bg-orange-100 border border-orange-300 rounded text-orange-800 font-medium text-[10px]">P2</div>
            <span className="text-gray-400">+</span>
            <div className="px-1 py-0.5 bg-purple-100 border border-purple-300 rounded text-purple-800 font-medium text-[10px]">P3</div>
          </div>
          <span className="text-gray-400">→</span>
          <div className="px-1.5 py-0.5 bg-green-600 text-white border rounded shadow-sm font-semibold">SSC</div>
          <span className="text-gray-400">+</span>
          <div className="px-1.5 py-0.5 bg-yellow-500 text-white border rounded shadow-sm font-semibold">Hazard</div>
          <span className="text-gray-400">+</span>
          <div className="px-1.5 py-0.5 bg-indigo-500 text-white border rounded shadow-sm font-semibold">Vuln</div>
          <span className="text-gray-400">→</span>
          <div className="px-2 py-0.5 bg-blue-600 text-white border-2 border-blue-700 rounded shadow-md font-bold">Overall</div>
        </div>
        <div className="flex items-center justify-center gap-1.5 mt-1 text-[8px] text-gray-500">
          <span>P3.2→Hazard</span>
          <span>•</span>
          <span>P3.1→Vuln</span>
        </div>
      </div>
    );
  }

  // Expanded version for detailed views
  return (
    <div className={`bg-gray-50 border rounded-lg p-4 ${className}`}>
      <h4 className="font-semibold mb-3 text-sm">Scoring Flow</h4>
      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="px-2 py-1 bg-white border rounded">Datasets</div>
          <span className="text-gray-400">→</span>
          <div className="px-2 py-1 bg-white border rounded">Categories (weighted avg)</div>
          <span className="text-gray-400">→</span>
          <div className="flex items-center gap-1">
            <div className="px-2 py-1 bg-red-100 border border-red-300 rounded">P1</div>
            <span className="text-gray-400">+</span>
            <div className="px-2 py-1 bg-orange-100 border border-orange-300 rounded">P2</div>
            <span className="text-gray-400">+</span>
            <div className="px-2 py-1 bg-purple-100 border border-purple-300 rounded">P3.1</div>
          </div>
          <span className="text-gray-400">→</span>
          <div className="px-2 py-1 bg-green-600 text-white border rounded font-semibold">SSC Score</div>
        </div>
        <div className="flex items-center gap-2 pl-8">
          <div className="px-2 py-1 bg-yellow-500 text-white border rounded font-semibold">Hazard Score (P3.2)</div>
          <span className="text-gray-400">+</span>
          <div className="px-2 py-1 bg-indigo-500 text-white border rounded font-semibold">Vulnerability Score (P3.1)</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-2 py-1 bg-green-600 text-white border rounded font-semibold">SSC Score</div>
          <span className="text-gray-400">+</span>
          <div className="px-2 py-1 bg-yellow-500 text-white border rounded font-semibold">Hazard</div>
          <span className="text-gray-400">+</span>
          <div className="px-2 py-1 bg-indigo-500 text-white border rounded font-semibold">Vulnerability</div>
          <span className="text-gray-400">→</span>
          <div className="px-3 py-1 bg-blue-600 text-white border-2 border-blue-700 rounded font-bold">Overall Score</div>
        </div>
      </div>
    </div>
  );
}
