"use client";

import { useState } from "react";
import { PHONE_STAND } from "@/lib/design/samples";
import { SimpleHome } from "@/components/simple/SimpleHome";
import { SimpleResult } from "@/components/simple/SimpleResult";
import { ToastProvider } from "@/components/simple/ui";

/** Aperçu du parcours Simple (direction « clair neutre ») : accueil-outil, puis résultat sur la conception d'exemple « support de téléphone ». */
export function Preview({ ecran }: { ecran: "accueil" | "resultat" }) {
  const [screen, setScreen] = useState(ecran);
  const [printer, setPrinter] = useState<string | undefined>(undefined);
  return (
    <ToastProvider>
    <div className="simple-ui min-h-dvh">
      {screen === "accueil" ? (
        <SimpleHome
          demo
          signedIn={false}
          onSubmit={({ printer: p }) => {
            setPrinter(p);
            setScreen("resultat");
          }}
        />
      ) : (
        <SimpleResult design={PHONE_STAND} demo printerId={printer} onBack={() => setScreen("accueil")} onAdvanced={() => window.location.assign("/studio")} />
      )}
    </div>
    </ToastProvider>
  );
}
