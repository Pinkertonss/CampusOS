import type { Metadata } from "next";
import "./globals.css";
import Navigation from "../components/Navigation";

export const metadata: Metadata = {
  title: "CampusOS - Thapar Institute of Engineering & Technology",
  description: "One personalized platform that fixes fragmented campus information for TIET students.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased bg-slate-950 text-slate-100">
      <body className="min-h-full flex flex-row">
        <Navigation />
        <main className="flex-1 min-h-screen overflow-y-auto bg-slate-950 text-slate-100 p-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </body>
    </html>
  );
}
