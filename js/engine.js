/**
 * litlapse · engine.js
 * --------------------------------------------------------------
 * Motor de presentación. Conecta el estado de juego con el DOM:
 * renderiza el fragmento, mantiene el input fantasma, gestiona
 * la pulsación de Enter, anima los aciertos y resuelve las
 * pantallas de victoria/derrota.
 *
 * Selectores que espera (todos opcionales: si no están, se ignoran):
 *
 *   [data-litlapse="fragment"]    contenedor del párrafo con elipsis
 *   [data-litlapse="input"]       <input> de texto
 *   [data-litlapse="form"]        <form> que envuelve al input (opcional)
 *   [data-litlapse="graveyard"]   contenedor del cementerio (<ul> o <div>)
 *   [data-litlapse="lives"]       contador de vidas restantes
 *   [data-litlapse="attempts"]    contador de intentos
 *   [data-litlapse="found"]       contador de palabras encontradas (n/3)
 *   [data-litlapse="hint-btn"]    botón de auxilio
 *   [data-litlapse="hint-out"]    contenedor donde aparece la pista
 *   [data-litlapse="share-btn"]   botón de compartir (sólo en victoria)
 *   [data-litlapse="share-out"]   feedback "copiado al portapapeles"
 *   [data-litlapse="screen-play"] pantalla "jugando"
 *   [data-litlapse="screen-win"]  pantalla "eclipse resuelto"
 *   [data-litlapse="screen-lose"] pantalla "derrota"
 *   [data-litlapse="attribution"] bloque autor/obra/año (postal/victoria)
 * --------------------------------------------------------------
 */
(function (global) {
  'use strict';

  const { Utils, Share } = global.Litlapse;
  const { STATUS } = global.Litlapse.State;

  class GameEngine {
    /**
     * @param {object} puzzle
     * @param {GameState} state
     * @param {object} [opts]
     * @param {Document|HTMLElement} [opts.root=document]  Raíz para los queries.
     * @param {'inicial'|'diccionario'} [opts.modoPista='diccionario']
     */
    constructor(puzzle, state, opts = {}) {
      this.puzzle = puzzle;
      this.state = state;
      this.root = opts.root || global.document;
      this.modoPista = opts.modoPista === 'inicial' ? 'inicial' : 'diccionario';

      this.els = this._querySelectores();
      this.tokens = Utils.tokenize(puzzle.textoOriginal);

      // El estado avisará al motor en cada mutación.
      this.state.onChange = () => this.render();

      this._enlazarEventos();
      this.render();
      this._enfocarInput();
    }

    // ──────────────────────────── DOM lookup ──

    _querySelectores() {
      const $ = (sel) => this.root.querySelector(sel);
      return {
        fragment: $('[data-litlapse="fragment"]'),
        input: $('[data-litlapse="input"]'),
        form: $('[data-litlapse="form"]'),
        graveyard: $('[data-litlapse="graveyard"]'),
        lives: $('[data-litlapse="lives"]'),
        attempts: $('[data-litlapse="attempts"]'),
        found: $('[data-litlapse="found"]'),
        hintBtn: $('[data-litlapse="hint-btn"]'),
        hintOut: $('[data-litlapse="hint-out"]'),
        shareBtn: $('[data-litlapse="share-btn"]'),
        shareOut: $('[data-litlapse="share-out"]'),
        screenPlay: $('[data-litlapse="screen-play"]'),
        screenWin: $('[data-litlapse="screen-win"]'),
        screenLose: $('[data-litlapse="screen-lose"]'),
        attribution: $('[data-litlapse="attribution"]')
      };
    }

    _enlazarEventos() {
      const { input, form, hintBtn, shareBtn } = this.els;

      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          this._procesarEntrada();
        });
      } else if (input) {
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this._procesarEntrada();
          }
        });
      }

      if (hintBtn) {
        hintBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this._mostrarPista();
        });
      }

      if (shareBtn) {
        shareBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this._compartir();
        });
      }
    }

    // ──────────────────────────── entrada del usuario ──

    _procesarEntrada() {
      const input = this.els.input;
      if (!input || this.state.terminada) return;

      const valor = input.value;
      const resultado = this.state.intentar(valor);

      if (resultado.tipo === 'ACIERTO') {
        input.value = '';
        // El render ya ocurre por onChange; sólo agregamos el efecto vibratorio inverso (none).
        this._enfocarInput();
      } else if (resultado.tipo === 'ERROR') {
        this._vibrar(input);
        input.value = '';
        this._enfocarInput();
      } else {
        input.value = '';
      }
    }

    _vibrar(el) {
      if (!el || !el.animate) return;
      const reduce = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) return;
      el.animate(
        [
          { transform: 'translateX(0)' },
          { transform: 'translateX(-6px)' },
          { transform: 'translateX(6px)' },
          { transform: 'translateX(-4px)' },
          { transform: 'translateX(0)' }
        ],
        { duration: 180, easing: 'ease-out' }
      );
    }

    _enfocarInput() {
      const input = this.els.input;
      if (!input || this.state.terminada) return;
      // Defer al siguiente tick para no pelearse con el render del navegador.
      global.requestAnimationFrame(() => {
        try { input.focus({ preventScroll: true }); } catch (_e) { input.focus(); }
      });
    }

    _mostrarPista() {
      if (this.state.terminada) return;
      const pista = this.state.pedirPista(this.modoPista);
      if (!pista || !this.els.hintOut) return;
      const out = this.els.hintOut;
      if (pista.modo === 'inicial') {
        out.textContent = `Comienza con la letra «${pista.contenido}».`;
      } else {
        out.textContent = pista.contenido;
      }
      out.classList.add('is-visible');
    }

    async _compartir() {
      if (this.state.status !== STATUS.VICTORIA) return;
      const texto = Share.build(this.puzzle, this.state.snapshot());
      const ok = await Share.copiar(texto);
      const out = this.els.shareOut;
      if (out) {
        out.textContent = ok ? 'Copiado al portapapeles.' : 'No se pudo copiar. Copia manual:\n' + texto;
        out.classList.add('is-visible');
      }
    }

    // ──────────────────────────── render ──

    render() {
      this._renderPantalla();
      this._renderFragmento();
      this._renderCementerio();
      this._renderContadores();
      this._renderAtribucion();
      this._renderBotonesEstado();
    }

    _renderPantalla() {
      const { screenPlay, screenWin, screenLose } = this.els;
      const s = this.state.status;
      const toggle = (el, on) => {
        if (!el) return;
        el.hidden = !on;
        el.classList.toggle('is-active', !!on);
      };
      toggle(screenPlay, s === STATUS.JUGANDO);
      toggle(screenWin, s === STATUS.VICTORIA);
      toggle(screenLose, s === STATUS.DERROTA);
    }

    _renderFragmento() {
      const host = this.els.fragment;
      if (!host) return;

      // Mapa indicePalabra → palabraOculta para lookup O(1).
      const ocultas = new Map();
      this.puzzle.palabrasOcultas.forEach((p, slot) => {
        ocultas.set(p.indicePalabra, { ...p, slot });
      });

      const partes = this.tokens.map((token, i) => {
        if (!ocultas.has(i)) return Utils.escapeHtml(token);

        const oculta = ocultas.get(i);
        const { prefijo, raiz, sufijo } = Utils.splitPunctuation(token);
        const encontrada = this.state.encontradas[oculta.slot];
        const esActiva = !this.state.terminada && oculta.slot === this.state.activeIndex;
        const reveladaPorVictoria = this.state.status === STATUS.VICTORIA;
        const reveladaPorDerrota = this.state.status === STATUS.DERROTA;

        const safePre = Utils.escapeHtml(prefijo);
        const safeSuf = Utils.escapeHtml(sufijo);
        const safeRaiz = Utils.escapeHtml(raiz || oculta.palabraCorrecta);

        if (encontrada || reveladaPorVictoria) {
          const cls = encontrada && this.state.status === STATUS.JUGANDO
            ? 'litlapse-revealed reveal'
            : 'litlapse-revealed';
          return `${safePre}<span class="${cls}" data-slot="${oculta.slot}">${safeRaiz}</span>${safeSuf}`;
        }

        if (reveladaPorDerrota) {
          // En derrota mostramos las omitidas tachadas en su sitio.
          return `${safePre}<span class="litlapse-failed">${safeRaiz}</span>${safeSuf}`;
        }

        const widthEm = Utils.elipsisWidthEm(oculta.palabraCorrecta);
        const klass = esActiva ? 'elipsis active' : 'elipsis';
        const aria = `palabra ${oculta.slot + 1} de ${this.puzzle.palabrasOcultas.length}`;
        return `${safePre}<span class="${klass}" data-slot="${oculta.slot}" style="width:${widthEm}em" aria-label="${aria}">&nbsp;</span>${safeSuf}`;
      });

      host.innerHTML = partes.join(' ');
    }

    _renderCementerio() {
      const host = this.els.graveyard;
      if (!host) return;
      const palabras = this.state.cementerio;
      if (!palabras.length) {
        host.innerHTML = '';
        host.classList.remove('is-populated');
        return;
      }
      const items = palabras
        .map((w) => `<span>${Utils.escapeHtml(w)}</span>`)
        .join('');
      host.innerHTML = items;
      host.classList.add('is-populated');
    }

    _renderContadores() {
      const { lives, attempts, found } = this.els;
      if (lives) lives.textContent = String(this.state.vidas);
      if (attempts) attempts.textContent = String(this.state.totalIntentos);
      if (found) found.textContent = `${this.state.aciertos}/${this.state.totalPalabras}`;
    }

    _renderAtribucion() {
      const host = this.els.attribution;
      if (!host) return;
      if (this.state.status === STATUS.JUGANDO) {
        host.hidden = true;
        return;
      }
      host.hidden = false;
      host.innerHTML = [
        `<div class="litlapse-author">${Utils.escapeHtml(this.puzzle.autor)}</div>`,
        `<div class="litlapse-work"><em>${Utils.escapeHtml(this.puzzle.obra)}</em> · ${Utils.escapeHtml(this.puzzle['año'])}</div>`
      ].join('');
    }

    _renderBotonesEstado() {
      const { hintBtn, shareBtn, input } = this.els;
      if (hintBtn) hintBtn.disabled = this.state.terminada;
      if (input) input.disabled = this.state.terminada;
      if (shareBtn) shareBtn.hidden = this.state.status !== STATUS.VICTORIA;
    }
  }

  global.Litlapse = global.Litlapse || {};
  global.Litlapse.Engine = { GameEngine };
})(typeof window !== 'undefined' ? window : globalThis);
