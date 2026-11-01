import { SAMPLE_TEST_PROMPT } from "@/lib/design/prompt";
import { getAiSettings } from "@/lib/settings.server";
import { AdminTitle } from "../ui";
import { AiForm } from "./AiForm";

export default async function AiPage() {
  const ai = await getAiSettings();
  return (
    <div>
      <AdminTitle title="Prompt IA" subtitle="Instructions données à Claude pour analyser les demandes et modéliser les solutions." />
      <AiForm initial={ai} samplePrompt={SAMPLE_TEST_PROMPT} />
    </div>
  );
}
