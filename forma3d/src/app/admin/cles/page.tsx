import { canStoreSecrets, listSecretStatuses } from "@/lib/secrets";
import { AdminTitle, Card } from "../ui";
import { SecretsForm } from "./SecretsForm";

export default async function KeysPage() {
  const [secrets, canStore] = [await listSecretStatuses(), canStoreSecrets()];
  return (
    <div>
      <AdminTitle
        title="Clés d'API"
        subtitle="Stockées côté serveur, chiffrées en AES-256-GCM. Elles ne sont jamais renvoyées au navigateur : seuls les 4 derniers caractères s'affichent."
      />
      {!canStore && (
        <Card className="mb-4 !bg-warning/10">
          <p className="text-sm text-warning">
            Pour saisir des clés ici, définissez <code>SECRETS_ENCRYPTION_KEY</code> (32 octets en base64) et <code>SUPABASE_SECRET_KEY</code>
            dans les variables d&apos;environnement du serveur. En attendant, les clés sont lues depuis les variables d&apos;environnement.
          </p>
        </Card>
      )}
      <SecretsForm secrets={secrets} canStore={canStore} />
      <p className="mt-4 text-xs text-ink-mute">
        Ordre de priorité : clé saisie ici, puis variable d&apos;environnement. Une clé saisie ici prend effet immédiatement, sans redéploiement.
      </p>
    </div>
  );
}
