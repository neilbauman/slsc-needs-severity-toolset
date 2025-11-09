"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PAGE_TITLES } from "@/lib/pageConfig";

export default function Header() {
  const pathname = usePathname();
  const current = PAGE_TITLES[pathname] || {
    title: "Smart Safe Communities",
    subtitle: "Data and Decision Support Toolset",
  };

  return (
    <header className="bg-white border-b shadow-sm mb-6">
      <div className="mx-auto max-w-7xl px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">{current.title}</h1>
          {current.subtitle && (
            <p className="text-sm text-gray-500 mt-1">{current.subtitle}</p>
          )}
        </div>

        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mt-3 sm:mt-0">
          <Link href="/" className="hover:underline text-gray-600">
            Home
          </Link>
          {pathname !== "/" && (
            <>
              {" "}
              / <span className="text-gray-800 font-medium">
                {pathname.replace("/", "")}
              </span>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
