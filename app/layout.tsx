// app/layout.tsx
import './globals.css'; // optional if you have Tailwind or global styles

export const metadata = {
  title: 'Philippines SSC Toolset',
  description: 'Simple working app to verify deployment',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
