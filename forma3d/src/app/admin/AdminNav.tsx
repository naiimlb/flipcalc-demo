"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Vue d'ensemble" },
  { href: "/admin/apparence", label: "Apparence" },
  { href: "/admin/ia", label: "Prompt IA" },
  { href: "/admin/cles", label: "Clés d'API" },
  { href: "/admin/demandes", label: "Demandes" },
  { href: "/admin/utilisateurs", label: "Utilisateurs" },
  { href: "/admin/fonctionnalites", label: "Fonctionnalités" },
  { href: "/admin/logs", label: "Mode Dev · logs" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Administration" className="flex gap-1 overflow-x-auto scrollbar-none lg:flex-col">
      {LINKS.map((l) => {
        const active = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition ${
              active ? "bg-ink text-white" : "text-ink-soft hover:bg-white hover:text-ink"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
