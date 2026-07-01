import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "../styles/tokens.css";
import "../styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: { default: "KYC Platform", template: "%s — KYC Platform" },
  description:
    "Production-grade identity verification — document OCR, liveness detection, and ArcFace biometric matching backed by an immutable audit trail.",
  robots: { index: false, follow: false }, // private platform
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}