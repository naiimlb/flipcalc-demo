import type { Metadata } from "next";
import { ForgotScreen } from "@/components/auth/ForgotScreen";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function Page() {
  return <ForgotScreen />;
}
