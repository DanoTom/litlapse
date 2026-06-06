/**
 * litlapse · engine.js
 * --------------------------------------------------------------
 * Motor de presentación. Render del fragmento como casilleros de
 * letras (slots), conexión con el estado deductivo, modal de postal,
 * pantalla "cómo se juega" y onboarding inline.
 * --------------------------------------------------------------
 */
(function (global) {
  'use strict';

  const { Utils, Share } = global.Litlapse;
  const { STATUS, INTENTOS_POR_PALABRA } = global.Litlapse.State;

  /** Romanos de 1 a 39. Fuera de rango devuelve el arábigo crudo. */
  function _aRomano(n) {
    if (typeof n !== 'number' || n < 1 || n > 39) return String(n);
    const tabla = [['XXX', 30], ['XX', 20], ['X', 10], ['IX', 9],
                   ['V', 5], ['IV', 4], ['I', 1]];
    let r = '';
    for (const [s, v] of tabla) { while (n >= v) { r += s; n -= v; } }
    return r;
  }

  /** Lee/escribe el listado de puzzles resueltos en este navegador. */
  function _leerEclipses() {
    try {
      const raw = global.localStorage.getItem('litlapse:eclipses');
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (_e) { return []; }
  }
  function _guardarEclipses(arr) {
    try { global.localStorage.setItem('litlapse:eclipses', JSON.stringify(arr)); }
    catch (_e) { /* silent */ }
  }

  class GameEngine {
    constructor(puzzle, state, opts = {}) {
      this.puzzle = puzzle;
      this.state = state;
      this.root = opts.root || global.document;
      this.modoPista = opts.modoPista === 'inicial' ? 'inicial' : 'diccionario';

      this.els = this._querySelectores();
      this.tokens = Utils.tokenize(puzzle.textoOriginal);

      this._fijadasFrescas = new Map();
      this._postalDataUrl = null;
      this.state.onChange = () => this.render();

      this._enlazarEventos();
      this._ajustarInputAlSlot();
      this.render();
      this._mostrarTipInicial();
      this._enfocarInput();
    }

    _querySelectores() {
      const $ = (sel) => this.root.querySelector(sel);
      const $$ = (sel) => Array.from(this.root.querySelectorAll(sel));
      return {
        fragment: $('[data-litlapse="fragment"]'),
        fragmentsTodos: $$('[data-litlapse="fragment"]'),
        input: $('[data-litlapse="input"]'),
        form: $('[data-litlapse="form"]'),
        susurro: $('[data-litlapse="susurro"]'),
        graveyard: $('[data-litlapse="graveyard"]'),
        attempts: $('[data-litlapse="attempts"]'),
        found: $('[data-litlapse="found"]'),
        wordAttempts: $('[data-litlapse="word-attempts"]'),
        wordTabs: $('[data-litlapse="word-tabs"]'),
        hintBtn: $('[data-litlapse="hint-btn"]'),
        hintOut: $('[data-litlapse="hint-out"]'),
        shareBtn: $('[data-litlapse="share-btn"]'),
        shareOut: $('[data-litlapse="share-out"]'),
        imageBtn: $('[data-litlapse="image-btn"]'),
        screenPlay: $('[data-litlapse="screen-play"]'),
        screenWin: $('[data-litlapse="screen-win"]'),
        screenLose: $('[data-litlapse="screen-lose"]'),
        screenHowto: $('[data-litlapse="screen-howto"]'),
        howtoLink: $('[data-litlapse="howto-link"]'),
        howtoBack: $('[data-litlapse="howto-back"]'),
        attribution: $('[data-litlapse="attribution"]'),
        postalModal: $('[data-litlapse="postal-modal"]'),
        postalStage: $('[data-litlapse="postal-stage"]'),
        postalWrap: $('[data-litlapse="postal-wrap"]'),
        postalPreview: $('[data-litlapse="postal-preview"]'),
        postalShareBtn: $('[data-litlapse="postal-share-btn"]'),
        postalCloseBtn: $('[data-litlapse="postal-close-btn"]'),
        postalOut: $('[data-litlapse="postal-out"]'),
        tipInput: $('[data-litlapse="tip-input"]'),
        streak: $('[data-litlapse="streak"]')
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
          this._compartirResultado();
        });
      }

      const { imageBtn, postalShareBtn, postalCloseBtn, postalModal } = this.els;
      if (imageBtn) {
        imageBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this._abrirPostal();
        });
      }
      if (postalShareBtn) {
        postalShareBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this._compartirImagen();
        });
      }
      if (postalCloseBtn) {
        postalCloseBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this._cerrarPostal();
        });
      }
      if (postalModal) {
        postalModal.addEventListener('click', (e) => {
          if (e.target === postalModal) this._cerrarPostal();
        });
      }

      const { howtoLink, howtoBack, screenHowto } = this.els;
      if (howtoLink) {
        howtoLink.addEventListener('click', (e) => {
          e.preventDefault();
          this._abrirHowto();
        });
      }
      if (howtoBack) {
        howtoBack.addEventListener('click', (e) => {
          e.preventDefault();
          this._cerrarHowto();
        });
      }

      this.root.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (postalModal && !postalModal.hidden) {
          this._cerrarPostal();
        } else if (screenHowto && !screenHowto.hidden) {
          this._cerrarHowto();
        }
      });
      global.addEventListener('resize', () => {
        if (postalModal && !postalModal.hidden) this._escalarPostal();
      });

      // Click sobre cualquier elipsis del fragmento la activa, si el
      // estado lo permite. Permite saltar el orden lineal de palabras.
      // Con fallback: si el tap cae en el espacio entre palabras (target
      // pequeño en mobile), buscamos la elipsis más cercana de la misma
      // línea por distancia horizontal, hasta ~80px de tolerancia.
      this.els.fragmentsTodos.forEach((host) => {
        host.addEventListener('click', (e) => {
          let target = e.target.closest('.elipsis[data-slot]');
          if (!target) target = this._elipsisMasCercana(host, e.clientX, e.clientY);
          if (!target) return;
          const idx = Number(target.dataset.slot);
          if (Number.isNaN(idx)) return;
          if (this.state.seleccionarSlot(idx)) {
            this._enfocarInput();
          }
        });
      });

      // Tabs "palabra I · II · III": botones nativos, target grande,
      // funcionan con o sin teclado virtual abierto.
      if (this.els.wordTabs) {
        this.els.wordTabs.addEventListener('click', (e) => {
          const btn = e.target.closest('button[data-tab]');
          if (!btn) return;
          e.preventDefault();
          const idx = Number(btn.dataset.tab);
          if (Number.isNaN(idx)) return;
          if (this.state.seleccionarSlot(idx)) {
            this._enfocarInput();
          }
        });
      }
    }

    _elipsisMasCercana(host, x, y) {
      const candidatos = host.querySelectorAll('.elipsis[data-slot]');
      let best = null;
      let bestDist = Infinity;
      for (const c of candidatos) {
        const r = c.getBoundingClientRect();
        // Sólo consideramos elipses cuya línea contiene el tap (con
        // tolerancia de 8px arriba/abajo).
        if (y < r.top - 8 || y > r.bottom + 8) continue;
        const cx = (r.left + r.right) / 2;
        const dist = Math.abs(cx - x);
        if (dist < bestDist) { bestDist = dist; best = c; }
      }
      return bestDist < 80 ? best : null;
    }

    _abrirHowto() {
      const { screenHowto, screenPlay, screenWin, screenLose } = this.els;
      if (!screenHowto) return;
      if (screenPlay) screenPlay.hidden = true;
      if (screenWin) screenWin.hidden = true;
      if (screenLose) screenLose.hidden = true;
      screenHowto.hidden = false;
      global.document.body.classList.add('in-howto');
      global.scrollTo(0, 0);
    }

    _cerrarHowto() {
      const { screenHowto } = this.els;
      if (!screenHowto) return;
      screenHowto.hidden = true;
      global.document.body.classList.remove('in-howto');
      this.render();
    }

    _procesarEntrada() {
      const input = this.els.input;
      if (!input || this.state.terminada) return;

      const valor = input.value;
      const resultado = this.state.intentar(valor);

      // El primer intento (sea válido o no) cierra el tip de onboarding.
      if (resultado.tipo !== 'IGNORADO') this._ocultarTipInicial();

      if (resultado.tipo === 'LARGO_INVALIDO') {
        this._vibrar(input);
        this._mensajeBreve(resultado.motivo);
        return;
      }

      if (resultado.tipo === 'COMPLETADA') {
        this._registrarFijadas(resultado.slotIndex, resultado.posicionesFijadasAhora);
        input.value = '';
        this._enfocarInput();
        return;
      }

      if (resultado.tipo === 'PARCIAL' || resultado.tipo === 'AGOTADA') {
        this._registrarFijadas(this.state.activeIndex, resultado.posicionesFijadasAhora);
        if (!resultado.posicionesFijadasAhora.length) this._vibrar(input);
        input.value = '';
        this._enfocarInput();
        return;
      }

      input.value = '';
    }

    _registrarFijadas(slotIndex, posiciones) {
      if (!posiciones || !posiciones.length) return;
      let set = this._fijadasFrescas.get(slotIndex);
      if (!set) { set = new Set(); this._fijadasFrescas.set(slotIndex, set); }
      posiciones.forEach((p) => set.add(p));
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

    _mensajeBreve(texto) {
      const out = this.els.hintOut;
      if (!out || !texto) return;
      out.textContent = texto;
      out.classList.add('is-visible');
    }

    _enfocarInput() {
      const input = this.els.input;
      if (!input || this.state.terminada) return;
      global.requestAnimationFrame(() => {
        try { input.focus({ preventScroll: true }); } catch (_e) { input.focus(); }
      });
    }

    _ajustarInputAlSlot() {
      const input = this.els.input;
      if (!input) return;
      const largo = this.state.largoEsperado;
      if (largo > 0) {
        input.maxLength = largo;
        // Ancho generoso: nunca menos de 18ch (línea editorial larga),
        // + 2ch de aire para palabras especialmente largas.
        input.style.width = `${Math.max(18, largo + 2)}ch`;
        input.setAttribute('aria-label',
          `Escribe la palabra de ${largo} letras y pulsa Enter`);
      }
    }

    _mostrarPista() {
      if (this.state.terminada) return;
      const pista = this.state.pedirPista(this.modoPista);
      if (!pista || !this.els.hintOut) return;
      const out = this.els.hintOut;
      out.textContent = pista.modo === 'inicial'
        ? `Comienza con la letra «${pista.contenido}».`
        : pista.contenido;
      out.classList.add('is-visible');
    }

    async _compartirResultado() {
      if (this.state.status !== STATUS.VICTORIA) return;
      const texto = Share.build(this.puzzle, this.state.snapshot());
      const ok = await Share.copiar(texto);
      const out = this.els.shareOut;
      if (out) {
        out.textContent = ok
          ? 'Resultado copiado al portapapeles.'
          : 'No se pudo copiar. Copia manual:\n' + texto;
        out.classList.add('is-visible');
      }
    }

    // ──────────────────────────── postal visual ──

    _abrirPostal() {
      if (this.state.status !== STATUS.VICTORIA) return;
      const html = this._postalHtml();
      const preview = this.els.postalPreview;
      if (preview) {
        // Reset a modo HTML por si quedó en `has-img` de una apertura previa.
        preview.classList.remove('has-img');
        preview.innerHTML = html;
      }
      const modal = this.els.postalModal;
      if (!modal) return;
      modal.hidden = false;
      this._escalarPostal();
      global.document.body.style.overflow = 'hidden';
      if (this.els.postalOut) this.els.postalOut.textContent = '';

      // Generamos el PNG en segundo plano. Cuando esté listo:
      //  - Reemplazamos el preview HTML por una <img> real → el usuario
      //    puede tocar-y-mantener para "Guardar imagen" en su galería.
      //  - Cacheamos el dataUrl para que el botón "guardar o compartir"
      //    sea instantáneo y no tenga que regenerar el PNG.
      this._postalDataUrl = null;
      this._generarPostalPng();
    }

    _cerrarPostal() {
      const modal = this.els.postalModal;
      if (!modal) return;
      modal.hidden = true;
      global.document.body.style.overflow = '';
    }

    _escalarPostal() {
      const wrap = this.els.postalWrap;
      const stage = this.els.postalStage;
      if (!wrap || !stage) return;
      const margenVertical = 220;
      const margenLateral = 48;
      const vh = Math.max(380, global.innerHeight - margenVertical);
      const vw = Math.max(280, global.innerWidth - margenLateral);
      const escala = Math.min(1, vh / 960, vw / 540);
      wrap.style.transform = `scale(${escala})`;
      stage.style.width = `${540 * escala}px`;
      stage.style.height = `${960 * escala}px`;
    }

    /**
     * Pre-genera el PNG de la postal al abrir el modal. Cuando termina,
     * swap el preview HTML por una <img>. Esto resuelve dos problemas:
     *  (a) En mobile, tocar y mantener una <img> ofrece "Guardar imagen"
     *      → la imagen va a la galería, en vez de quedar como archivo
     *      en Descargas (el comportamiento del Web Share fallback).
     *  (b) El botón "guardar o compartir" ya no tiene que regenerar el
     *      PNG, así el share es instantáneo.
     */
    async _generarPostalPng() {
      if (!global.htmlToImage) return;
      const wrapper = global.document.createElement('div');
      wrapper.setAttribute('aria-hidden', 'true');
      wrapper.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;left:0;top:0;';
      const postal = global.document.createElement('div');
      postal.className = 'postal';
      postal.innerHTML = this._postalHtml();
      wrapper.appendChild(postal);
      global.document.body.appendChild(wrapper);

      try {
        await new Promise((r) => global.requestAnimationFrame(r));
        const dataUrl = await global.htmlToImage.toPng(postal, {
          pixelRatio: 2,
          cacheBust: true,
          backgroundColor: '#f6f3eb'
        });
        this._postalDataUrl = dataUrl;
        // Si el modal sigue abierto, sustituimos el preview por <img>.
        const preview = this.els.postalPreview;
        const modal = this.els.postalModal;
        if (preview && modal && !modal.hidden) {
          preview.classList.add('has-img');
          preview.innerHTML =
            `<img src="${dataUrl}" alt="Postal del eclipse de hoy" draggable="false" />`;
        }
      } catch (_e) {
        // Silent: el preview HTML queda visible y el botón share regenera
        // sobre la marcha si el usuario lo intenta.
      } finally {
        wrapper.remove();
      }
    }

    async _compartirImagen() {
      const out = this.els.postalOut;
      const setOut = (txt) => { if (out) out.textContent = txt; };
      if (!global.htmlToImage) {
        setOut('No se pudo cargar el motor de imagen.');
        return;
      }

      // Si el PNG ya está cacheado, compartimos directo sin regenerar.
      if (this._postalDataUrl) {
        setOut('Compartiendo…');
        try {
          const blob = await (await fetch(this._postalDataUrl)).blob();
          const file = new File([blob], `litlapse-${this.puzzle.id}.png`, { type: 'image/png' });
          const nav = global.navigator;
          if (nav && typeof nav.share === 'function') {
            const puedeShare = typeof nav.canShare !== 'function'
              || nav.canShare({ files: [file] });
            if (puedeShare) {
              try {
                await nav.share({
                  files: [file],
                  title: `Litlapse — Día #${this.puzzle.id}`
                });
                setOut('');
                return;
              } catch (_e) { /* fallback abajo */ }
            }
          }
          // Fallback: descarga directa.
          const a = global.document.createElement('a');
          a.href = this._postalDataUrl;
          a.download = `litlapse-${this.puzzle.id}.png`;
          global.document.body.appendChild(a);
          a.click();
          a.remove();
          setOut('Imagen descargada.');
          return;
        } catch (_e) {
          setOut('No se pudo compartir. Tocá y mantené la imagen para guardarla.');
          return;
        }
      }

      // Sin caché (caso muy raro): generamos sobre la marcha.
      setOut('Generando imagen…');
      const wrapper = global.document.createElement('div');
      wrapper.setAttribute('aria-hidden', 'true');
      wrapper.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;left:0;top:0;';
      const postal = global.document.createElement('div');
      postal.className = 'postal';
      postal.innerHTML = this._postalHtml();
      wrapper.appendChild(postal);
      global.document.body.appendChild(wrapper);

      try {
        await new Promise((r) => global.requestAnimationFrame(r));
        const result = await Share.compartirImagen(postal, this.puzzle);
        if (!result.ok) {
          setOut('No se pudo generar la imagen.');
          return;
        }
        setOut(result.modo === 'share' ? '' : 'Imagen descargada.');
      } finally {
        wrapper.remove();
      }
    }

    _postalHtml() {
      const ocultas = new Map();
      this.puzzle.palabrasOcultas.forEach((p, slot) => {
        ocultas.set(p.indicePalabra, { ...p, slot });
      });
      const fragmento = this.tokens.map((token, i) => {
        if (!ocultas.has(i)) return Utils.escapeHtml(token);
        const { prefijo, raiz, sufijo } = Utils.splitPunctuation(token);
        return `${Utils.escapeHtml(prefijo)}<span class="postal-revealed">${Utils.escapeHtml(raiz)}</span>${Utils.escapeHtml(sufijo)}`;
      }).join(' ');

      const idStr = String(this.puzzle.id).padStart(2, '0');
      const intentos = this.state.totalIntentos;
      const intentoStr = `${intentos} intento${intentos === 1 ? '' : 's'}`;

      return [
        `<div class="postal-mark">`,
          `<span class="postal-logo">L I T L A P S E</span>`,
          `<span class="postal-num">№${idStr}</span>`,
        `</div>`,
        `<p class="postal-frag">${fragmento}</p>`,
        `<div class="postal-attrib">`,
          `${Utils.escapeHtml(this.puzzle.autor)}`,
          `<em>${Utils.escapeHtml(this.puzzle.obra)} · ${Utils.escapeHtml(this.puzzle['año'])}</em>`,
        `</div>`,
        `<div class="postal-foot">`,
          `<span>Litlapse #${this.puzzle.id} · resuelto en ${intentoStr}</span>`,
          `<span class="postal-seal">L</span>`,
        `</div>`
      ].join('');
    }

    // ──────────────────────────── render ──

    render() {
      this._renderPantalla();
      this._renderFragmento();
      this._renderSusurro();
      this._renderCementerio();
      this._renderContadores();
      this._renderWordTabs();
      this._renderAtribucion();
      this._renderBotonesEstado();
      this._actualizarStreak();
      this._ajustarInputAlSlot();
      this._fijadasFrescas = new Map();
    }

    _renderWordTabs() {
      const host = this.els.wordTabs;
      if (!host) return;
      if (this.state.terminada) {
        host.hidden = true;
        host.innerHTML = '';
        return;
      }
      host.hidden = false;
      const romanos = ['I', 'II', 'III', 'IV', 'V', 'VI'];
      const piezas = this.state.slots.map((s, i) => {
        const cls = ['word-tab'];
        if (s.completada) cls.push('is-done');
        else if (i === this.state.activeIndex) cls.push('is-active');
        const aria = s.completada
          ? `palabra ${romanos[i] || (i + 1)} resuelta`
          : (i === this.state.activeIndex
              ? `palabra ${romanos[i] || (i + 1)} activa`
              : `cambiar a palabra ${romanos[i] || (i + 1)}`);
        const disabled = s.completada ? ' disabled aria-disabled="true"' : '';
        return `<button type="button" class="${cls.join(' ')}" data-tab="${i}" aria-label="${aria}"${disabled}>${romanos[i] || (i + 1)}</button>`;
      });
      const labelPalabra = `<span class="word-tabs-label">palabra</span>`;
      host.innerHTML = labelPalabra + piezas.join('<span class="word-tab-sep" aria-hidden="true">·</span>');
    }

    _renderPantalla() {
      const { screenHowto, screenPlay, screenWin, screenLose } = this.els;
      if (screenHowto && !screenHowto.hidden) return;
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
      const hosts = this.els.fragmentsTodos;
      if (!hosts || !hosts.length) return;

      const ocultas = new Map();
      this.puzzle.palabrasOcultas.forEach((p, slot) => {
        ocultas.set(p.indicePalabra, { ...p, slot });
      });

      const partes = this.tokens.map((token, i) => {
        if (!ocultas.has(i)) return Utils.escapeHtml(token);
        const oculta = ocultas.get(i);
        const { prefijo, sufijo } = Utils.splitPunctuation(token);
        const safePre = Utils.escapeHtml(prefijo);
        const safeSuf = Utils.escapeHtml(sufijo);
        const dentro = this._renderElipsis(oculta.slot);
        return `${safePre}${dentro}${safeSuf}`;
      });

      const html = partes.join(' ');
      hosts.forEach((host) => { host.innerHTML = html; });
    }

    _renderElipsis(slotIndex) {
      const slot = this.state.slots[slotIndex];
      const status = this.state.status;
      const esActiva = !this.state.terminada && slotIndex === this.state.activeIndex;
      const frescas = this._fijadasFrescas.get(slotIndex) || new Set();
      const aria = `palabra ${slotIndex + 1} de ${this.state.totalPalabras}`;

      if (status === STATUS.DERROTA && !slot.completada) {
        const texto = Utils.escapeHtml(slot.canon.join(''));
        return `<span class="elipsis revelada-fallida" data-slot="${slotIndex}" aria-label="${aria}">${texto}</span>`;
      }

      const clases = ['elipsis'];
      if (esActiva) clases.push('active');
      if (slot.completada) clases.push('completada');
      if (status === STATUS.VICTORIA) clases.push('en-victoria');

      const letras = slot.canon.map((letraCanon, pos) => {
        const fijada = slot.fijadas[pos];
        if (!fijada) {
          return `<span class="letra-slot vacia" aria-hidden="true"></span>`;
        }
        const recien = frescas.has(pos);
        const cls = recien ? 'letra-slot fijada nueva' : 'letra-slot fijada';
        return `<span class="${cls}">${Utils.escapeHtml(letraCanon)}</span>`;
      }).join('');

      return `<span class="${clases.join(' ')}" data-slot="${slotIndex}" aria-label="${aria}">${letras}</span>`;
    }

    _renderSusurro() {
      const host = this.els.susurro;
      if (!host) return;
      const slot = this.state.slotActivo;
      if (!slot || this.state.terminada) {
        host.textContent = '';
        host.classList.remove('is-visible');
        return;
      }
      const vigentes = slot.contiene.filter((ch) =>
        slot.norm.some((c, k) => c === ch && !slot.fijadas[k])
      );
      if (!vigentes.length) {
        host.textContent = '';
        host.classList.remove('is-visible');
        return;
      }
      // Cada letra va en su propio <span> con `--i` para el stagger CSS.
      const letras = vigentes
        .slice()
        .sort()
        .map((c, i) => `<span style="--i:${i}">${Utils.escapeHtml(c.toUpperCase())}</span>`)
        .join(', ');
      host.innerHTML = `Contiene: <strong>${letras}</strong>`;
      host.classList.add('is-visible');
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
      const slotRef = this.state.slotActivo;
      const setObjetivo = slotRef ? new Set(slotRef.norm) : null;

      const items = palabras.map((w) => {
        const letras = Array.from(w).map((ch) => {
          const ausente = setObjetivo ? !setObjetivo.has(ch) : false;
          const cls = ausente ? 'letra-grave letra-inexistente' : 'letra-grave';
          return `<i class="${cls}">${Utils.escapeHtml(ch)}</i>`;
        }).join('');
        return `<span class="grave-palabra">${letras}</span>`;
      }).join('');

      host.innerHTML = items;
      host.classList.add('is-populated');
    }

    _renderContadores() {
      const { attempts, found, wordAttempts } = this.els;
      if (attempts) attempts.textContent = String(this.state.totalIntentos);
      if (found) found.textContent = `${this.state.aciertos}/${this.state.totalPalabras}`;
      if (wordAttempts) {
        const slot = this.state.slotActivo;
        const usados = slot ? slot.intentos : 0;
        wordAttempts.textContent = `${usados}/${INTENTOS_POR_PALABRA}`;
      }
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
      const { hintBtn, shareBtn, imageBtn, input } = this.els;
      if (hintBtn) hintBtn.disabled = this.state.terminada;
      if (input) input.disabled = this.state.terminada;
      const enVictoria = this.state.status === STATUS.VICTORIA;
      if (shareBtn) shareBtn.hidden = !enVictoria;
      if (imageBtn) imageBtn.hidden = !enVictoria;
      if (this.state.terminada) this._ocultarTipInicial({ silencioso: true });
    }

    // ──────────────────────────── onboarding inline ──

    _mostrarTipInicial() {
      const tip = this.els.tipInput;
      if (!tip) return;
      if (this.state.terminada) return;
      try {
        if (global.localStorage.getItem('litlapse:tip-input')) return;
      } catch (_e) { return; }
      tip.hidden = false;
    }

    _ocultarTipInicial(opts) {
      const tip = this.els.tipInput;
      if (!tip || tip.hidden) return;
      tip.hidden = true;
      if (!opts || !opts.silencioso) {
        try { global.localStorage.setItem('litlapse:tip-input', '1'); }
        catch (_e) { /* silent */ }
      }
    }

    // ──────────────────────────── eclipses resueltos ──

    _actualizarStreak() {
      const el = this.els.streak;
      if (!el) return;
      let lista = _leerEclipses();
      if (this.state.status === STATUS.VICTORIA && !lista.includes(this.puzzle.id)) {
        lista.push(this.puzzle.id);
        _guardarEclipses(lista);
      }
      if (lista.length === 0) {
        el.hidden = true;
        el.textContent = '';
        return;
      }
      const n = lista.length;
      el.hidden = false;
      el.textContent = n === 1
        ? '1 eclipse resuelto'
        : `${_aRomano(n)} eclipses resueltos`;
    }
  }

  global.Litlapse = global.Litlapse || {};
  global.Litlapse.Engine = { GameEngine };
})(typeof window !== 'undefined' ? window : globalThis);
