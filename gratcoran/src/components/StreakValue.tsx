"use client";

import { useEffect, useState } from "react";
import { streakDays } from "@/lib/tajweed/history";

/** Série de jours consécutifs, calculée dans le fuseau du téléphone (après montage). */
export function StreakValue({ dates }: { dates: string[] }) {
  const [value, setValue] = useState<number | null>(null);
  useEffect(() => setValue(streakDays(dates)), [dates]);
  if (value === null) return <span className="inline-block h-6 w-6 animate-pulse rounded-md bg-line align-middle" aria-hidden />;
  return <>{value}</>;
}
