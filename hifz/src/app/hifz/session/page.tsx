import type { Metadata } from "next";
import { SessionScreen } from "@/modules/hifz/SessionScreen";

export const metadata: Metadata = { title: "Récitation" };

export default function Page() {
  return <SessionScreen />;
}
