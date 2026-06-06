/**
 * litlapse · state.js
 * --------------------------------------------------------------
 * Fuente única de verdad. Mecánica deductiva letra-a-letra
 * (estilo Wordle dentro del fragmento):
 *
 *  - Cada palabra oculta se juega independientemente, con un tope
 *    de INTENTOS_POR_PALABRA tentativas para descubrirla.
 *  - El intento debe coincidir en LONGITUD con la palabra oculta
 *    activa; si no, se rechaza sin consumir intento.
 *  - Las letras del intento que coinciden POSICIÓN-A-POSICIÓN con
 *    la correcta quedan fijadas. Cuando todas están fijadas, el
 *    slot está resuelto y el foco salta al siguiente.
 *  - Si una letra del intento existe en la palabra correcta pero
 *    no en esa posición, se acumula en `contiene` (el susurro).
 *  - Las palabras incorrectas se acumulan en el cementerio.
 *  - Pista de regalo: la primera letra de cada palabra oculta
 *    arranca ya fijada. Reduce el espacio de búsqueda sin tocar
 *    el límite de intentos.
 *  - Agotar los intentos de cualquier palabra → DERROTA.
 *  - Completar las tres palabras → VICTORIA.
 * --------------------------------------------------------------
 */
(function (global) {
  'use strict';

  const { Utils, Storage } = global.Litlapse;
  const INTENTOS_POR_PALABRA = 6;

  const STATUS = Object.freeze({
    JUGANDO: 'JUGANDO',
    VICTORIA: 'VICTORIA',
    DERROTA: 'DERROTA'
  });

  // Tipos de resultado devueltos por `intentar()`:
  //   LARGO_INVALIDO  → el intento no coincide en largo (no consume intento)
  //   PARCIAL         → intento procesado; el slot aún no está completo
  //   COMPLETADA      → el slot quedó resuelto (puede coincidir con VICTORIA)
  //   AGOTADA         → se gastó el último intento sin completar → DERROTA
  //   IGNORADO        → entrada vacía o partida ya terminada

  /** Devuelve las letras canónicas (con tildes/mayúsculas) de una palabra. */
  function letrasCanonicas(palabra) {
    return Array.from(String(palabra || ''));
  }

  /** Devuelve las letras normalizadas (lowercase, sin diacríticos) para comparar. */
  function letrasNormalizadas(palabra) {
    return Array.from(Utils.normalize(palabra));
  }

  class GameState {
    /**
     * @param {object} puzzle  Puzzle del día (forma estricta documentada en puzzles.js).
     * @param {object} [opts]
     * @param {boolean} [opts.autosave=true]
     * @param {(s: GameState) => void} [opts.onChange]
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
      this.puzzleId = this.puzzle.id;
      this.fecha = this.puzzle.fecha;
      this.slots = this.puzzle.palabrasOcultas.map((p) => this._crearSlot(p));
      this.activeIndex = 0;
      this.cementerio = [];
      this.pistasUsadas = 0;
      this.status = STATUS.JUGANDO;
      this.startedAt = Date.now();
      this.finishedAt = null;
    }

    _crearSlot(palabraOculta) {
      const canon = letrasCanonicas(palabraOculta.palabraCorrecta);
      const norm = letrasNormalizadas(palabraOculta.palabraCorrecta);
      // Pista de regalo: primera posición fijada al arrancar.
      const fijadas = new Array(canon.length).fill(false);
      if (canon.length > 0) fijadas[0] = true;
      return {
        canon,             // letras canónicas para renderizar
        norm,              // letras normalizadas para comparar
        fijadas,           // boolean[] por posición
        contiene: [],      // letras (normalizadas) presentes pero descolocadas
        intentos: 0,
        completada: false
      };
    }

    _rehidratar(s) {
      this.puzzleId = s.puzzleId;
      this.fecha = s.fecha;
      this.slots = Array.isArray(s.slots)
        ? s.slots.map((slot, i) => this._rehidratarSlot(slot, this.puzzle.palabrasOcultas[i]))
        : this.puzzle.palabrasOcultas.map((p) => this._crearSlot(p));
      this.activeIndex = typeof s.activeIndex === 'number' ? s.activeIndex : 0;
      this.cementerio = Array.isArray(s.cementerio) ? s.cementerio.slice() : [];
      this.pistasUsadas = typeof s.pistasUsadas === 'number' ? s.pistasUsadas : 0;
      this.status = s.status === STATUS.VICTORIA || s.status === STATUS.DERROTA
        ? s.status : STATUS.JUGANDO;
      this.startedAt = s.startedAt || Date.now();
      this.finishedAt = s.finishedAt || null;

      // Reasentar el estado si quedó inconsistente en disco.
      if (this.status === STATUS.JUGANDO) {
        if (this.slots.every((sl) => sl.completada)) {
          this.status = STATUS.VICTORIA;
          this.finishedAt = this.finishedAt || Date.now();
        } else if (this.slots.some((sl) => !sl.completada && sl.intentos >= INTENTOS_POR_PALABRA)) {
          this.status = STATUS.DERROTA;
          this.finishedAt = this.finishedAt || Date.now();
        }
      }
    }

    _rehidratarSlot(saved, palabraOculta) {
      // Si el shape no encaja con el puzzle actual, recrear limpio.
      if (!saved || !palabraOculta) return this._crearSlot(palabraOculta);
      const fresco = this._crearSlot(palabraOculta);
      if (saved.canon && saved.canon.length === fresco.canon.length) {
        fresco.fijadas = Array.isArray(saved.fijadas)
          ? saved.fijadas.slice(0, fresco.canon.length)
          : fresco.fijadas;
        // Garantizar la pista de regalo si por algún motivo cayó.
        if (fresco.canon.length > 0 && !fresco.fijadas[0]) fresco.fijadas[0] = true;
        fresco.contiene = Array.isArray(saved.contiene) ? saved.contiene.slice() : [];
        fresco.intentos = typeof saved.intentos === 'number' ? saved.intentos : 0;
        fresco.completada = !!saved.completada || fresco.fijadas.every(Boolean);
      }
      return fresco;
    }

    _esEstadoValido(s, puzzle) {
      return (
        s &&
        s.puzzleId === puzzle.id &&
        s.fecha === puzzle.fecha &&
        Array.isArray(s.slots) &&
        s.slots.length === puzzle.palabrasOcultas.length
      );
    }

    // ──────────────────────────── consultas ──

    get totalPalabras() { return this.slots.length; }
    get aciertos() { return this.slots.filter((s) => s.completada).length; }
    get totalIntentos() {
      return this.slots.reduce((acc, s) => acc + s.intentos, 0);
    }
    get terminada() { return this.status !== STATUS.JUGANDO; }
    get slotActivo() {
      if (this.terminada) return null;
      return this.slots[this.activeIndex] || null;
    }
    get largoEsperado() {
      const s = this.slotActivo;
      return s ? s.canon.length : 0;
    }
    get intentosRestantes() {
      const s = this.slotActivo;
      return s ? Math.max(0, INTENTOS_POR_PALABRA - s.intentos) : 0;
    }
    get palabraActiva() {
      // Compat: algunos consumidores miran `palabraCorrecta` para pistas.
      if (this.terminada) return null;
      return this.puzzle.palabrasOcultas[this.activeIndex] || null;
    }

    // ──────────────────────────── mutaciones ──

    intentar(palabraIngresada) {
      if (this.terminada) return { tipo: 'IGNORADO', motivo: 'partida terminada' };
      const slot = this.slotActivo;
      if (!slot) return { tipo: 'IGNORADO', motivo: 'sin slot activo' };

      const limpia = Utils.normalize(palabraIngresada);
      if (!limpia) return { tipo: 'IGNORADO', motivo: 'entrada vacía' };

      const letrasIntento = Array.from(limpia);
      if (letrasIntento.length !== slot.norm.length) {
        return {
          tipo: 'LARGO_INVALIDO',
          motivo: `Esperado ${slot.norm.length} letras, recibí ${letrasIntento.length}.`,
          largoEsperado: slot.norm.length,
          largoRecibido: letrasIntento.length
        };
      }

      slot.intentos += 1;

      const posicionesFijadasAhora = [];
      const letrasNuevasContiene = [];

      // Pasada de coincidencias por posición.
      for (let i = 0; i < slot.norm.length; i++) {
        if (letrasIntento[i] === slot.norm[i] && !slot.fijadas[i]) {
          slot.fijadas[i] = true;
          posicionesFijadasAhora.push(i);
        }
      }

      // Pasada de letras descolocadas (presentes en otra posición).
      // Una letra entra en `contiene` si: (a) el jugador la propuso fuera de
      // su sitio, y (b) todavía existe alguna ocurrencia de esa letra en la
      // palabra que NO esté ya fijada. Sin la segunda condición, el susurro
      // anunciaría letras que ya se ven en el fragmento.
      for (let i = 0; i < letrasIntento.length; i++) {
        const ch = letrasIntento[i];
        if (letrasIntento[i] === slot.norm[i]) continue;
        const existeNoFijada = slot.norm.some((c, k) => c === ch && !slot.fijadas[k]);
        if (existeNoFijada && !slot.contiene.includes(ch)) {
          slot.contiene.push(ch);
          letrasNuevasContiene.push(ch);
        }
      }

      // ¿Quedó completa la palabra (sea por coincidencia total o por
      // acumulación de letras correctas a lo largo de intentos)?
      const completada = slot.fijadas.every(Boolean);
      if (completada) {
        slot.completada = true;
        this._avanzarSlot();
        if (this.slots.every((s) => s.completada)) {
          this.status = STATUS.VICTORIA;
          this.finishedAt = Date.now();
        }
        this._persistirYNotificar();
        return {
          tipo: 'COMPLETADA',
          slotIndex: this.activeIndex,
          posicionesFijadasAhora,
          letrasNuevasContiene
        };
      }

      // Intento fallido: al cementerio (sin duplicar).
      if (!this.cementerio.includes(limpia)) this.cementerio.push(limpia);

      if (slot.intentos >= INTENTOS_POR_PALABRA) {
        this.status = STATUS.DERROTA;
        this.finishedAt = Date.now();
        this._persistirYNotificar();
        return { tipo: 'AGOTADA', posicionesFijadasAhora, letrasNuevasContiene };
      }

      this._persistirYNotificar();
      return { tipo: 'PARCIAL', posicionesFijadasAhora, letrasNuevasContiene };
    }

    pedirPista(modo = 'diccionario') {
      if (this.terminada) return null;
      const pal = this.palabraActiva;
      if (!pal) return null;
      this.pistasUsadas += 1;
      this._persistirYNotificar();
      if (modo === 'inicial') {
        return { modo, contenido: (pal.palabraCorrecta || '').charAt(0) };
      }
      return { modo: 'diccionario', contenido: pal.pistaDiccionario || '' };
    }

    /**
     * Cambia la palabra activa a la posición elegida por el jugador.
     * Devuelve `true` si efectivamente cambió. Rechaza con `false` si
     * la partida ya terminó, el índice es inválido, la palabra ya está
     * completada, o ya era la activa.
     */
    seleccionarSlot(idx) {
      if (this.terminada) return false;
      if (typeof idx !== 'number' || idx < 0 || idx >= this.slots.length) return false;
      if (this.slots[idx].completada) return false;
      if (this.activeIndex === idx) return false;
      this.activeIndex = idx;
      this._persistirYNotificar();
      return true;
    }

    reiniciar() {
      this._iniciarLimpio();
      this._persistirYNotificar();
    }

    // ──────────────────────────── internos ──

    _avanzarSlot() {
      for (let i = 0; i < this.slots.length; i++) {
        if (!this.slots[i].completada) {
          this.activeIndex = i;
          return;
        }
      }
      this.activeIndex = this.slots.length - 1;
    }

    _persistirYNotificar() {
      if (this.autosave) Storage.save(this.puzzleId, this.snapshot());
      if (this.onChange) {
        try { this.onChange(this); } catch (_e) { /* aislar al motor */ }
      }
    }

    snapshot() {
      return {
        puzzleId: this.puzzleId,
        fecha: this.fecha,
        slots: this.slots.map((s) => ({
          canon: s.canon.slice(),
          fijadas: s.fijadas.slice(),
          contiene: s.contiene.slice(),
          intentos: s.intentos,
          completada: s.completada
        })),
        activeIndex: this.activeIndex,
        cementerio: this.cementerio.slice(),
        pistasUsadas: this.pistasUsadas,
        status: this.status,
        startedAt: this.startedAt,
        finishedAt: this.finishedAt
      };
    }
  }

  global.Litlapse = global.Litlapse || {};
  global.Litlapse.State = { GameState, STATUS, INTENTOS_POR_PALABRA };
})(typeof window !== 'undefined' ? window : globalThis);
