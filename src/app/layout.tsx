import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Uzunguni City Park | Operations",
  description: "Secure staff-entered table bills and QR payment"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
