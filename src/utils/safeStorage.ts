// Resilient in-memory & safe localStorage fallback for iframe and partitioned storage environments

const memoryStore: Record<string, string> = {};

export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
        const val = window.localStorage.getItem(key);
        if (val !== null) return val;
      }
    } catch (e) {
      // Storage access blocked or restricted by browser iframe sandbox
    }
    return memoryStore[key] ?? null;
  },

  setItem: (key: string, value: string): void => {
    memoryStore[key] = value;
    try {
      if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
        window.localStorage.setItem(key, value);
      }
    } catch (e) {
      // Storage access blocked or restricted by browser iframe sandbox
    }
  },

  removeItem: (key: string): void => {
    delete memoryStore[key];
    try {
      if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
        window.localStorage.removeItem(key);
      }
    } catch (e) {
      // Storage access blocked or restricted by browser iframe sandbox
    }
  },

  clear: (): void => {
    Object.keys(memoryStore).forEach((k) => delete memoryStore[k]);
    try {
      if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
        window.localStorage.clear();
      }
    } catch (e) {
      // Storage access blocked or restricted by browser iframe sandbox
    }
  }
};
