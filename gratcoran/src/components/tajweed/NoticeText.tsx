/** Texte de sensibilisation du correcteur de Tajweed (affiché tel quel). */
export function NoticeText() {
  return (
    <div className="space-y-4 text-[16px] leading-relaxed">
      <p>Cet outil t&apos;aide à t&apos;entraîner, mais il a des limites :</p>
      <ul className="space-y-3">
        {[
          "Il repère surtout les mots faux, manquants ou mal prononcés.",
          "Il ne peut pas juger avec certitude la durée des allongements (madd), la ghunna, la qalqala ou la qualité exacte des lettres.",
          "Un résultat « parfait » ne garantit pas une récitation parfaite, et une erreur signalée peut venir de l'IA ou du micro.",
        ].map((t) => (
          <li key={t} className="flex gap-3">
            <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald" aria-hidden />
            <span>{t}</span>
          </li>
        ))}
      </ul>
      <p>
        Pour apprendre le tajweed correctement, rien ne remplace un enseignant qualifié qui t&apos;écoute en direct.
        Utilise Grat&apos;Coran comme un entraînement entre deux cours.
      </p>
    </div>
  );
}

export const RESULT_REMINDER = "Résultat indicatif. Vérifie avec un enseignant qualifié.";
