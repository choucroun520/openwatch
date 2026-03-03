import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "OpenWatch — Dealer Network",
  description:
    "Invite-only luxury watch dealer network. Real-time inventory, analytics, and deal flow.",
  keywords: ["luxury watches", "watch dealer", "Rolex", "Patek Philippe", "watch market"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} antialiased`} style={{ fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
