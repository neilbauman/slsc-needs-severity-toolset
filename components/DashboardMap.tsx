'use client';

import { useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { GeoJSON as GeoJSONType, GeoJsonObject } from 'geojson';
import 'leaflet/dist/leaflet.css';

type DashboardMapProps = {
  featureCollection?: GeoJSONType | null;
  headline?: string;
  description?: string;
};

// Component to auto-fit map bounds to features
function MapBoundsController({ features }: { features: any[] }) {
  const map = useMap();
  
  useEffect(() => {
    if (features.length > 0) {
      try {
        // Filter out Point geometries - they can't be used for bounds
        const validFeatures = features.filter((f: any) => {
          const geomType = f.geometry?.type;
          return geomType && geomType !== 'Point';
        });
        
        if (validFeatures.length > 0) {
          const bounds = L.geoJSON(validFeatures).getBounds();
          // Check if bounds are valid (not infinite or NaN)
          if (bounds.isValid()) {
            map.fitBounds(bounds, { 
              padding: [20, 20],
              maxZoom: 8 // Limit max zoom to keep country in view
            });
          } else {
            console.warn('Invalid bounds calculated from features');
          }
        } else {
          console.warn('No valid polygon features found for map bounds');
        }
      } catch (err) {
        console.error("Error fitting bounds:", err);
      }
    }
  }, [features, map]);

  return null;
}

// Default centers by country (fallback if no features)
const countryCenters: Record<string, [number, number]> = {
  'PHL': [12.8797, 121.774], // Philippines
  'LKA': [7.8731, 80.7718], // Sri Lanka
  'BGD': [23.6850, 90.3563], // Bangladesh
  'MOZ': [-18.6657, 35.5296], // Mozambique
  'PSE': [31.9522, 35.2332], // Palestine
};

const defaultCenter: [number, number] = [12.8797, 121.774]; // Default to Philippines

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

  // Calculate center from features if available, otherwise use default
  const mapCenter = useMemo(() => {
    if (features.length > 0) {
      try {
        const bounds = L.geoJSON(features).getBounds();
        const center = bounds.getCenter();
        return [center.lat, center.lng] as [number, number];
      } catch {
        return defaultCenter;
      }
    }
    return defaultCenter;
  }, [features]);

  const initialZoom = features.length > 0 ? 6 : 5;

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
          center={mapCenter}
          zoom={initialZoom}
          minZoom={3}
          maxZoom={11}
          scrollWheelZoom={false}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {features.length > 0 && (
            <>
              <GeoJSON
                key={features.length}
                data={{
                  type: 'FeatureCollection',
                  // Filter out Point geometries - they won't render as boundaries
                  features: features.filter((f: any) => {
                    const geomType = f.geometry?.type;
                    return geomType && geomType !== 'Point';
                  }),
                } as GeoJsonObject}
                style={() => ({
                  color: '#2563eb',
                  weight: 1,
                  fillColor: '#93c5fd',
                  fillOpacity: 0.12,
                })}
              />
              <MapBoundsController features={features} />
            </>
          )}
        </MapContainer>
      </div>
    </div>
  );
}

