import { lazy } from 'react';

// Wraps React.lazy() so a failed chunk import (typically because a new deploy
// evicted the chunk while the tab still references the old hash) triggers a
// single page reload instead of a silent broken state.
//
// The session-scoped flag prevents an infinite reload loop if the underlying
// error is real (network down, server returning 500, etc.).
const FLAG = '__dirops_chunk_reload';

export function lazyWithRetry(factory) {
  return lazy(async () => {
    try {
      const mod = await factory();
      sessionStorage.removeItem(FLAG);
      return mod;
    } catch (err) {
      if (sessionStorage.getItem(FLAG) !== '1') {
        sessionStorage.setItem(FLAG, '1');
        window.location.reload();
        return new Promise(() => {});
      }
      sessionStorage.removeItem(FLAG);
      throw err;
    }
  });
}
