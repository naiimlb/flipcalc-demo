import type { ReactNode } from "react";
import { Logo } from "./Logo";

export function Header({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <header className="mb-5">
      <div className="mb-4 flex items-center justify-between">
        <Logo />
        {right}
      </div>
      <h1 className="h-street text-[2.1rem] text-ink">{title}</h1>
    </header>
  );
}
