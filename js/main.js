/**
 * litlapse · main.js
 * --------------------------------------------------------------
 * Bootstrap. Selecciona el eclipse del día, instancia el estado
 * (con rehidratación desde localStorage) y monta el motor sobre
 * el DOM. Si la partida del día ya está en VICTORIA al cargar,
 * el motor renderiza directamente la postal sin pasar por el
 * flujo de juego.
 * --------------------------------------------------------------
 */
(function (global) {
  'use strict';

  function arrancar() {
    const { Puzzles, State, Engine } = global.Litlapse;
    const puzzle = Puzzles.getTodaysPuzzle();
    if (!puzzle) {
      console.warn('[Litlapse] No hay puzzle disponible para hoy.');
      return;
    }
    const state = new State.GameState(puzzle, { autosave: true });
    const engine = new Engine.GameEngine(puzzle, state, {
      root: global.document,
      modoPista: 'diccionario'
    });
    // Expuesto sólo para inspección manual en consola; no es API pública.
    global.Litlapse.__debug = { puzzle, state, engine };
  }

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', arrancar, { once: true });
  } else {
    arrancar();
  }
})(typeof window !== 'undefined' ? window : globalThis);
