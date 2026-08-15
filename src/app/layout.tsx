import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Uzunguni | Secure Table Payment",
  description: "Uzunguni City Park payment demonstration"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
