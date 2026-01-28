'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Clock, Circle, CheckCircle } from 'lucide-react';

interface Layer {
  id: string;
  name: string;
  layer_type: string;
  order_index: number;
  effect_direction: string;
  weight: number;
  reference_date: string | null;
}

interface Props {
  layers: Layer[];
  selectedLayerId: string | null;
  onSelectLayer: (layerId: string | null) => void;
  showBaseline?: boolean;
}

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  hazard_prediction: { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-800', dot: 'bg-orange-500' },
  hazard_impact: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-800', dot: 'bg-red-500' },
  assessment: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-800', dot: 'bg-blue-500' },
  intervention: { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-800', dot: 'bg-green-500' },
  monitoring: { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-800', dot: 'bg-purple-500' },
};

export default function LayerTimelineNavigation({ 
  layers, 
  selectedLayerId, 
  onSelectLayer,
  showBaseline = true 
}: Props) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check scroll state
  const updateScrollState = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    setCanScrollLeft(container.scrollLeft > 0);
    setCanScrollRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 10);
  };

  useEffect(() => {
    updateScrollState();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', updateScrollState);
      window.addEventListener('resize', updateScrollState);
      return () => {
        container.removeEventListener('scroll', updateScrollState);
        window.removeEventListener('resize', updateScrollState);
      };
    }
  }, [layers]);

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const scrollAmount = 200;
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  const sortedLayers = [...layers].sort((a, b) => a.order_index - b.order_index);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getTypeColors = (type: string) => {
    return TYPE_COLORS[type] || { bg: 'bg-gray-50', border: 'border-gray-300', text: 'text-gray-800', dot: 'bg-gray-500' };
  };

  return (
    <div className="relative">
      {/* Scroll Buttons */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white border rounded-full shadow-md flex items-center justify-center hover:bg-gray-50"
        >
          <ChevronLeft size={18} />
        </button>
      )}
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white border rounded-full shadow-md flex items-center justify-center hover:bg-gray-50"
        >
          <ChevronRight size={18} />
        </button>
      )}

      {/* Timeline Container */}
      <div 
        ref={scrollContainerRef}
        className="overflow-x-auto scrollbar-hide px-8"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <div className="flex items-center gap-2 py-4 min-w-max">
          {/* Baseline Node */}
          {showBaseline && (
            <>
              <button
                onClick={() => onSelectLayer(null)}
                className={`flex flex-col items-center px-4 py-2 rounded-lg border-2 transition-all min-w-[120px] ${
                  selectedLayerId === null
                    ? 'border-green-500 bg-green-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className={`w-4 h-4 rounded-full mb-2 ${
                  selectedLayerId === null ? 'bg-green-500' : 'bg-green-300'
                }`} />
                <span className={`text-sm font-medium ${
                  selectedLayerId === null ? 'text-green-800' : 'text-gray-700'
                }`}>
                  Baseline
                </span>
                <span className="text-xs text-gray-500">Pre-crisis</span>
              </button>

              {/* Connector Line */}
              {sortedLayers.length > 0 && (
                <div className="w-8 h-0.5 bg-gray-300 flex-shrink-0" />
              )}
            </>
          )}

          {/* Layer Nodes */}
          {sortedLayers.map((layer, index) => {
            const colors = getTypeColors(layer.layer_type);
            const isSelected = selectedLayerId === layer.id;

            return (
              <div key={layer.id} className="flex items-center">
                <button
                  onClick={() => onSelectLayer(layer.id)}
                  className={`flex flex-col items-center px-4 py-2 rounded-lg border-2 transition-all min-w-[140px] ${
                    isSelected
                      ? `${colors.border} ${colors.bg} shadow-md`
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  {/* Dot with effect indicator */}
                  <div className="flex items-center gap-1 mb-1">
                    <div className={`w-3 h-3 rounded-full ${isSelected ? colors.dot : 'bg-gray-300'}`} />
                    {layer.effect_direction === 'increase' && (
                      <span className="text-xs text-red-600">↑</span>
                    )}
                    {layer.effect_direction === 'decrease' && (
                      <span className="text-xs text-green-600">↓</span>
                    )}
                  </div>
                  
                  {/* Layer name */}
                  <span className={`text-sm font-medium truncate max-w-[120px] ${
                    isSelected ? colors.text : 'text-gray-700'
                  }`}>
                    {layer.name}
                  </span>
                  
                  {/* Type badge */}
                  <span className={`text-xs px-1.5 py-0.5 rounded mt-1 ${
                    isSelected ? `${colors.bg} ${colors.text}` : 'bg-gray-100 text-gray-600'
                  }`}>
                    {layer.layer_type.replace('_', ' ')}
                  </span>
                  
                  {/* Date */}
                  {layer.reference_date && (
                    <span className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <Clock size={10} />
                      {formatDate(layer.reference_date)}
                    </span>
                  )}
                </button>

                {/* Connector Line */}
                {index < sortedLayers.length - 1 && (
                  <div className="w-8 h-0.5 bg-gray-300 flex-shrink-0" />
                )}
              </div>
            );
          })}

          {/* Empty state */}
          {sortedLayers.length === 0 && showBaseline && (
            <div className="text-sm text-gray-400 italic px-4">
              No layers added yet
            </div>
          )}
        </div>
      </div>

      {/* Timeline Legend */}
      <div className="flex items-center justify-center gap-4 mt-2 text-xs text-gray-500 border-t pt-2">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500" /> Hazard
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-500" /> Assessment
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" /> Intervention
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-purple-500" /> Monitoring
        </span>
      </div>
    </div>
  );
}
