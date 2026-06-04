/**
 * litlapse · storage.js
 * --------------------------------------------------------------
 * Envoltorio defensivo sobre `localStorage`. Persiste el estado
 * indexado por el ID del puzzle (que es 1:1 con su fecha).
 *
 * Diseño:
 *  - Una sola clave por día: `litlapse:state:<puzzleId>`.
 *  - Escritura atómica: serializamos el state completo en cada save.
 *  - Resiliente a modo privado / cuotas excedidas: silencioso pero
 *    nunca lanza.
 * --------------------------------------------------------------
 */
(function (global) {
  'use strict';

  const PREFIX = 'litlapse:state:';

  function keyFor(puzzleId) {
    return `${PREFIX}${puzzleId}`;
  }

  function available() {
    try {
      const k = '__litlapse_probe__';
      global.localStorage.setItem(k, '1');
      global.localStorage.removeItem(k);
      return true;
    } catch (_e) {
      return false;
    }
  }

  /** Persiste el estado de un puzzle. Devuelve `true` si tuvo éxito. */
  function save(puzzleId, state) {
    if (!available()) return false;
    try {
      const payload = JSON.stringify({ v: 1, savedAt: Date.now(), state });
      global.localStorage.setItem(keyFor(puzzleId), payload);
      return true;
    } catch (_e) {
      return false;
    }
  }

  /** Lee el estado de un puzzle o devuelve `null`. */
  function load(puzzleId) {
    if (!available()) return null;
    try {
      const raw = global.localStorage.getItem(keyFor(puzzleId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && parsed.state ? parsed.state : null;
    } catch (_e) {
      return null;
    }
  }

  /** Borra el estado de un puzzle concreto. */
  function clear(puzzleId) {
    if (!available()) return;
    try {
      global.localStorage.removeItem(keyFor(puzzleId));
    } catch (_e) {
      /* noop */
    }
  }

  global.Litlapse = global.Litlapse || {};
  global.Litlapse.Storage = { save, load, clear, available, keyFor };
})(typeof window !== 'undefined' ? window : globalThis);
