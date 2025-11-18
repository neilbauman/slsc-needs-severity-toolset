import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function ScoreLayerSelector({ instanceId, selected, onSelect }: any) {
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('v_category_scores')
        .select('*')
        .eq('instance_id', instanceId);
      if (!error) setCategories(data || []);
    };
    load();
  }, [instanceId]);

  const ordered = ['SSC Framework - P1', 'SSC Framework - P2', 'SSC Framework - P3', 'Hazard', 'Underlying Vulnerability'];

  return (
    <div className="w-64 bg-white border-l rounded-lg shadow-sm overflow-y-auto p-3 space-y-2">
      <h3 className="font-semibold mb-2">Map Layer</h3>
      <button
        className={`w-full text-left p-1 rounded ${selected === 'overall' ? 'bg-blue-100' : ''}`}
        onClick={() => onSelect('overall', 'overall')}
      >
        Overall Score
      </button>

      {ordered.map(cat => {
        const c = categories.find(x => x.category === cat);
        if (!c) return null;
        const datasets = c.dataset_list?.split(',').map(d => d.trim()) || [];
        return (
          <div key={cat}>
            <button
              className={`block w-full text-left font-medium text-xs mt-2 ${
                selected === cat ? 'bg-blue-100 rounded' : ''
              }`}
              onClick={() => onSelect(cat, 'category')}
            >
              {cat}
            </button>
            {datasets.map(ds => (
              <button
                key={ds}
                className={`block w-full text-left pl-4 p-1 text-xs rounded ${
                  selected === ds ? 'bg-blue-100' : ''
                }`}
                onClick={() => onSelect(ds, 'dataset')}
              >
                {ds}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}
