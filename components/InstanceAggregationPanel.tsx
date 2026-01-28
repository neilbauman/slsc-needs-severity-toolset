'use client';

interface Props {
  onAdjustScoring: () => void;
  disabled?: boolean;
}

export default function InstanceAggregationPanel({ onAdjustScoring, disabled }: Props) {
  return (
    <div className="border border-teal-200 rounded-lg overflow-hidden bg-white mb-4">
      <div className="bg-teal-50 px-4 py-2.5 border-b border-teal-200">
        <h4 className="font-semibold text-teal-900">Pillar & overall aggregation</h4>
        <p className="text-xs text-teal-700 mt-0.5">
          How P1/P2/P3 combine into SSC Framework, and how SSC Framework + Hazard + Underlying Vuln combine into Overall (used when computing instance scores).
        </p>
      </div>
      <div className="p-4 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Configure pillar rollup (e.g. Average, Worst Case, Decision Tree) and overall rollup (SSC + Hazard + UV → Overall).
        </p>
        <button
          type="button"
          onClick={onAdjustScoring}
          disabled={disabled}
          className="btn btn-primary text-sm py-2 px-4 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Adjust framework & overall scoring
        </button>
      </div>
    </div>
  );
}
