import type { Metadata } from "next";
import { StudioScreen } from "@/components/app/StudioScreen";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Studio" };

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ p?: string; depart?: string }> }) {
  const params = await searchParams;
  return <StudioScreen p={params.p} depart={params.depart} />;
}
