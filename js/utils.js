/**
 * litlapse · utils.js
 * --------------------------------------------------------------
 * Pequeñas utilidades sin estado: normalización tolerante de
 * input, escapado seguro de HTML y tokenización del fragmento.
 *
 * Mantener este módulo libre de DOM y de localStorage.
 * --------------------------------------------------------------
 */
(function (global) {
  'use strict';

  /**
   * Normaliza una cadena para comparación tolerante:
   *  - minúsculas
   *  - sin diacríticos (NFD + strip de la categoría Mn)
   *  - sin espacios envolventes
   *  - colapsa espacios internos
   *  - elimina puntuación marginal habitual
   *
   * Pensada exclusivamente para *comparar*, nunca para renderizar.
   */
  function normalize(raw) {
    if (raw == null) return '';
    return String(raw)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[.,;:!?¿¡"“”«»()\[\]{}…—–-]/g, '')
      .trim()
      .replace(/\s+/g, ' ');
  }

  /**
   * Escapa los cinco caracteres significativos de HTML para impedir
   * que un texto de puzzle (o un input del usuario) inyecte markup.
   */
  function escapeHtml(raw) {
    if (raw == null) return '';
    return String(raw)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Divide el fragmento original en tokens por espacios, conservando
   * cada palabra con su puntuación adherida ("caras,", "dos.").
   *
   * El motor usa esta lista paralela a `palabrasOcultas[*].indicePalabra`
   * para localizar qué token sustituir.
   */
  function tokenize(textoOriginal) {
    return String(textoOriginal).split(/\s+/).filter(Boolean);
  }

  /**
   * Devuelve `{ raiz, prefijo, sufijo }` para un token que puede
   * llevar puntuación pegada. La raíz se compara; el resto se
   * preserva al revelar la palabra correcta.
   *   "caras,"  → { prefijo: "",  raiz: "caras", sufijo: "," }
   *   "«hola»"  → { prefijo: "«", raiz: "hola",  sufijo: "»" }
   */
  function splitPunctuation(token) {
    const m = String(token).match(/^([^\p{L}\p{N}]*)([\p{L}\p{N}]+(?:['’]\p{L}+)*)([^\p{L}\p{N}]*)$/u);
    if (!m) return { prefijo: '', raiz: String(token), sufijo: '' };
    return { prefijo: m[1] || '', raiz: m[2] || '', sufijo: m[3] || '' };
  }

  /**
   * Largo en caracteres de la palabra correcta, útil para dimensionar
   * el bloque de elipsis (`width = chars * 0.55em, min 2.5em`).
   */
  function elipsisWidthEm(palabra, min = 2.5, factor = 0.55) {
    const len = String(palabra || '').length;
    return Math.max(min, len * factor);
  }

  global.Litlapse = global.Litlapse || {};
  global.Litlapse.Utils = {
    normalize,
    escapeHtml,
    tokenize,
    splitPunctuation,
    elipsisWidthEm
  };
})(typeof window !== 'undefined' ? window : globalThis);
