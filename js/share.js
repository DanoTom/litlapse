/**
 * litlapse · share.js
 * --------------------------------------------------------------
 * Compartido del resultado. Dos pistas:
 *
 *  - `build(puzzle, snapshot)` arma el texto plano (estilo Wordle):
 *
 *        Litlapse — Edición №7
 *        10·06·26 · restaurada en 4 intentos · sin pistas
 *        litlapse.com
 *
 *    Sin teaser del fragmento — no spoilea a quien no jugó hoy.
 *
 *  - `copiar(texto)` copia al portapapeles (Clipboard API + fallback).
 *
 *  - `compartirImagen(nodo, puzzle)` toma un nodo DOM (la postal),
 *    lo convierte a PNG con html-to-image, e intenta compartirlo
 *    nativamente. Si el navegador no soporta Web Share con archivos,
 *    cae a descarga directa.
 * --------------------------------------------------------------
 */
(function (global) {
  'use strict';

  const DOMINIO = 'litlapse.com';

  /** Convierte "2026-06-04" en "04·06·26". */
  function _formatearFecha(iso) {
    if (typeof iso !== 'string') return '';
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return iso;
    return `${m[3]}·${m[2]}·${m[1].slice(2)}`;
  }

  /** Resumen de pistas para la línea de cierre. */
  function _linePistas(pistasUsadas) {
    if (!pistasUsadas) return 'sin pistas';
    if (pistasUsadas === 1) return 'con 1 pista';
    return `con ${pistasUsadas} pistas`;
  }

  /**
   * Genera el texto compartible a partir de un puzzle y un snapshot
   * de estado (ver GameState#snapshot).
   */
  function build(puzzle, snapshot) {
    const slots = Array.isArray(snapshot.slots) ? snapshot.slots : [];
    const intentos = slots.reduce(
      (acc, s) => acc + (s && typeof s.intentos === 'number' ? s.intentos : 0),
      0
    );
    const fecha = _formatearFecha(puzzle.fecha);
    const pistas = _linePistas(snapshot.pistasUsadas || 0);
    const intentoStr = `${intentos} intento${intentos === 1 ? '' : 's'}`;

    return [
      `Litlapse — Edición №${puzzle.id}`,
      `${fecha} · restaurada en ${intentoStr} · ${pistas}`,
      DOMINIO
    ].join('\n');
  }

  /**
   * Copia un texto al portapapeles. Clipboard API + fallback de textarea.
   */
  async function copiar(texto) {
    if (typeof texto !== 'string' || !texto) return false;
    try {
      if (global.navigator && global.navigator.clipboard && global.isSecureContext !== false) {
        await global.navigator.clipboard.writeText(texto);
        return true;
      }
    } catch (_e) { /* fallback abajo */ }

    try {
      const ta = global.document.createElement('textarea');
      ta.value = texto;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      ta.style.opacity = '0';
      global.document.body.appendChild(ta);
      ta.select();
      const ok = global.document.execCommand('copy');
      global.document.body.removeChild(ta);
      return !!ok;
    } catch (_e) {
      return false;
    }
  }

  /**
   * Renderiza un nodo DOM como PNG y lo entrega vía Web Share API
   * (si el navegador lo soporta con archivos) o cae a descarga directa.
   *
   * Devuelve `{ ok: true, modo: 'share' | 'download' }` o
   * `{ ok: false, motivo }`.
   */
  async function compartirImagen(nodo, puzzle) {
    if (!nodo) return { ok: false, motivo: 'sin nodo' };
    if (!global.htmlToImage) return { ok: false, motivo: 'librería no disponible' };

    let dataUrl;
    try {
      dataUrl = await global.htmlToImage.toPng(nodo, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: '#f6f3eb'
      });
    } catch (e) {
      return { ok: false, motivo: 'no se pudo generar la imagen' };
    }

    const nombre = `litlapse-${puzzle && puzzle.id ? puzzle.id : 'edicion'}.png`;

    // Intentar share nativo con archivo (mobile principalmente).
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], nombre, { type: 'image/png' });
      const nav = global.navigator;
      if (nav && typeof nav.canShare === 'function' && nav.canShare({ files: [file] })) {
        try {
          await nav.share({
            files: [file],
            title: `Litlapse — Edición №${puzzle && puzzle.id}`
          });
          return { ok: true, modo: 'share' };
        } catch (_e) {
          // Usuario canceló o falló: caemos a descarga.
        }
      }
    } catch (_e) { /* fallback abajo */ }

    // Fallback: descarga directa.
    try {
      const a = global.document.createElement('a');
      a.href = dataUrl;
      a.download = nombre;
      global.document.body.appendChild(a);
      a.click();
      a.remove();
      return { ok: true, modo: 'download' };
    } catch (_e) {
      return { ok: false, motivo: 'no se pudo descargar' };
    }
  }

  global.Litlapse = global.Litlapse || {};
  global.Litlapse.Share = { build, copiar, compartirImagen };
})(typeof window !== 'undefined' ? window : globalThis);
