# Litlapse

Un juego web diario en castellano. Cada día aparece un fragmento de literatura universal con tres palabras tapadas — el jugador las restaura tipeando en un input fantasma y pulsando Enter, hasta completar la página.

## Vocabulario

- **Elipsis** — la palabra omitida; el bloque opaco sobre el texto que el jugador debe restaurar. Tres por día.
- **Eclipse** — la sesión diaria completa: el fragmento del día y el intento del jugador por resolverlo.

## Cómo levantarlo localmente

No hay paso de build. Vanilla JS, sin dependencias.

```
python3 -m http.server 8000
```

Y abrir `http://localhost:8000/` en el navegador.

## Estructura

```
index.html
css/litlapse.css
js/
  puzzles.js   catálogo de eclipses
  utils.js     normalización y tokenización
  storage.js   persistencia por puzzle id
  state.js     GameState — vidas, victoria, derrota
  share.js     postal compartible
  engine.js    render DOM e interacción
  main.js      bootstrap
```

El orden de `<script>` en `index.html` es estricto: `puzzles → utils → storage → state → share → engine → main`.
