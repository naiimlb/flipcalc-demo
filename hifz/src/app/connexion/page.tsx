import type { Metadata } from "next";
import { LoginScreen } from "@/components/auth/LoginScreen";

export const metadata: Metadata = { title: "Connexion" };

export default function Page() {
  return <LoginScreen />;
}
