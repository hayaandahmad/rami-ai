import { Inter } from "next/font/google";
import type { Metadata } from "next";
import { DocumentStoreProvider } from "@/app/providers/DocumentStoreProvider";
import "@/styles/globals.css";
import "@/styles/utilities.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rami — Document Assistant",
  description: "Guided AI document assistant for MODEE Business Development.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">
        <DocumentStoreProvider>{children}</DocumentStoreProvider>
      </body>
    </html>
  );
}
