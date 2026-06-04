/**
 * litlapse · state.js
 * --------------------------------------------------------------
 * Fuente única de verdad de la partida. Encapsula las invariantes
 * del juego y emite eventos al motor del DOM mediante callbacks.
 *
 * Vidas: arrancan en 6. Cada error global descuenta una. Llegando
 * a 0, la partida pasa a 'DERROTA' (irrecuperable hasta mañana).
 *
 * Avance automático: tras un acierto, el `activeIndex` salta a la
 * siguiente posición pendiente (en orden de aparición). Si no quedan,
 * la partida pasa a 'VICTORIA' y se sella `finishedAt`.
 * --------------------------------------------------------------
 */
(function (global) {
  'use strict';

  const { Utils, Storage } = global.Litlapse;
  const MAX_ERRORES = 6;

  const STATUS = Object.freeze({
    JUGANDO: 'JUGANDO',
    VICTORIA: 'VICTORIA',
    DERROTA: 'DERROTA'
  });

  class GameState {
    /**
     * @param {object} puzzle  Puzzle del día (forma estricta documentada en puzzles.js).
     * @param {object} [opts]
     * @param {boolean} [opts.autosave=true]  Persistir tras cada mutación.
     * @param {(s: GameState) => void} [opts.onChange]  Notificación post-mutación.
     */
    constructor(puzzle, opts = {}) {
      if (!puzzle || !Array.isArray(puzzle.palabrasOcultas)) {
        throw new Error('GameState: puzzle inválido.');
      }
      this.puzzle = puzzle;
      this.autosave = opts.autosave !== false;
      this.onChange = typeof opts.onChange === 'function' ? opts.onChange : null;

      const previa = Storage.load(puzzle.id);
      if (previa && this._esEstadoValido(previa, puzzle)) {
        this._rehidratar(previa);
      } else {
        this._iniciarLimpio();
      }
    }

    // ──────────────────────────── ciclo de vida ──

    _iniciarLimpio() {
      const total = this.puzzle.palabrasOcultas.length;
      this.puzzleId = this.puzzle.id;
      this.fecha = this.puzzle.fecha;
      this.encontradas = new Array(total).fill(false);
      this.activeIndex = 0;
      this.intentosPorPalabra = new Array(total).fill(0).map(() => []);
      this.cementerio = [];
      this.vidas = MAX_ERRORES;
      this.pistasUsadas = 0;
      this.status = STATUS.JUGANDO;
      this.startedAt = Date.now();
      this.finishedAt = null;
    }

    _rehidratar(s) {
      this.puzzleId = s.puzzleId;
      this.fecha = s.fecha;
      this.encontradas = Array.isArray(s.encontradas) ? s.encontradas.slice() : [];
      this.activeIndex = typeof s.activeIndex === 'number' ? s.activeIndex : 0;
      this.intentosPorPalabra = Array.isArray(s.intentosPorPalabra)
        ? s.intentosPorPalabra.map((xs) => (Array.isArray(xs) ? xs.slice() : []))
        : [];
      this.cementerio = Array.isArray(s.cementerio) ? s.cementerio.slice() : [];
      this.vidas = typeof s.vidas === 'number' ? s.vidas : MAX_ERRORES;
      this.pistasUsadas = typeof s.pistasUsadas === 'number' ? s.pistasUsadas : 0;
      this.status = s.status === STATUS.VICTORIA || s.status === STATUS.DERROTA
        ? s.status
        : STATUS.JUGANDO;
      this.startedAt = s.startedAt || Date.now();
      this.finishedAt = s.finishedAt || null;

      // Si en disco quedó como JUGANDO pero por consistencia ya está terminada,
      // sellamos el estado correcto sin esperar a la próxima mutación.
      if (this.status === STATUS.JUGANDO) {
        if (this.encontradas.every(Boolean)) {
          this.status = STATUS.VICTORIA;
          this.finishedAt = this.finishedAt || Date.now();
        } else if (this.vidas <= 0) {
          this.status = STATUS.DERROTA;
          this.finishedAt = this.finishedAt || Date.now();
        }
      }
    }

    _esEstadoValido(s, puzzle) {
      return (
        s &&
        s.puzzleId === puzzle.id &&
        s.fecha === puzzle.fecha &&
        Array.isArray(s.encontradas) &&
        s.encontradas.length === puzzle.palabrasOcultas.length
      );
    }

    // ──────────────────────────── consultas ──

    get totalPalabras() { return this.puzzle.palabrasOcultas.length; }
    get aciertos() { return this.encontradas.filter(Boolean).length; }
    get errores() { return MAX_ERRORES - this.vidas; }
    get totalIntentos() {
      return this.intentosPorPalabra.reduce((acc, xs) => acc + xs.length, 0);
    }
    get terminada() { return this.status !== STATUS.JUGANDO; }
    get palabraActiva() {
      if (this.terminada) return null;
      return this.puzzle.palabrasOcultas[this.activeIndex] || null;
    }

    // ──────────────────────────── mutaciones ──

    /**
     * Procesa un intento del usuario. Devuelve un objeto descriptivo:
     *   { tipo: 'ACIERTO' | 'ERROR' | 'IGNORADO',
     *     palabraIndex, palabraIngresada, motivo? }
     */
    intentar(palabraIngresada) {
      if (this.terminada) {
        return { tipo: 'IGNORADO', motivo: 'partida terminada' };
      }
      const limpia = Utils.normalize(palabraIngresada);
      if (!limpia) {
        return { tipo: 'IGNORADO', motivo: 'entrada vacía' };
      }
      const activa = this.palabraActiva;
      if (!activa) {
        return { tipo: 'IGNORADO', motivo: 'sin palabra activa' };
      }

      const idx = this.activeIndex;
      this.intentosPorPalabra[idx].push(limpia);

      const objetivo = Utils.normalize(activa.palabraCorrecta);
      if (limpia === objetivo) {
        this.encontradas[idx] = true;
        this._avanzarActiva();
        if (this.encontradas.every(Boolean)) {
          this.status = STATUS.VICTORIA;
          this.finishedAt = Date.now();
        }
        this._persistirYNotificar();
        return { tipo: 'ACIERTO', palabraIndex: idx, palabraIngresada: limpia };
      }

      this.cementerio.push(limpia);
      this.vidas = Math.max(0, this.vidas - 1);
      if (this.vidas === 0) {
        this.status = STATUS.DERROTA;
        this.finishedAt = Date.now();
      }
      this._persistirYNotificar();
      return { tipo: 'ERROR', palabraIndex: idx, palabraIngresada: limpia };
    }

    /**
     * Auxilio: registra una pista usada y devuelve su contenido. El motor
     * decide cómo renderizarla.
     *   modo = 'inicial'   → primera letra de la palabra activa.
     *   modo = 'diccionario' (por defecto) → glosa breve.
     */
    pedirPista(modo = 'diccionario') {
      if (this.terminada) return null;
      const activa = this.palabraActiva;
      if (!activa) return null;

      this.pistasUsadas += 1;
      this._persistirYNotificar();

      if (modo === 'inicial') {
        return {
          modo,
          contenido: (activa.palabraCorrecta || '').charAt(0)
        };
      }
      return { modo: 'diccionario', contenido: activa.pistaDiccionario || '' };
    }

    /** Reinicia la partida (uso interno / debug). */
    reiniciar() {
      this._iniciarLimpio();
      this._persistirYNotificar();
    }

    // ──────────────────────────── internos ──

    _avanzarActiva() {
      for (let i = 0; i < this.encontradas.length; i++) {
        if (!this.encontradas[i]) {
          this.activeIndex = i;
          return;
        }
      }
      this.activeIndex = this.encontradas.length - 1;
    }

    _persistirYNotificar() {
      if (this.autosave) Storage.save(this.puzzleId, this.snapshot());
      if (this.onChange) {
        try { this.onChange(this); } catch (_e) { /* aislar al motor */ }
      }
    }

    /** Foto JSON-segura para persistir o serializar. */
    snapshot() {
      return {
        puzzleId: this.puzzleId,
        fecha: this.fecha,
        encontradas: this.encontradas.slice(),
        activeIndex: this.activeIndex,
        intentosPorPalabra: this.intentosPorPalabra.map((xs) => xs.slice()),
        cementerio: this.cementerio.slice(),
        vidas: this.vidas,
        pistasUsadas: this.pistasUsadas,
        status: this.status,
        startedAt: this.startedAt,
        finishedAt: this.finishedAt
      };
    }
  }

  global.Litlapse = global.Litlapse || {};
  global.Litlapse.State = { GameState, STATUS, MAX_ERRORES };
})(typeof window !== 'undefined' ? window : globalThis);
