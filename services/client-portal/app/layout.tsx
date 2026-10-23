import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import { Navbar } from "@/components/navbar";
import "./globals.css";

const sans = Figtree({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

const title = "KhetiRental v2.0 | Agritech Sharing & Architecture Showcase";
const description =
  "Explore how KhetiRental matches farmers with nearby tractors, prices rentals fairly and protects payments with escrow.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: "website" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body className="min-h-screen overflow-x-hidden font-sans antialiased">
        <Navbar />
        <main id="main">{children}</main>
      </body>
    </html>
  );
}
