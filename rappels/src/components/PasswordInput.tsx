"use client";

import { useState } from "react";
import { inputCls } from "./AuthShell";

export function PasswordInput(props: { value: string; onChange: (v: string) => void; autoComplete: "current-password" | "new-password"; label: string; autoFocus?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        autoComplete={props.autoComplete}
        autoFocus={props.autoFocus}
        aria-label={props.label}
        placeholder={props.label}
        maxLength={72}
        className={`${inputCls} pr-24`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-1 top-1/2 min-h-11 -translate-y-1/2 rounded-full px-4 text-sm font-extrabold text-pink-deep"
      >
        {show ? "Cacher" : "Voir"}
      </button>
    </div>
  );
}
