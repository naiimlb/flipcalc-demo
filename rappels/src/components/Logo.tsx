"use client";

import { useState } from "react";

/** Logo : /public/logo.png s'il existe, sinon le placeholder « #HB ». */
export function Logo({ height = 40 }: { height?: number }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        aria-label="Hashtag Bangers"
        className="inline-flex items-center justify-center rounded-xl bg-pink font-extrabold text-white"
        style={{ height, minWidth: height * 1.3, fontSize: height * 0.45 }}
      >
        #HB
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt="Hashtag Bangers"
      style={{ height }}
      className="w-auto object-contain"
      ref={(el) => {
        // L'erreur de chargement peut survenir avant l'hydratation : on revérifie.
        if (el && el.complete && el.naturalWidth === 0) setFailed(true);
      }}
      onError={() => setFailed(true)}
    />
  );
}
