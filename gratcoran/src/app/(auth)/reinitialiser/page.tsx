"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Field, Logo, Notice, Spinner } from "@/components/ui";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth-errors";

type Status = "checking" | "ready" | "invalid";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Le lien reçu par email contient la session de récupération dans l'URL
  // (#access_token=… en flux implicite, ou ?code=… en flux PKCE).
  useEffect(() => {
    const supabase = getBrowserSupabase();
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const code = new URLSearchParams(window.location.search).get("code");

    async function init() {
      if (hash.get("error")) return setStatus("invalid");
      const access_token = hash.get("access_token");
      const refresh_token = hash.get("refresh_token");
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        window.history.replaceState(null, "", window.location.pathname);
        return setStatus(error ? "invalid" : "ready");
      }
      // ?code=… est échangé automatiquement par le client à son initialisation.
      const { data } = await supabase.auth.getUser();
      if (code) window.history.replaceState(null, "", window.location.pathname);
      setStatus(data.user ? "ready" : "invalid");
    }
    init().catch(() => setStatus("invalid"));
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    setSaving(true);
    setError(null);
    const { error } = await getBrowserSupabase().auth.updateUser({ password });
    setSaving(false);
    if (error) return setError(authErrorMessage(error));
    router.replace("/");
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-col items-center text-center">
        <Logo size={72} />
        <h1 className="mt-5 text-2xl font-bold tracking-tight">Nouveau mot de passe</h1>
      </div>

      {status === "checking" && (
        <div className="mt-10 flex justify-center text-muted">
          <Spinner className="h-6 w-6" />
        </div>
      )}

      {status === "invalid" && (
        <div className="mt-8 space-y-5">
          <Notice tone="error">Ce lien est invalide ou a expiré. Demande un nouveau lien.</Notice>
          <Link
            href="/mot-de-passe-oublie"
            className="flex h-12 items-center justify-center rounded-2xl bg-brand font-semibold text-white"
          >
            Recevoir un nouveau lien
          </Link>
        </div>
      )}

      {status === "ready" && (
        <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
          <Field
            id="password"
            name="password"
            type="password"
            label="Nouveau mot de passe (8 caractères minimum)"
            autoComplete="new-password"
            minLength={8}
            required
          />
          {error && <Notice tone="error">{error}</Notice>}
          <Button type="submit" loading={saving}>
            Enregistrer
          </Button>
        </form>
      )}
    </div>
  );
}
