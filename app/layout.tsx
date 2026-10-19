import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Z R Engineering & Construction Group Inc.",
  description: "Commercial architectural design, engineering drawings and construction services.",
  icons: { icon: "/assets/zr-logo.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
