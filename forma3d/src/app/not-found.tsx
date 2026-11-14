import Link from "next/link";
import { LogoMark } from "@/components/icons";

/** Page introuvable : une phrase, un lien vers l'accueil. */
export default function NotFound() {
  return (
    <div className="simple-ui flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <LogoMark size={32} />
      <h1 className="mt-6 text-title font-semibold text-ink">Cette page n&apos;existe pas</h1>
      <p className="mt-2 max-w-md text-body text-ink-soft">Le lien est peut-être ancien ou incomplet. Vous pouvez repartir de l&apos;accueil pour créer une pièce.</p>
      <Link href="/" className="mt-6 flex min-h-12 items-center rounded-xl bg-accent-strong px-5 text-lead font-medium text-white hover:bg-accent-strong/90">
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
