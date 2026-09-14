import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vista",
  description: "Unified TV shows + movies library, indexer, downloader, and request platform",
  icons: {
    icon: [
      { url: "/vista-icon.png", type: "image/png" },
      { url: "/vista-icon.svg", type: "image/svg+xml" },
    ],
    apple: "/vista-icon.png",
    shortcut: "/vista-icon.svg",
  },
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
