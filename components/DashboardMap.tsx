'use client';

import { useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import type { GeoJSON as GeoJSONType, GeoJsonObject } from 'geojson';
import 'leaflet/dist/leaflet.css';

type DashboardMapProps = {
  featureCollection?: GeoJSONType | null;
  headline?: string;
  description?: string;
};

const defaultCenter: [number, number] = [12.8797, 121.774]; // Philippines centroid

export default function DashboardMap({
  featureCollection,
  headline,
  description,
}: DashboardMapProps) {
  const features = useMemo(() => {
    if (!featureCollection) return [];
    if (featureCollection.type === 'FeatureCollection') {
      return featureCollection.features ?? [];
    }
    return [featureCollection];
  }, [featureCollection]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="border-b border-gray-100 px-5 py-4">
        <p className="text-xs font-semibold tracking-wider text-amber-600 uppercase mb-1">
          {headline || 'National Coverage'}
        </p>
        <p className="text-sm text-gray-600">
          {description ||
            'Baseline administrative boundaries with overlays for country-wide situational awareness.'}
        </p>
      </div>
      <div className="h-80">
        <MapContainer
          center={defaultCenter}
          zoom={5}
          minZoom={4}
          maxZoom={11}
          scrollWheelZoom={false}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {features.length > 0 && (
            <GeoJSON
              key={features.length}
              data={{
                type: 'FeatureCollection',
                features,
              } as GeoJsonObject}
              style={() => ({
                color: '#2563eb',
                weight: 1,
                fillColor: '#93c5fd',
                fillOpacity: 0.12,
              })}
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}

