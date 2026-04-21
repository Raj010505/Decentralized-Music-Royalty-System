"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import WalletConnect from "./WalletConnect";

const navItems = [
  { href: "/", label: "Overview" },
  { href: "/register", label: "Register" },
  { href: "/stream", label: "Stream Sim" },
  { href: "/auctions", label: "Auctions" },
  { href: "/my-rights", label: "My Rights" },
  { href: "/history", label: "History" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="app-shell">
      <div className="bg-orb orb-left" />
      <div className="bg-orb orb-right" />

      <header className="app-header">
        <div className="brand-wrap">
          <p className="eyebrow">Music Royalty & Auction System</p>
          <h1 className="brand-title">ChainBeats Studio</h1>
          <p className="muted">Local-first dApp for rights, royalties, and auctions.</p>
        </div>

        <WalletConnect />
      </header>

      <nav className="nav-strip">
        {navItems.map((item) => {
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={active ? "nav-link nav-link-active" : "nav-link"}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <main className="main-content page-enter">{children}</main>
    </div>
  );
}
