import type { Metadata } from "next";
import {
  Instrument_Sans,
  Instrument_Serif,
  JetBrains_Mono,
} from "next/font/google";
import Link from "next/link";
import { SiteHeader } from "../components/site-header";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-instrument",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: {
    default: "HackIoT",
    template: "%s · HackIoT",
  },
  description:
    "Explore occupancy and comfort based heating and cooling. Compare estimated electricity, cost, and CO₂e with a fixed thermostat in an interactive room simulator.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${instrumentSans.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}
      >
        <SiteHeader />
        <main id="content" className="shell">
          {children}
        </main>
        <footer className="colophon">
          <div className="colophon-inner flex flex-col gap-4">
            <nav className="colophon-links" aria-label="Footer">
              <Link href="/rooms">Rooms</Link>
              <Link href="/impact">Impact</Link>
              <Link href="/simulator">Simulator</Link>
              <Link href="/dashboard">Dashboard</Link>
            </nav>
            <p>Not a live HVAC controller.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
