import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
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
