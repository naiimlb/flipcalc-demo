import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Identifiant du déploiement en cours. Le navigateur le compare régulièrement
 * pour proposer « Nouvelle version disponible – Mettre à jour ».
 */
export function GET() {
  const version =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    process.env.NEXT_PUBLIC_BUILD_ID ||
    "local";
  return NextResponse.json(
    { version },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
