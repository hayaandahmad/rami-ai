import { Inter } from "next/font/google";
import type { Metadata } from "next";
import { DocumentStoreProvider } from "@/app/providers/DocumentStoreProvider";
import { RamiEngineControl } from "@/components/ai/RamiEngineControl";
import "@/styles/globals.css";
import "@/styles/utilities.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rami — AI Document Assistant",
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
        <DocumentStoreProvider>
          {children}
          <RamiEngineControl />
        </DocumentStoreProvider>
      </body>
    </html>
  );
}
