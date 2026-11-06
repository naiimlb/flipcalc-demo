import { IDBFactory } from 'fake-indexeddb';
import { beforeEach } from 'vitest';

class MemoryStorage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  getItem(k: string) {
    return this.data.has(k) ? (this.data.get(k) as string) : null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, String(v));
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  clear() {
    this.data.clear();
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
}

// Chaque test repart d'un téléphone « neuf » : stockage vide.
beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true, writable: true });
  Object.defineProperty(globalThis, 'indexedDB', { value: new IDBFactory(), configurable: true, writable: true });
});
