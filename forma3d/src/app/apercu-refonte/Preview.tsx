"use client";

import { useState } from "react";
import { PHONE_STAND } from "@/lib/design/samples";
import { SimpleHome } from "@/components/simple/SimpleHome";
import { SimpleResult } from "@/components/simple/SimpleResult";

/** Aperçu d'une direction : accueil-outil, puis résultat sur la conception d'exemple « support de téléphone ». */
export function Preview({ direction, ecran }: { direction: "neutre" | "colore"; ecran: "accueil" | "resultat" }) {
  const [screen, setScreen] = useState(ecran);
  const [printer, setPrinter] = useState<string | undefined>(undefined);
  return (
    <div data-direction={direction} className="min-h-dvh">
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
        <SimpleResult design={PHONE_STAND} direction={direction} demo printerId={printer} onBack={() => setScreen("accueil")} advancedHref="/studio" />
      )}
    </div>
  );
}
