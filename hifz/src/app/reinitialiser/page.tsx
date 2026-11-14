import type { Metadata } from "next";
import { ResetScreen } from "@/components/auth/ResetScreen";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default function Page() {
  return <ResetScreen />;
}
