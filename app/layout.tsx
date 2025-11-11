import "leaflet/dist/leaflet.css";
import "./globals.css";
import Header from "../components/Header";

export const metadata = {
  title: "Smart Safe Communities Toolset",
  description: "Philippines SSC data and decision support system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-800">
        <Header />
        <main className="max-w-7xl mx-auto px-6 py-4">{children}</main>
      </body>
    </html>
  );
}
