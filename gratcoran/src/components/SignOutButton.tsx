"use client";

import { useFormStatus } from "react-dom";
import { Button } from "./ui";

export function SignOutButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" loading={pending}>
      Se déconnecter
    </Button>
  );
}
