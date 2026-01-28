// app/layout.tsx
import "leaflet/dist/leaflet.css";
import "./globals.css";
import Header from "../components/Header";
import Breadcrumb from "../components/Breadcrumb";
import { AuthProvider } from "../components/AuthProvider";
import { CountryProvider } from "../lib/countryContext";
import { ErrorBoundary } from "../components/ErrorBoundary";
import ChunkErrorHandler from "../components/ChunkErrorHandler";

export const metadata = {
  title: "SLSC Needs Severity Toolset",
  description: "SLSC data and decision support system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-800">
        <ChunkErrorHandler />
        <ErrorBoundary>
          <AuthProvider>
            <CountryProvider>
              {/* Persistent site header (your existing Header component) */}
              <ErrorBoundary>
                <Header />
              </ErrorBoundary>

              {/* Breadcrumb bar */}
              <nav className="bg-gray-100 text-sm py-2 px-6 border-b border-gray-200 shadow-sm">
                <Breadcrumb />
              </nav>

              {/* Main content */}
              <main className="max-w-7xl mx-auto px-6 py-4">
                <ErrorBoundary>
                  {children}
                </ErrorBoundary>
              </main>
            </CountryProvider>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}


