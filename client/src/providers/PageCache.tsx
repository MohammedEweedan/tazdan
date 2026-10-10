'use client';

import { useEffect } from 'react';

/** The marketing site caches only assets the visitor actually uses. */
export default function PageCache() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      // A production worker from a local preview must never intercept next dev.
      void navigator.serviceWorker.getRegistrations().then(registrations => {
        for (const registration of registrations) {
          if (registration.active?.scriptURL === `${location.origin}/sw.js`) void registration.unregister();
        }
      });
      void caches.keys().then(keys => Promise.all(keys
        .filter(key => /^(workbox-precache|next-static|assets$|pages$|start-url$)/.test(key))
        .map(key => caches.delete(key))));
      return;
    }
    let timer: number;
    const register = () => {
      timer = window.setTimeout(() => {
        void navigator.serviceWorker.register('/sw.js').catch(() => {});
      }, 3000);
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('load', register);
    };
  }, []);
  return null;
}
