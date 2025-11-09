"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Helper to normalize Philippine pcodes
const normalizePcode = (p: string | null) => {
  if (!p) return null;
  let code = p.trim().toUpperCase();
  if (!code.startsWith("PH")) code = "PH" + code;
  if (code.length < 13) {
    const prefix = code.slice(0, 2);
    const body = code.slice(2);
    code = prefix + body.padStart(11, "0");
  }
  return code.slice(0, 13);
};

export default function DatasetsPage() {
  const [adminStats, setAdminStats] = useState<any[]>([]);
  const [gisLayers, setGisLayers] = useState<any[]>([]);
  const [population, setPopulation] = useState<any[]>([]);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);

      // Parallel fetch from Supabase
      const [
        { data: adminsData, error: adminErr },
        { data: gis, error: gisErr },
        { data: pop, error: popErr },
        { data: dsets, error: dsErr },
      ] = await Promise.all([
        supabase.from("admin_boundaries").select("admin_level"),
        supabase.from("gis_layers").select("*").order("created_at", { ascending: false }),
        supabase.from("population_data").select("admin_level, source").limit(1),
        supabase.from("datasets").select("*").order("created_at", { ascending: false }),
      ]);

      if (adminErr || gisErr || popErr || dsErr) console.error(adminErr, gisErr, popErr, dsErr);

      // Group admin levels manually
      const groupedAdmins = (adminsData || []).reduce((acc: Record<string, number>, row: any) => {
        acc[row.admin_level] = (acc[row.admin_level] || 0) + 1;
        return acc;
      }, {});
      const adminStatsArr = Object.entries(groupedAdmins).map(([level, count]) => ({
        admin_level: level,
        count,
      }));

      setAdminStats(adminStatsArr);
      setGisLayers(gis || []);
      setPopulation(pop || []);
      setDatasets(dsets || []);
      setLoading(false);
    };

    fetchAll();
  }, []);

  if (loading) return <div className="p-10 text-center text-gray-500">Loading datasets...</div>;

  // Group baseline datasets by SSC categories
  const categories = [
    "SSC Framework - P1",
    "SSC Framework - P2",
    "SSC Framework - P3",
    "Hazard",
    "Underlying Vulnerability",
  ];
  const grouped = categories.map((cat) => ({
    name: cat,
    items: datasets.filter((d) => d.category === cat),
  }));

  return (
    <div className="p-6">
      {/* Breadcrumbs */}
      <nav className="text-sm text-gray-600 mb-6">
        <Link href="/" className="hover:underline">
          Home
        </Link>{" "}
        / <span className="text-gray-800 font-semibold">Datasets</span>
      </nav>

      {/* Page Header */}
      <h1 className="text-2xl font-semibold mb-2">Datasets & Core Spatial Data</h1>
      <p className="text-gray-600 mb-6">
        Explore baseline datasets, core administrative boundaries, population data, and GIS layers used
        across SSC Framework analyses.
      </p>

      {/* CORE DATA */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-3 border-b pb-1">Core Data</h2>

        {/* Administrative Boundaries */}
        <div className="border rounded p-4 mb-4 bg-gray-50">
          <h3 className="font-semibold mb-2">Administrative Boundaries</h3>
          <table className="w-full text-sm border-collapse mb-2">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-1 text-left">Admin Level</th>
                <th className="border p-1 text-right">Count</th>
              </tr>
            </thead>
            <tbody>
              {adminStats.map((row) => (
                <tr key={row.admin_level}>
                  <td className="border p-1">{row.admin_level}</td>
                  <td className="border p-1 text-right">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="text-blue-600 hover:underline text-sm">View Map</button>
        </div>

        {/* Population */}
        <div className="border rounded p-4 mb-4 bg-gray-50">
          <h3 className="font-semibold mb-1">Population</h3>
          {population.length > 0 ? (
            <p className="text-sm text-gray-700">
              Available at <strong>{population[0].admin_level}</strong> level
              <br />
              Source: {population[0].source || "Unknown"}
            </p>
          ) : (
            <p className="text-sm text-gray-500">No population data found.</p>
          )}
        </div>

        {/* GIS Layers */}
        <div className="border rounded p-4 bg-gray-50">
          <h3 className="font-semibold mb-2">GIS Layers</h3>
          {gisLayers.length > 0 ? (
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border p-1 text-left">Name</th>
                  <th className="border p-1 text-left">Type</th>
                  <th className="border p-1 text-left">Source</th>
                  <th className="border p-1 text-left">Join Level</th>
                  <th className="border p-1 text-left">Link</th>
                </tr>
              </thead>
              <tbody>
                {gisLayers.map((l) => (
                  <tr key={l.id}>
                    <td className="border p-1">{l.name}</td>
                    <td className="border p-1">{l.layer_type}</td>
                    <td className="border p-1">{l.source || "-"}</td>
                    <td className="border p-1">
                      {l.layer_type === "vector" ? "ADM3/ADM4 (via pcode)" : "Spatial overlay"}
                    </td>
                    <td className="border p-1">
                      {l.data_url ? (
                        <a
                          href={l.data_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          View
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-500">No GIS layers registered.</p>
          )}
        </div>
      </section>

      {/* BASELINE DATASETS */}
      <section>
        <h2 className="text-xl font-semibold mb-3 border-b pb-1">Baseline Datasets</h2>
        {grouped.map((group) => (
          <div key={group.name} className="border rounded p-4 mb-4 bg-white">
            <h3 className="font-semibold mb-2">{group.name}</h3>
            {group.items.length > 0 ? (
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border p-1 text-left">Name</th>
                    <th className="border p-1 text-left">Admin Level</th>
                    <th className="border p-1 text-left">Type</th>
                    <th className="border p-1 text-left">Join Confidence</th>
                    <th className="border p-1 text-left">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((d) => {
                    const normalized = normalizePcode(d.admin_pcode || "");
                    const joinType =
                      normalized && normalized.length === 13
                        ? "Direct (normalized)"
                        : "Adjusted (zero-padded)";
                    return (
                      <tr key={d.id}>
                        <td className="border p-1">{d.name}</td>
                        <td className="border p-1">{d.admin_level}</td>
                        <td className="border p-1">{d.type}</td>
                        <td className="border p-1">{joinType}</td>
                        <td className="border p-1">
                          {new Date(d.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-gray-500">No datasets found under {group.name}.</p>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
