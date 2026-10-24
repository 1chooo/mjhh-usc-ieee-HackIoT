import type { Metadata } from "next";
import localFont from "next/font/local";
import { SiteHeader } from "../components/site-header";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: {
    default: "HackIoT",
    template: "%s · HackIoT",
  },
  description:
    "Simulate library and classroom temperature, collect hot or cold votes, and compare the energy with a fixed setpoint.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <SiteHeader />
        <main id="content" className="wrap">
          {children}
        </main>
        <footer className="colophon">
          <p className="colophon-inner">
            Simulated rooms for MJHH · USC IEEE HackIoT. This is not a live HVAC
            controller.
          </p>
        </footer>
      </body>
    </html>
  );
}
