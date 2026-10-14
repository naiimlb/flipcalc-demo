/** Transition douce à chaque changement d'onglet (CSS : visible même avant le chargement du JS). */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-rise">{children}</div>;
}
