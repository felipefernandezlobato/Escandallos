import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Escandallos",
  description: "Gestión de costes de recetas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geistSans.variable} h-full`}>
      <body className="min-h-full flex font-sans">
        <Sidebar />
        <main className="flex-1 md:ml-56 pb-20 md:pb-0">
          <div className="max-w-6xl mx-auto px-4 py-6">{children}</div>
        </main>
        <MobileNav />
      </body>
    </html>
  );
}
