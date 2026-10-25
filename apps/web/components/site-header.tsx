"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const links = [
  { href: "/rooms", label: "Rooms" },
  { href: "/vote", label: "Vote" },
  { href: "/impact", label: "Impact" },
  { href: "/simulator", label: "Simulator" },
  { href: "/dashboard", label: "Dashboard" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className={`site-header${scrolled ? " is-scrolled" : ""}`}>
      <a className="skip" href="#content">
        Skip to content
      </a>
      <div className={`site-nav${scrolled || open ? " is-panel" : ""}`}>
        <div className="site-nav-bar">
          <Link className="brand" href="/">
            MJHH
          </Link>
          <nav className="site-links" aria-label="Primary">
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
          <button
            type="button"
            className="menu-toggle"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            <span />
            <span />
          </button>
        </div>
      </div>
      {open ? (
        <div className="mobile-menu">
          <nav aria-label="Mobile">
            {links.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
