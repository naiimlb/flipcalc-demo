import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssistantContext } from "@/lib/assistant-types";

const streamChat = vi.fn();
vi.mock("@/server/ai/provider", async () => {
  class ProviderError extends Error {
    constructor(
      readonly kind: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { ProviderError, streamChat, isProviderConfigured: () => true };
});

const { executeTool } = await import("@/server/ai/tools");
const { parseRequest, maskPersonalData } = await import("@/server/ai/sanitize");
const { checkRateLimit } = await import("@/server/ai/rate-limit");
const { POST } = await import("@/app/api/assistant/route");
const { ProviderError } = await import("@/server/ai/provider");

const ctx: AssistantContext = {
  maintenant: "22:47",
  phase: "service",
  service_du: "lundi 23 novembre",
  tva: 10,
  taches: [
    { titre: "Ouvrir la caisse", heure: "19:00", categorie: "Caisse", faite: true, en_retard: false, apres_minuit: false },
    { titre: "Réappro sauces", heure: "21:00", categorie: "Stock", faite: false, en_retard: true, apres_minuit: false },
    { titre: "Clôture caisse", heure: "02:30", categorie: "Caisse", faite: false, en_retard: false, apres_minuit: true },
  ],
};
const run = (name: string, args: unknown) => executeTool(name, JSON.stringify(args), ctx);

describe("outils", () => {
  it("compter_caisse : détail par coupure + écart", () => {
    const { result } = run("compter_caisse", { lignes: [{ valeur: 20, quantite: 3 }, { valeur: 0.5, quantite: 4 }], montant_attendu: 70 });
    expect(result).toMatchObject({ lignes: ["3 × 20 € = 60,00 €", "4 × 0,50 € = 2,00 €"], total: "62,00 €", ecart: "Manque de 8,00 €." });
  });

  it("compter_caisse : refuse une coupure inventée", () => {
    expect(run("compter_caisse", { lignes: [{ valeur: 3, quantite: 1 }] }).result).toHaveProperty("erreur");
  });

  it("calculer_ecart : attendu = ticket Z + fond", () => {
    const { result } = run("calculer_ecart", { montant_compte: 350.5, ticket_z_especes: 200, fond_de_caisse: 150 });
    expect(result).toMatchObject({ ecart: "Excédent de 0,50 €.", type: "excédent" });
  });

  it("calculer_tva : taux par défaut du contexte, puis taux explicite", () => {
    expect(run("calculer_tva", { montant: 11, type: "TTC" }).result).toMatchObject({ ht: "10,00 €", tva: "1,00 €", ttc: "11,00 €", taux: "10 %" });
    expect(run("calculer_tva", { montant: 100, type: "HT", taux: 20 }).result).toMatchObject({ ttc: "120,00 €", tva: "20,00 €" });
  });

  it("rendre_monnaie", () => {
    expect(run("rendre_monnaie", { montant_du: 12.7, montant_donne: 20 }).result).toMatchObject({
      a_rendre: "7,30 €",
      en_billets_et_pieces: ["1 × 5 €", "1 × 2 €", "1 × 0,20 €", "1 × 0,10 €"],
    });
    expect(run("rendre_monnaie", { montant_du: 20, montant_donne: 15 }).result).toHaveProperty("erreur");
  });

  it("total commande, pourcentage, partage", () => {
    expect(run("calculer_total_commande", { articles: [{ nom: "Burger", prix_unitaire: 6.5, quantite: 2 }, { prix_unitaire: 2.2, quantite: 1 }] }).result).toMatchObject({
      total: "15,20 €",
    });
    expect(run("calculer_pourcentage", { montant: 20, operation: "retirer", pourcentage: 10 }).result).toMatchObject({ resultat: "18,00 €" });
    expect(run("calculer_pourcentage", { montant: 5, operation: "taux", sur: 20 }).result).toMatchObject({ resultat: "25 %" });
    expect(run("partager_montant", { montant: 100, parts: 3 }).result).toMatchObject({ parts: ["Part 1 : 33,34 €", "Part 2 : 33,33 €", "Part 3 : 33,33 €"] });
  });

  it("lire_taches_du_jour : compteurs calculés par le code", () => {
    expect(run("lire_taches_du_jour", {}).result).toMatchObject({ total: 3, faites: 1, restantes: 2, en_retard: 1, prochaine_tache: "02:30 · Clôture caisse" });
  });

  it("proposer_tache : maintenant = prochain multiple de 5 min, jamais d'ajout direct", () => {
    const out = run("proposer_tache", { titre: "Vider les poubelles", categorie: "Hygiène", maintenant: true });
    expect(out.proposal).toMatchObject({ title: "Vider les poubelles", category: "Hygiène", time: "22:50", remind: 0 });
  });

  it("proposer_tache : refuse hors service, doublon, heure illisible", () => {
    expect(run("proposer_tache", { titre: "X", heure: "14:00" }).result).toHaveProperty("erreur");
    expect(run("proposer_tache", { titre: "x", heure: "abc" }).proposal).toBeUndefined();
    const dup = run("proposer_tache", { titre: "réappro sauces", heure: "23:00" });
    expect(dup.proposal).toBeUndefined();
    expect(dup.result).toHaveProperty("deja_dans_la_liste");
    expect(run("proposer_tache", { titre: "Frigo", heure: "01:32" }).proposal?.time).toBe("01:30");
  });

  it("arguments invalides ou outil inconnu : erreur propre", () => {
    expect(executeTool("compter_caisse", "{pas du json", ctx).result).toHaveProperty("erreur");
    expect(executeTool("hack", "{}", ctx).result).toHaveProperty("erreur");
  });
});

describe("confidentialité et validation", () => {
  it("masque e-mails, téléphones et numéros de carte", () => {
    const t = maskPersonalData("appelle Léa au 06 12 34 56 78 ou lea@mail.fr, carte 4970 1012 3456 7890");
    expect(t).not.toMatch(/06 12|lea@|4970/);
    expect(t.match(/\[masqué\]/g)).toHaveLength(3);
    expect(maskPersonalData("fond de caisse 150 € et 12,50 €")).toBe("fond de caisse 150 € et 12,50 €");
  });

  it("parseRequest nettoie l'historique et exige un dernier message utilisateur", () => {
    expect(parseRequest({ messages: [{ role: "assistant", content: "salut" }] })).toBeNull();
    expect(parseRequest({ messages: [{ role: "system", content: "x" }] })).toBeNull();
    const ok = parseRequest({ messages: [{ role: "assistant", content: "ancien" }, { role: "user", content: "mon num 0612345678" }], context: { tva: 99 } });
    expect(ok?.messages).toEqual([{ role: "user", content: "mon num [masqué]" }]);
    expect(ok?.context.tva).toBe(10);
  });
});

describe("limite anti-abus", () => {
  it("30 messages par heure et par appareil", () => {
    const id = "device-test-0001";
    for (let i = 0; i < 30; i++) expect(checkRateLimit(id, "1.1.1.1").ok).toBe(true);
    const r = checkRateLimit(id, "1.1.1.1");
    expect(r.ok).toBe(false);
    expect(checkRateLimit("device-test-0002", "1.1.1.1").ok).toBe(true);
  });
});

async function readEvents(res: Response) {
  const text = await res.text();
  return text.trim().split("\n").map((l) => JSON.parse(l));
}
const post = (body: unknown, id = "device-route-" + Math.random().toString(36).slice(2, 10)) =>
  POST(new Request("http://x/api/assistant", { method: "POST", headers: { "x-client-id": id }, body: JSON.stringify(body) }));
const body = { messages: [{ role: "user", content: "compte ma caisse : 3 billets de 20" }], context: ctx };

describe("route /api/assistant", () => {
  beforeEach(() => streamChat.mockReset());

  it("boucle d'outils : le modèle appelle compter_caisse puis présente le résultat (streaming)", async () => {
    streamChat
      .mockImplementationOnce(async function* () {
        yield { type: "tool_calls", calls: [{ id: "c1", name: "compter_caisse", arguments: JSON.stringify({ lignes: [{ valeur: 20, quantite: 3 }] }) }] };
      })
      .mockImplementationOnce(async function* (args: { messages: { role: string; content: string }[] }) {
        const tool = args.messages.at(-1)!;
        expect(tool.role).toBe("tool");
        expect(JSON.parse(tool.content).total).toBe("60,00 €");
        yield { type: "text", text: "Total : " };
        yield { type: "text", text: "**60,00 €**" };
      });
    const events = await readEvents(await post(body));
    expect(events).toEqual([{ type: "text", text: "Total : " }, { type: "text", text: "**60,00 €**" }, { type: "done" }]);
  });

  it("une proposition de tâche est envoyée à l'interface", async () => {
    streamChat
      .mockImplementationOnce(async function* () {
        yield { type: "tool_calls", calls: [{ id: "c1", name: "proposer_tache", arguments: JSON.stringify({ titre: "Vider les poubelles", maintenant: true }) }] };
      })
      .mockImplementationOnce(async function* () {
        yield { type: "text", text: "Je te l'ai mise en dessous." };
      });
    const events = await readEvents(await post(body));
    expect(events[0]).toMatchObject({ type: "proposal", task: { title: "Vider les poubelles", time: "22:50" } });
  });

  it("erreur 429 du fournisseur : message clair, pas de crash", async () => {
    streamChat.mockImplementation(async function* () {
      throw new ProviderError("rate_limit", "429");
      yield;
    });
    const res = await post(body);
    expect(res.status).toBe(200);
    const events = await readEvents(res);
    expect(events[0]).toEqual({ type: "error", code: "rate_limit", message: "Trop de demandes, réessaie dans une minute." });
    expect(events.at(-1)).toEqual({ type: "done" });
  });

  it("limite locale : 429 HTTP au 31e message", async () => {
    streamChat.mockImplementation(async function* () {
      yield { type: "text", text: "ok" };
    });
    const id = "device-limit-0001";
    for (let i = 0; i < 30; i++) expect((await post(body, id)).status).toBe(200);
    const res = await post(body, id);
    expect(res.status).toBe(429);
    expect((await res.json()).message).toMatch(/30 messages/);
  });

  it("requête invalide : 400", async () => {
    expect((await post({ messages: [] })).status).toBe(400);
  });
});
