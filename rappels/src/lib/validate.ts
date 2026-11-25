// Règles de saisie partagées entre les écrans et le serveur.
export const normalizeEmail = (v: string) => v.trim().toLowerCase();
export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 120;
export const cleanPrenom = (v: string) => v.trim().replace(/\s+/g, " ");
export const isPrenom = (v: string) => v.length >= 1 && v.length <= 30;
export const MIN_PASSWORD = 8;
export const isPassword = (v: string) => v.length >= MIN_PASSWORD && v.length <= 72;
