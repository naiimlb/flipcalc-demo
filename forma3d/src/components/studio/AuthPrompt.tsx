"use client";

import Link from "next/link";
import { AnimatePresence, m as motion } from "framer-motion";
import { IconX } from "../icons";
import { Portal } from "../Portal";
import { useT } from "../app/Preferences";

/** Invitation à créer un compte (essai utilisé, sauvegarde du résultat…). */
export function AuthPrompt({ message, onClose }: { message: string | null; onClose(): void }) {
  const t = useT();
  return (
    <Portal>
      <AnimatePresence>
        {message && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-night/40 backdrop-blur-sm sm:items-center sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(e) => e.target === e.currentTarget && onClose()}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="auth-prompt-title"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="w-full max-w-md rounded-t-[28px] bg-surface p-6 shadow-card sm:rounded-[28px]"
            >
              <div className="flex items-start justify-between gap-4">
                <h2 id="auth-prompt-title" className="text-xl font-semibold tracking-tight">
                  {t("auth.title")}
                </h2>
                <button type="button" onClick={onClose} className="icon-btn" aria-label={t("menu.close")}>
                  <IconX size={15} />
                </button>
              </div>
              <p className="mt-2 text-sm text-ink-soft">{message}</p>
              <ul className="mt-4 space-y-1.5 text-sm text-ink-soft">
                <li>{t("auth.point1")}</li>
                <li>{t("auth.point2")}</li>
                <li>{t("auth.point3")}</li>
              </ul>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href="/connexion?mode=inscription" className="btn-dark">
                  {t("auth.signup")}
                </Link>
                <Link href="/connexion" className="btn-ghost">
                  {t("auth.login")}
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
