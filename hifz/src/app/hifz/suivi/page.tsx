import type { Metadata } from "next";
import { StatsScreen } from "@/modules/hifz/StatsScreen";

export const metadata: Metadata = { title: "Suivi" };

export default function Page() {
  return <StatsScreen />;
}
