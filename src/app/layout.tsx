import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Logistics AI Analytics",
  description: "AI-orchestrated logistics analytics dashboard with forecasting and explainability."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
