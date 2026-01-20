'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { useCountry } from '@/lib/countryContext';
import { getAdminLevelName } from '@/lib/adminLevelNames';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Props {
  instance: any;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

// Component to handle map bounds and auto-zoom
function MapBoundsController({ features }: { features: any[] }) {
  const map = useMap();
  
  useEffect(() => {
    if (features && features.length > 0) {
      try {
        const bounds = L.geoJSON(features).getBounds();
        map.fitBounds(bounds, { 
          padding: [20, 20],
          maxZoom: 10
        });
      } catch (err) {
        console.error("Error fitting bounds:", err);
      }
    }
  }, [features, map]);

  return null;
}

export default function DefineAffectedAreaModal({ instance, onClose, onSaved }: Props) {
  const supabase = createClient();
  const { adminLevels } = useCountry();

  const [adm1Options, setAdm1Options] = useState<any[]>([]);
  const [adm2Options, setAdm2Options] = useState<any[]>([]);
  const [adm3GeoJSON, setAdm3GeoJSON] = useState<any>(null);

  const [selectedAdm1, setSelectedAdm1] = useState<string[]>([]);
  const [selectedAdm2, setSelectedAdm2] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [manuallyDeselected, setManuallyDeselected] = useState<Set<string>>(new Set());
  // Use ref to track manuallyDeselected so we can read it synchronously in loadAdm2
  const manuallyDeselectedRef = useRef<Set<string>>(new Set());
  
  // Keep ref in sync with state
  useEffect(() => {
    manuallyDeselectedRef.current = manuallyDeselected;
  }, [manuallyDeselected]);

  // --------------------------------------------------
  // Load ADM1 regions (top level)
  // --------------------------------------------------
  useEffect(() => {
    loadAdm1();
  }, []);

  const loadAdm1 = async () => {
    const { data, error } = await supabase
      .from('admin_boundaries')
      .select('admin_pcode, name')
      .eq('admin_level', 'ADM1')
      .order('name');

    if (!error && data) setAdm1Options(data);
    else console.error('ADM1 load error:', error);
  };

  // --------------------------------------------------
  // When ADM1 selection changes → load its ADM2s
  // --------------------------------------------------
  useEffect(() => {
    if (selectedAdm1.length > 0) {
      loadAdm2();
    } else {
      setAdm2Options([]);
      setSelectedAdm2([]);
      setAdm3GeoJSON(null);
      setManuallyDeselected(new Set());
      manuallyDeselectedRef.current = new Set();
    }
  }, [selectedAdm1]);

  const loadAdm2 = async () => {
    // If all ADM1s are selected, load all ADM2s (no parent filter)
    // Otherwise, filter by selected ADM1s
    let query = supabase
      .from('admin_boundaries')
      .select('admin_pcode, name, parent_pcode')
      .eq('admin_level', 'ADM2');
    
    // Only filter by parent_pcode if not all ADM1s are selected
    if (selectedAdm1.length > 0 && selectedAdm1.length < adm1Options.length) {
      // Not all ADM1s selected, filter by selected ones
      query = query.in('parent_pcode', selectedAdm1);
    }
    // If all ADM1s are selected, don't filter by parent_pcode - get all ADM2s
    // This ensures we get all locations even when selecting the whole country

    const { data, error } = await query.order('parent_pcode, name');

    if (!error && data) {
      setAdm2Options(data);

      // Compute cleaned manuallyDeselected synchronously using current state
      // We'll read the current state and compute the cleaned value
      setManuallyDeselected((prevDeselected) => {
        const cleaned = new Set<string>();
        prevDeselected.forEach((code) => {
          if (data.some((opt) => opt.admin_pcode === code)) {
            cleaned.add(code);
          }
        });
        // Update ref synchronously before the next state update
        manuallyDeselectedRef.current = cleaned;
        return cleaned;
      });

      // Update selectedAdm2: preserve existing selections, add new ones, remove invalid ones
      setSelectedAdm2((prevSelected) => {
        const prevSet = new Set(prevSelected);
        const dataSet = new Set(data.map((opt) => opt.admin_pcode));
        const currentDeselected = manuallyDeselectedRef.current;
        const newSelected = new Set<string>();
        
        // Build a map of ADM2 -> parent ADM1 from the new data
        const adm2ToParent = new Map<string, string>();
        data.forEach((opt) => {
          adm2ToParent.set(opt.admin_pcode, opt.parent_pcode);
        });
        
        // Also check previous adm2Options to get parent info for ADM2s not in new data
        adm2Options.forEach((opt) => {
          if (!adm2ToParent.has(opt.admin_pcode)) {
            adm2ToParent.set(opt.admin_pcode, opt.parent_pcode);
          }
        });
        
        // CRITICAL: Preserve ALL existing selections that:
        // 1. Are in the new data (and not manually deselected), OR
        // 2. Their parent ADM1 is still selected (even if not in query results - query might have issues)
        prevSet.forEach((code) => {
          const parentAdm1 = adm2ToParent.get(code);
          const parentStillSelected = parentAdm1 && selectedAdm1.includes(parentAdm1);
          
          if (dataSet.has(code)) {
            // ADM2 is in new data - preserve if not manually deselected
            if (!currentDeselected.has(code)) {
              newSelected.add(code);
            }
          } else if (parentStillSelected) {
            // ADM2 is NOT in new data, but its parent ADM1 is still selected
            // This suggests a query issue - preserve it anyway (unless manually deselected)
            if (!currentDeselected.has(code)) {
              newSelected.add(code);
              console.warn(`Preserving ADM2 ${code} (parent ${parentAdm1} still selected but not in query results)`);
            }
          }
          // If parent ADM1 is not selected, don't preserve (it was legitimately removed)
        });
        
        // Add new ADM2s that weren't previously selected (unless manually deselected)
        data.forEach((opt) => {
          if (!prevSet.has(opt.admin_pcode) && !currentDeselected.has(opt.admin_pcode)) {
            newSelected.add(opt.admin_pcode);
          }
        });
        
        return Array.from(newSelected);
      });
    } else {
      console.error('ADM2 load error:', error);
    }
  };

  // --------------------------------------------------
  // Load ADM3 polygons for preview
  // --------------------------------------------------
  useEffect(() => {
    if (selectedAdm2.length > 0) {
      loadAdm3();
    } else {
      setAdm3GeoJSON(null);
    }
  }, [selectedAdm2]);

  const loadAdm3 = async () => {
    setLoading(true);
    
    try {
      console.log(`Loading ADM3 for ${selectedAdm2.length} ADM2 areas...`);
      
      // Fetch in chunks to avoid timeouts and memory issues
      const CHUNK_SIZE = 2000; // Fetch 2000 features at a time
      let allFeatures: any[] = [];
      let offset = 0;
      let totalCount: number | null = null;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase.rpc('get_affected_adm3', {
          in_scope: selectedAdm2,
          in_limit: CHUNK_SIZE,
          in_offset: offset,
        });

        if (error) {
          console.error('ADM3 load error:', error);
          setAdm3GeoJSON(null);
          setLoading(false);
          return;
        }

        if (!data || data.length === 0) {
          hasMore = false;
          break;
        }

        // Get total count from first response
        if (totalCount === null && data.length > 0) {
          totalCount = data[0].total_count || data.length;
          console.log(`Total ADM3 features available: ${totalCount}`);
        }

        // Filter out any features with null/invalid geometry
        const validFeatures = data
          .filter((row: any) => row.geom && row.geom !== null)
          .map((row: any) => ({
            type: 'Feature' as const,
            properties: { name: row.name, admin_pcode: row.admin_pcode },
            geometry: row.geom,
          }));

        allFeatures = allFeatures.concat(validFeatures);
        console.log(`Fetched chunk: ${validFeatures.length} valid features (offset: ${offset}, total so far: ${allFeatures.length}, raw data length: ${data.length})`);

        // Check if we've fetched all data
        // Primary check: have we reached the total count?
        if (totalCount !== null && allFeatures.length >= totalCount) {
          console.log(`✓ Reached total count: ${allFeatures.length} >= ${totalCount}`);
          hasMore = false;
        } 
        // If we got 0 rows, we're definitely done
        else if (data.length === 0) {
          console.log(`✓ Got 0 rows, stopping`);
          hasMore = false;
        }
        // If we have a totalCount and haven't reached it, continue fetching
        // (Even if we got fewer rows than requested - might be a limit issue)
        else if (totalCount !== null && allFeatures.length < totalCount) {
          offset += data.length; // Use raw data.length for offset (RPC paginates by raw rows)
          console.log(`→ Continuing: ${allFeatures.length} < ${totalCount}, next offset=${offset}`);
        }
        // If we got a full chunk, continue (there might be more)
        else if (data.length >= CHUNK_SIZE) {
          offset += data.length;
          console.log(`→ Got full chunk (${data.length}), continuing, next offset=${offset}`);
        }
        // Otherwise, we got fewer rows than requested and no totalCount - assume we're done
        else {
          console.log(`✓ Got fewer rows than requested (${data.length} < ${CHUNK_SIZE}) and no totalCount, stopping`);
          hasMore = false;
        }
      }

      console.log(`Total valid features loaded: ${allFeatures.length}`);

      if (allFeatures.length === 0) {
        console.warn('No valid ADM3 features after loading');
        setAdm3GeoJSON(null);
        setLoading(false);
        return;
      }

      setAdm3GeoJSON({
        type: 'FeatureCollection',
        features: allFeatures,
      });

      setLoading(false);
    } catch (err) {
      console.error('Unexpected error loading ADM3:', err);
      setAdm3GeoJSON(null);
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // NEW: Preload saved scope (ADM2s) + infer ADM1s
  // --------------------------------------------------
  useEffect(() => {
    if (!instance?.admin_scope || instance.admin_scope.length === 0) return;

    const loadExisting = async () => {
      const { data, error } = await supabase
        .from('admin_boundaries')
        .select('admin_pcode, parent_pcode')
        .in('admin_pcode', instance.admin_scope);

      if (!error && data?.length) {
        const adm2s = data.map((d) => d.admin_pcode);
        const adm1s = [...new Set(data.map((d) => d.parent_pcode))];
        setSelectedAdm2(adm2s);
        setSelectedAdm1(adm1s);
      } else if (error) {
        console.error('Failed to preload affected area:', error);
      }
    };

    loadExisting();
  }, [instance]);

  // --------------------------------------------------
  // Save only ADM2 selections
  // --------------------------------------------------
  const handleSave = async () => {
    const admin_scope = selectedAdm2;

    if (admin_scope.length === 0) {
      alert('Please select at least one ADM2 area before saving.');
      return;
    }

    const { error } = await supabase
      .from('instances')
      .update({ admin_scope })
      .eq('id', instance.id);

    if (error) {
      console.error('Failed to save affected area:', error);
      return;
    }

    await onSaved();
    onClose();
  };

  // --------------------------------------------------
  // Map style
  // --------------------------------------------------
  const style = {
    color: '#1d4ed8',
    weight: 1,
    fillColor: '#60a5fa',
    fillOpacity: 0.5,
  };

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-lg w-full max-w-4xl p-4 shadow-xl my-auto">
        <h2 className="text-lg font-semibold mb-4">Define Affected Area</h2>

        {/* Step 1: ADM1 selection */}
        <div className="mb-4">
          <div className="font-medium mb-2">
            Step 1: Select {getAdminLevelName(adminLevels, 1, true)} (Level 1)
          </div>
          <div className="grid grid-cols-3 gap-1 text-sm">
            {adm1Options.map((opt) => (
              <label key={opt.admin_pcode} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedAdm1.includes(opt.admin_pcode)}
                  onChange={(e) => {
                    setSelectedAdm1((prev) => {
                      if (e.target.checked) {
                        return [...prev, opt.admin_pcode];
                      }
                      return prev.filter((x) => x !== opt.admin_pcode);
                    });
                  }}
                />
                {opt.name}
              </label>
            ))}
          </div>
        </div>

        {/* Step 2: ADM2 refinement - organized by ADM1 */}
        {adm2Options.length > 0 && (
          <div className="mb-4">
            <div className="font-medium mb-2">
              Step 2: Select {getAdminLevelName(adminLevels, 2, true)} (Level 2)
            </div>
            <div className="border rounded p-3 max-h-96 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              {(() => {
                // Group ADM2s by their parent ADM1
                const groupedByAdm1 = adm2Options.reduce((acc, opt) => {
                  const parentCode = opt.parent_pcode || 'Unknown';
                  if (!acc[parentCode]) {
                    acc[parentCode] = [];
                  }
                  acc[parentCode].push(opt);
                  return acc;
                }, {} as Record<string, typeof adm2Options>);

                // Get ADM1 names for display
                const adm1Map = new Map(adm1Options.map(a => [a.admin_pcode, a.name]));

                return Object.entries(groupedByAdm1)
                  .sort(([codeA], [codeB]) => {
                    const nameA = adm1Map.get(codeA) || codeA;
                    const nameB = adm1Map.get(codeB) || codeB;
                    return nameA.localeCompare(nameB);
                  })
                  .map(([parentCode, adm2s]) => {
                    const adm1Name = adm1Map.get(parentCode) || parentCode;
                    const adm2List = adm2s as typeof adm2Options;
                    return (
                      <div key={parentCode} className="mb-4 last:mb-0">
                        <div className="font-semibold text-sm text-gray-700 mb-2 sticky top-0 bg-white py-1 z-10">
                          {adm1Name}
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-sm ml-4">
                          {adm2List
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((opt) => (
                              <label key={opt.admin_pcode} className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={selectedAdm2.includes(opt.admin_pcode)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedAdm2((prev) => [...prev, opt.admin_pcode]);
                        setManuallyDeselected((prev) => {
                          const next = new Set(prev);
                          next.delete(opt.admin_pcode);
                          manuallyDeselectedRef.current = next; // Update ref
                          return next;
                        });
                      } else {
                        setSelectedAdm2((prev) => prev.filter((x) => x !== opt.admin_pcode));
                        setManuallyDeselected((prev) => {
                          const next = new Set(prev);
                          next.add(opt.admin_pcode);
                          manuallyDeselectedRef.current = next; // Update ref
                          return next;
                        });
                      }
                    }}
                                />
                                {opt.name}
                              </label>
                            ))}
                        </div>
                      </div>
                    );
                  });
              })()}
            </div>
          </div>
        )}

        {/* Step 3: Map preview */}
        <div className="rounded overflow-hidden border" style={{ height: 400 }}>
          {loading ? (
            <div className="p-4 text-sm text-gray-500">Loading map...</div>
          ) : adm3GeoJSON ? (
            <MapContainer
              style={{ height: '100%', width: '100%' }}
              center={[10.3157, 123.8854]}
              zoom={8}
              scrollWheelZoom={false}
              dragging={false}
              touchZoom={false}
              doubleClickZoom={false}
              boxZoom={false}
              keyboard={false}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />
              <MapBoundsController features={adm3GeoJSON.features || []} />
              <GeoJSON data={adm3GeoJSON} style={() => style} />
            </MapContainer>
          ) : (
            <div className="p-4 text-sm text-gray-500">Select a region to begin.</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 mt-4">
          <button
            className="px-3 py-1 border rounded hover:bg-gray-100"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={handleSave}
          >
            Save Affected Area
          </button>
        </div>
      </div>
    </div>
  );
}
