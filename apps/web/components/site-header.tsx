"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/rooms", label: "Rooms" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/simulator", label: "Simulator" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="topbar">
      <a className="skip" href="#content">
        Skip to content
      </a>
      <div className="topbar-inner">
        <Link className="brand" href="/">
          <span>HackIoT</span>
          <small>MJHH · USC IEEE</small>
        </Link>
        <nav aria-label="Primary">
          {links.map((link) => {
            const current =
              pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={current ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
