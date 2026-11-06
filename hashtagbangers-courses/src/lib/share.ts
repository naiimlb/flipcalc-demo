export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Repli pour les contextes sans API presse-papiers
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export type ShareOutcome = 'shared' | 'copied' | 'downloaded' | 'cancelled' | 'failed';

/** Feuille de partage iOS ; si indisponible, copie dans le presse-papiers. */
export async function shareText(text: string, title?: string): Promise<ShareOutcome> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ text, title });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    }
  }
  return (await copyText(text)) ? 'copied' : 'failed';
}

export async function readClipboard(): Promise<string | null> {
  try {
    if (!navigator.clipboard?.readText) return null;
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
}

/** Fichier via la feuille de partage iOS (Enregistrer dans Fichiers, AirDrop, Messages…) ; sinon téléchargement. */
export async function shareFile(file: File, title: string): Promise<ShareOutcome> {
  try {
    if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title });
      return 'shared';
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
  }
  try {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 15000);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}
