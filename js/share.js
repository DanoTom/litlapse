/**
 * litlapse · share.js
 * --------------------------------------------------------------
 * Generador de string compartible (mística "Wordle" con carácter
 * editorial) y copia al portapapeles. No emite emojis ruidosos:
 * sólo tipografía, puntos suspensivos y un guion em.
 *
 * Formato canónico:
 *
 *     Litlapse — Día #1
 *     "La [......] del mundo tenía dos caras..."
 *     Resuelto en 4 intentos · Sin pistas
 *     Juega el fragmento de mañana en: litlapse.com
 * --------------------------------------------------------------
 */
(function (global) {
  'use strict';

  const { Utils } = global.Litlapse;
  const DOMINIO = 'litlapse.com';

  /**
   * Construye el extracto teaser. Toma el inicio del textoOriginal,
   * sustituye la primera palabra oculta por una elipsis textual del
   * mismo largo y conserva unas pocas palabras de cola antes del
   * truncado con "..." para que el fragmento sugiera, no spoilee.
   *
   * Resultado tipo: `"La [.......] del mundo tenía dos caras..."`.
   */
  const COLA_PALABRAS = 4;
  function _teaser(puzzle) {
    const tokens = Utils.tokenize(puzzle.textoOriginal);
    const primera = puzzle.palabrasOcultas
      .slice()
      .sort((a, b) => a.indicePalabra - b.indicePalabra)[0];
    if (!primera) return `"${puzzle.textoOriginal}"`;

    const idx = primera.indicePalabra;
    const largo = (primera.palabraCorrecta || '').length;
    const placeholder = `[${'.'.repeat(Math.max(3, largo))}]`;

    const fin = Math.min(tokens.length, idx + 1 + COLA_PALABRAS);
    const recorte = tokens.slice(0, fin).map((t, i) => {
      if (i !== idx) return t;
      const { prefijo, sufijo } = Utils.splitPunctuation(t);
      return `${prefijo}${placeholder}${sufijo}`;
    });
    // Si truncamos antes del final, removemos puntuación adherida
    // al último token para que la cola "..." se vea limpia.
    if (fin < tokens.length) {
      const ultimo = recorte[recorte.length - 1];
      recorte[recorte.length - 1] = ultimo.replace(/[.,;:!?…]+$/u, '');
    }
    const sufijoFinal = fin < tokens.length ? '...' : '';
    return `"${recorte.join(' ')}${sufijoFinal}"`;
  }

  /** Resumen de pistas para la línea final. */
  function _linePistas(pistasUsadas) {
    if (!pistasUsadas) return 'Sin pistas';
    if (pistasUsadas === 1) return 'Con 1 pista';
    return `Con ${pistasUsadas} pistas`;
  }

  /**
   * Genera el string completo a partir de un puzzle y un snapshot
   * de estado (ver GameState#snapshot).
   */
  function build(puzzle, snapshot) {
    const intentos = (snapshot.intentosPorPalabra || []).reduce(
      (acc, xs) => acc + (Array.isArray(xs) ? xs.length : 0),
      0
    );
    const teaser = _teaser(puzzle);
    const pistas = _linePistas(snapshot.pistasUsadas || 0);

    return [
      `Litlapse — Día #${puzzle.id}`,
      teaser,
      `Resuelto en ${intentos} intento${intentos === 1 ? '' : 's'} · ${pistas}`,
      `Juega el fragmento de mañana en: ${DOMINIO}`
    ].join('\n');
  }

  /**
   * Copia un texto al portapapeles. Usa Clipboard API cuando está
   * disponible y cae a un textarea fuera de pantalla como fallback.
   * Devuelve una promesa con `true`/`false`.
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

  global.Litlapse = global.Litlapse || {};
  global.Litlapse.Share = { build, copiar };
})(typeof window !== 'undefined' ? window : globalThis);
