import type { Metadata } from "next";
import { ProgramScreen } from "@/modules/hifz/ProgramScreen";

export const metadata: Metadata = { title: "Programme" };

export default function Page() {
  return <ProgramScreen />;
}
