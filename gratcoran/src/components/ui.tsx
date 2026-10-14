"use client";

import Image from "next/image";
import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from "react";

export function Logo({ size = 88 }: { size?: number }) {
  return (
    <Image
      src="/logo.svg"
      alt="Logo Grat'Coran"
      width={size}
      height={size}
      priority
      unoptimized
      className="drop-shadow-[0_12px_30px_rgba(13,159,154,0.35)]"
    />
  );
}

type ButtonProps = HTMLMotionProps<"button"> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  children: ReactNode;
};

const VARIANTS = {
  primary: "bg-brand text-white shadow-lg shadow-emerald/20",
  secondary: "bg-surface text-ink border border-line",
  ghost: "bg-transparent text-ink",
  danger: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

export function Button({ variant = "primary", loading, className = "", children, disabled, ...rest }: ButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      disabled={disabled || loading}
      className={`relative flex h-12 w-full select-none items-center justify-center gap-2 rounded-2xl px-5 text-[16px] font-semibold transition-opacity disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {loading ? <Spinner /> : children}
    </motion.button>
  );
}

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
    />
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string };

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, type, id, ...rest },
  ref,
) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      <span className="relative block">
        <input
          ref={ref}
          id={id}
          type={isPassword && visible ? "text" : type}
          className="h-12 w-full rounded-2xl border border-line bg-surface px-4 text-[16px] text-ink outline-none transition focus:border-emerald focus:ring-4 focus:ring-emerald/15"
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute inset-y-0 right-1 my-1 rounded-xl px-3 text-sm font-medium text-muted active:bg-line/60"
            aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          >
            {visible ? "Masquer" : "Afficher"}
          </button>
        )}
      </span>
    </label>
  );
});

export function Notice({ tone, children }: { tone: "error" | "info"; children: ReactNode }) {
  return (
    <motion.p
      role={tone === "error" ? "alert" : "status"}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl px-4 py-3 text-sm leading-snug ${
        tone === "error"
          ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
          : "bg-emerald/10 text-emerald-deep dark:text-emerald"
      }`}
    >
      {children}
    </motion.p>
  );
}
