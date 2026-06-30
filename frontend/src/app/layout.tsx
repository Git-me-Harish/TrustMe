import type { Metadata } from "next";
import "../styles/tokens.css";

export const metadata: Metadata = {
  title: "KYC Platform",
  description: "Identity verification, done properly.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
