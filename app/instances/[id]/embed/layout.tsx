// Layout for embed route - no header or breadcrumb for clean iframe embedding
import "leaflet/dist/leaflet.css";
import "../../../globals.css";

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, backgroundColor: '#f9fafb' }}>
        <div style={{ padding: '8px' }}>
          {children}
        </div>
      </body>
    </html>
  );
}

