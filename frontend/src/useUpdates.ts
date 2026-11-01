import { useEffect, useState } from 'react';
import { api } from './api';

export function useUpdates() {
  const [versions, setVersions] = useState({ catalogVersion: 0, contentVersion: 0 });
  useEffect(() => {
    let active = true;
    let pending = false;
    let previous: { catalog: string; content: string } | undefined;
    async function check() {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const current = await api<{ catalog: string; content: string }>('/updates');
        if (!active) return;
        if (previous) {
          const catalogChanged = previous.catalog !== current.catalog;
          const contentChanged = previous.content !== current.content;
          if (catalogChanged || contentChanged)
            setVersions((value) => ({
              catalogVersion: value.catalogVersion + Number(catalogChanged),
              contentVersion: value.contentVersion + Number(contentChanged),
            }));
        }
        previous = current;
      } catch {
        /* Keep the visible catalog if a background check fails. */
      } finally {
        pending = false;
      }
    }
    void check();
    const interval = window.setInterval(check, 15000);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('kova-data-written', check);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('kova-data-written', check);
    };
  }, []);
  return versions;
}
