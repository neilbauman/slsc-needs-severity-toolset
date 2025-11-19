"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import dynamic from "next/dynamic";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ScoreLayerSelector from "@/components/ScoreLayerSelector";
import NumericScoringModal from "@/components/NumericScoringModal";

const MapContainer = dynamic(() => import("react-leaflet").then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then(m => m.TileLayer), { ssr: false });
const GeoJSON = dynamic(() => import("react-leaflet").then(m => m.GeoJSON), { ssr: false });
const Tooltip = dynamic(() => import("react-leaflet").then(m => m.Tooltip), { ssr: false });

export default function InstancePage({ params }: { params: { id: string } }) {
  const [summary, setSummary] = useState<any>(null);
  const [geojson, setGeojson] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDataset, setSelectedDataset] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    loadSummary();
    loadGeojson();
  }, [params.id, selectedDataset]);

  const loadSummary = async () => {
    const { data, error } = await supabase
      .from("v_instance_affected_summary")
      .select("total_population, people_concern, people_need, avg_score")
      .eq("instance_id", params.id)
      .single();
    if (!error) setSummary(data);
  };

  const loadGeojson = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("v_instance_admin_scores_geojson")
      .select("geojson, score, dataset_name, category, adm3_name")
      .eq("instance_id", params.id);
    if (!error) setGeojson(data || []);
    setLoading(false);
  };

  const getColor = (score: number) => {
    if (score >= 4.5) return "#d73027";
    if (score >= 3.5) return "#fc8d59";
    if (score >= 2.5) return "#fee08b";
    if (score >= 1.5) return "#d9ef8b";
    return "#1a9850";
  };

  const onEachFeature = (feature: any, layer: any) => {
    const s = feature.properties.score;
    const name = feature.properties.adm3_name;
    const dataset = feature.properties.dataset_name;
    const category = feature.properties.category;
    layer.setStyle({
      color: "#555",
      weight: 0.8,
      fillOpacity: 0.8,
      fillColor: getColor(s),
    });
    layer.bindTooltip(
      `<div><b>${name}</b><br/>Score: ${s.toFixed(2)}<br/>${category} / ${dataset}</div>`
    );
  };

  return (
    <div className="flex flex-col h-screen w-full">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-3 p-4 bg-white shadow z-10">
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-xs text-gray-500">Total Population</div>
            <div className="text-lg font-semibold">{summary?.total_population?.toLocaleString() || "-"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-xs text-gray-500">People Concerned</div>
            <div className="text-lg font-semibold">{summary?.people_concern?.toLocaleString() || "-"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-xs text-gray-500">People in Need</div>
            <div className="text-lg font-semibold text-red-600">{summary?.people_need?.toLocaleString() || "-"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-xs text-gray-500">Average Score</div>
            <div className="text-lg font-semibold text-blue-600">{summary?.avg_score?.toFixed(2) || "-"}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Side Map */}
        <div className="flex-1 relative">
          <MapContainer
            center={[12.8797, 121.774]} // Center of PH
            zoom={6}
            style={{ height: "100%", width: "100%" }}
            whenReady={(map) => (mapRef.current = map.target)}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {!loading && geojson.map((g, i) => (
              <GeoJSON
                key={i}
                data={g.geojson}
                onEachFeature={onEachFeature}
              />
            ))}
          </MapContainer>

          {/* Legend */}
          <div className="absolute bottom-4 right-4 bg-white bg-opacity-90 rounded shadow p-2 text-xs">
            <div className="font-semibold mb-1">Score Legend</div>
            {[5, 4, 3, 2, 1].map((v) => (
              <div key={v} className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: getColor(v) }}></div>
                <span>{v}</span>
              </div>
            ))}
          </div>

          {/* Buttons */}
          <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
            <Button variant="outline" className="bg-white" onClick={() => alert("Define Affected Area")}>Define Affected Area</Button>
            <Button variant="outline" className="bg-white" onClick={() => alert("Configure Datasets")}>Configure Datasets</Button>
            <Button variant="outline" className="bg-white" onClick={() => setShowModal(true)}>Calibrate Scores</Button>
            <Button variant="outline" className="bg-white" onClick={loadGeojson}>Recompute Scores</Button>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-80 bg-gray-50 border-l overflow-y-auto p-4">
          <h3 className="font-semibold text-gray-800 mb-2">Score Layers</h3>
          <ScoreLayerSelector instanceId={params.id} onSelect={setSelectedDataset} />
        </div>
      </div>

      {showModal && selectedDataset && (
        <NumericScoringModal
          dataset={selectedDataset}
          instance={{ id: params.id }}
          onClose={() => setShowModal(false)}
          onSaved={loadGeojson}
        />
      )}
    </div>
  );
}
