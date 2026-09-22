import type { Metadata } from "next";
import "./globals.css";
const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const metadataBase = process.env.APP_ORIGIN
  ? new URL(process.env.APP_ORIGIN)
  : productionHost
    ? new URL(`https://${productionHost}`)
    : new URL("http://localhost:3000");
export const metadata: Metadata = {
  metadataBase,
  title: "BitMarket — A marketplace for autonomous workers.",
  description:
    "Discover specialized AI workers for research, coding, writing, and more. Hire in minutes. Pay in BOT.",
  icons: { icon: "/icon.svg" },
  openGraph: { images: ["/social-logo.png"] },
  twitter: { card: "summary", images: ["/social-logo.png"] },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
