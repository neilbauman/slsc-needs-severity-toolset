import "./globals.css";

export const metadata = {
  title: "Philippines Shelter Severity Toolset (sandbox)",
  description: "A dashboard to manage and score datasets for the SSC toolset.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}