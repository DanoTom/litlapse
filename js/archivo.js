/**
 * litlapse · archivo.js
 * --------------------------------------------------------------
 * Hemeroteca. Renderiza el índice de ediciones pasadas (todas
 * abiertas: fragmento restaurado + atribución + postal descargable).
 *
 * Regla anti-spoiler: sólo se listan las ediciones cuya fecha es
 * anterior o igual a hoy. Las futuras no existen para el lector.
 * Orden: de la más reciente a la más antigua.
 * --------------------------------------------------------------
 */
(function (global) {
  'use strict';

  /** "2026-06-10" → "10 · 06 · 26" */
  function _fechaCorta(iso) {
    const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return String(iso || '');
    return `${m[3]} · ${m[2]} · ${m[1].slice(2)}`;
  }

  /** Romanos para años (1–3999). */
  function _aRomanoAnio(n) {
    if (typeof n !== 'number' || n < 1 || n > 3999) return String(n);
    const tabla = [['M', 1000], ['CM', 900], ['D', 500], ['CD', 400],
                   ['C', 100], ['XC', 90], ['L', 50], ['XL', 40],
                   ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1]];
    let r = '';
    for (const [s, v] of tabla) { while (n >= v) { r += s; n -= v; } }
    return r;
  }

  /** Fragmento con las palabras restauradas subrayadas (punteado). */
  function _fragmentoHtml(Utils, puzzle) {
    const ocultas = new Map();
    puzzle.palabrasOcultas.forEach((o) => ocultas.set(o.indicePalabra, o));
    return Utils.tokenize(puzzle.textoOriginal).map((token, i) => {
      if (!ocultas.has(i)) return Utils.escapeHtml(token);
      const { prefijo, raiz, sufijo } = Utils.splitPunctuation(token);
      return `${Utils.escapeHtml(prefijo)}<span class="postal-revealed">${Utils.escapeHtml(raiz)}</span>${Utils.escapeHtml(sufijo)}`;
    }).join(' ');
  }

  /** HTML interno de la postal de archivo: fecha en lugar de intentos. */
  function _postalHtml(Utils, puzzle) {
    const idStr = String(puzzle.id).padStart(2, '0');
    return [
      `<div class="postal-mark">`,
        `<span class="postal-logo">L I T L A P S E</span>`,
        `<span class="postal-num">№${idStr}</span>`,
      `</div>`,
      `<p class="postal-frag">${_fragmentoHtml(Utils, puzzle)}</p>`,
      `<div class="postal-attrib">`,
        `${Utils.escapeHtml(puzzle.autor)}`,
        `<em>${Utils.escapeHtml(puzzle.obra)} · ${Utils.escapeHtml(puzzle['año'])}</em>`,
      `</div>`,
      `<div class="postal-foot">`,
        `<span>Edición №${idStr} · ${_fechaCorta(puzzle.fecha)}</span>`,
        `<span class="postal-seal">L</span>`,
      `</div>`
    ].join('');
  }

  /** Una entrada del índice. */
  function _entradaHtml(Utils, puzzle) {
    const idStr = String(puzzle.id).padStart(2, '0');
    return [
      `<article class="archivo-item">`,
        `<header class="archivo-head">`,
          `<span class="archivo-num">№${idStr}</span>`,
          `<span class="archivo-fecha">${_fechaCorta(puzzle.fecha)}</span>`,
        `</header>`,
        `<p class="archivo-frag">${_fragmentoHtml(Utils, puzzle)}</p>`,
        `<footer class="archivo-foot">`,
          `<div class="archivo-attrib">`,
            `${Utils.escapeHtml(puzzle.autor)}`,
            `<em>${Utils.escapeHtml(puzzle.obra)} · ${Utils.escapeHtml(puzzle['año'])}</em>`,
          `</div>`,
          `<button type="button" class="archivo-postal-btn" data-postal="${puzzle.id}">descargar postal</button>`,
        `</footer>`,
      `</article>`
    ].join('');
  }

  /**
   * Genera y comparte/descarga la postal de una edición pasada.
   * Mismo patrón que el motor: wrapper temporal 0×0 con overflow
   * hidden, anclado al documento, para que html-to-image capture
   * la postal a su tamaño nativo sin que se vea en pantalla.
   */
  async function _descargarPostal(Share, Utils, puzzle, btn) {
    const doc = global.document;
    const textoOriginal = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'generando…';

    const wrapper = doc.createElement('div');
    wrapper.setAttribute('aria-hidden', 'true');
    wrapper.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;left:0;top:0;';
    const postal = doc.createElement('div');
    postal.className = 'postal';
    postal.innerHTML = _postalHtml(Utils, puzzle);
    wrapper.appendChild(postal);
    doc.body.appendChild(wrapper);

    try {
      await new Promise((r) => global.requestAnimationFrame(r));
      const result = await Share.compartirImagen(postal, puzzle);
      btn.textContent = result && result.ok ? textoOriginal : 'no se pudo generar';
      if (!result || !result.ok) {
        global.setTimeout(() => { btn.textContent = textoOriginal; }, 2500);
      }
    } finally {
      wrapper.remove();
      btn.disabled = false;
    }
  }

  function arrancar() {
    const { Puzzles, Utils, Share } = global.Litlapse;
    const doc = global.document;
    const host = doc.querySelector('[data-litlapse="archivo-list"]');
    if (!host) return;

    const hoy = Puzzles.todayISO();
    const pasadas = Puzzles.all
      .filter((p) => p.fecha <= hoy)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));

    // Contador de la cabecera: "7 ediciones".
    const count = doc.querySelector('[data-litlapse="archivo-count"]');
    if (count) {
      count.textContent = pasadas.length === 1
        ? '1 edición'
        : `${pasadas.length} ediciones`;
    }

    // Año del colofón.
    const anno = doc.querySelector('[data-litlapse="anno"]');
    if (anno) anno.textContent = _aRomanoAnio(new Date().getFullYear());

    if (!pasadas.length) {
      host.innerHTML = '<p class="archivo-empty">El archivo está vacío todavía — la primera edición llega pronto.</p>';
      return;
    }

    host.innerHTML = pasadas.map((p) => _entradaHtml(Utils, p)).join('');

    // Delegación: un solo listener para todos los botones de postal.
    host.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-postal]');
      if (!btn || btn.disabled) return;
      const puzzle = Puzzles.getPuzzleById(Number(btn.dataset.postal));
      if (!puzzle) return;
      _descargarPostal(Share, Utils, puzzle, btn);
    });
  }

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', arrancar, { once: true });
  } else {
    arrancar();
  }
})(typeof window !== 'undefined' ? window : globalThis);
