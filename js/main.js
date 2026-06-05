/**
 * litlapse · main.js
 * --------------------------------------------------------------
 * Bootstrap. Selecciona el eclipse del día, instancia el estado
 * (con rehidratación desde localStorage) y monta el motor sobre
 * el DOM. La primera visita abre automáticamente "Cómo se juega"
 * para que el jugador entienda la mecánica antes del primer intento.
 * --------------------------------------------------------------
 */
(function (global) {
  'use strict';

  const FLAG_VISITADO = 'litlapse:visited';

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
    global.Litlapse.__debug = { puzzle, state, engine };

    // Onboarding silencioso: la primera vez que entra alguien (en este
    // navegador), abrimos el manual. Si el localStorage está deshabilitado
    // o el flag ya fue seteado, no pasa nada.
    try {
      if (!global.localStorage.getItem(FLAG_VISITADO)) {
        engine._abrirHowto();
        global.localStorage.setItem(FLAG_VISITADO, '1');
      }
    } catch (_e) { /* silent */ }
  }

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', arrancar, { once: true });
  } else {
    arrancar();
  }
})(typeof window !== 'undefined' ? window : globalThis);
