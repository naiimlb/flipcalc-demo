import type { Metadata } from "next";
import { AddProgramScreen } from "@/modules/hifz/AddProgramScreen";

export const metadata: Metadata = { title: "Ajouter des versets" };

export default function Page() {
  return <AddProgramScreen />;
}
