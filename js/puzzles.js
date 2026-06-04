/**
 * litlapse · puzzles.js
 * --------------------------------------------------------------
 * Catálogo de eclipses diarios. Cada entrada describe un fragmento
 * literario y las tres palabras en elipsis a restaurar.
 *
 * Forma exacta requerida por el motor:
 *
 *   {
 *     id: number,
 *     fecha: "YYYY-MM-DD",
 *     autor: string,
 *     obra:  string,
 *     año:   string,
 *     textoOriginal: string,           // copia íntegra y prístina
 *     palabrasOcultas: [               // exactamente 3 entradas
 *       {
 *         indicePalabra:   number,     // 0-based dentro de textoOriginal.split(/\s+/)
 *         palabraCorrecta: string,     // ortografía canónica con tildes
 *         pistaDiccionario: string     // glosa para el botón de auxilio
 *       },
 *       ...
 *     ]
 *   }
 *
 * Reglas de indexado: tokenizar `textoOriginal` por espacios en blanco
 * conserva la puntuación adherida a cada palabra (p. ej. "caras,"),
 * pero el motor compara únicamente la raíz alfabética normalizada
 * contra `palabraCorrecta`. Eso permite mantener la puntuación
 * original en el render sin ensuciar la verificación.
 * --------------------------------------------------------------
 */
(function (global) {
  'use strict';

  const PUZZLES = Object.freeze([
    {
      id: 1,
      fecha: '2026-06-04',
      autor: 'Virginia Woolf',
      obra: 'Al faro',
      'año': '1927',
      textoOriginal:
        'La belleza del mundo tenía dos caras, una de alegría, otra de angustia, que cortaba el corazón en dos.',
      palabrasOcultas: [
        {
          indicePalabra: 1,
          palabraCorrecta: 'belleza',
          pistaDiccionario:
            'Propiedad de las cosas que hace amarlas, infundiendo deleite.'
        },
        {
          indicePalabra: 9,
          palabraCorrecta: 'alegría',
          pistaDiccionario:
            'Sentimiento grato y vivo que suele manifestarse con signos exteriores.'
        },
        {
          indicePalabra: 12,
          palabraCorrecta: 'angustia',
          pistaDiccionario:
            'Aflicción o sufrimiento desasosegado por temor a una desgracia.'
        }
      ]
    },
    {
      id: 2,
      fecha: '2026-06-05',
      autor: 'Gustavo Adolfo Bécquer',
      obra: 'Rima LIII',
      'año': '1871',
      textoOriginal:
        'Volverán las oscuras golondrinas en tu balcón sus nidos a colgar, y otra vez con el ala a sus cristales jugando llamarán.',
      palabrasOcultas: [
        {
          indicePalabra: 2,
          palabraCorrecta: 'oscuras',
          pistaDiccionario: 'Que carece de luz o de claridad.'
        },
        {
          indicePalabra: 8,
          palabraCorrecta: 'nidos',
          pistaDiccionario:
            'Construcción que las aves fabrican para poner sus huevos y criar a sus polluelos.'
        },
        {
          indicePalabra: 19,
          palabraCorrecta: 'cristales',
          pistaDiccionario:
            'Vidrio incoloro y transparente; lámina de vidrio en una ventana.'
        }
      ]
    },
    // NOTA: los ids 3, 4, 5 quedan a la espera de fragmentos por definir.
    // Las fechas a continuación se asignan consecutivas a partir del día siguiente
    // del id 2; el editor del catálogo puede reajustarlas libremente.
    {
      id: 6,
      fecha: '2026-06-09',
      autor: 'Charles Baudelaire',
      obra: 'Las flores del mal',
      'año': '1857',
      textoOriginal:
        'Para no sentir el horrible peso del Tiempo que rompe vuestros hombros, hay que emborracharse sin tregua.',
      palabrasOcultas: [
        {
          indicePalabra: 4,
          palabraCorrecta: 'horrible',
          pistaDiccionario:
            'Que causa horror, espanto o una emoción de rechazo muy profunda.'
        },
        {
          indicePalabra: 7,
          palabraCorrecta: 'Tiempo',
          pistaDiccionario:
            'Magnitud que mide la duración o separación de acontecimientos, sujeta al cambio.'
        },
        {
          indicePalabra: 16,
          palabraCorrecta: 'tregua',
          pistaDiccionario:
            'Descanso, suspensión temporal de una lucha, un dolor o una actividad agobiante.'
        }
      ]
    },
    {
      id: 7,
      fecha: '2026-06-10',
      autor: 'Virginia Woolf',
      obra: 'Al faro',
      'año': '1927',
      textoOriginal:
        'Se detenía junto al gran espejo del recibidor y miraba su propio rostro con una extraña mezcla de reconocimiento y olvido.',
      palabrasOcultas: [
        {
          indicePalabra: 5,
          palabraCorrecta: 'espejo',
          pistaDiccionario:
            'Superficie pulimentada que refleja los objetos que están delante.'
        },
        {
          indicePalabra: 15,
          palabraCorrecta: 'extraña',
          pistaDiccionario:
            'Rara, singular, ajena a la naturaleza común o que produce sorpresa.'
        },
        {
          indicePalabra: 20,
          palabraCorrecta: 'olvido',
          pistaDiccionario:
            'Cesación de la memoria que se tenía de algo; pérdida de un recuerdo.'
        }
      ]
    },
    {
      id: 8,
      fecha: '2026-06-11',
      autor: 'Mary Shelley',
      obra: 'Frankenstein',
      'año': '1818',
      textoOriginal:
        'El mundo era para mí un secreto que deseaba descubrir; la curiosidad y el anhelo de saber eran mis leyes divinas.',
      palabrasOcultas: [
        {
          indicePalabra: 6,
          palabraCorrecta: 'secreto',
          pistaDiccionario:
            'Cosa que cuidadosamente se tiene oculta y reservada de los demás.'
        },
        {
          indicePalabra: 11,
          palabraCorrecta: 'curiosidad',
          pistaDiccionario:
            'Deseo de saber o averiguar una cosa; inclinación hacia lo desconocido.'
        },
        {
          indicePalabra: 14,
          palabraCorrecta: 'anhelo',
          pistaDiccionario:
            'Deseo vehemente, ansia o aspiración intensa de conseguir algo.'
        }
      ]
    },
    {
      id: 9,
      fecha: '2026-06-12',
      autor: 'Horacio Quiroga',
      obra: 'Cuentos de amor de locura y de muerte',
      'año': '1917',
      textoOriginal:
        'En la profunda calma de la selva, la naturaleza parece tejer un hilo invisible de misterio que atrapa la razón humana.',
      palabrasOcultas: [
        {
          indicePalabra: 3,
          palabraCorrecta: 'calma',
          pistaDiccionario:
            'Tranquilidad, sosiego, ausencia de agitación o de ruido.'
        },
        {
          indicePalabra: 8,
          palabraCorrecta: 'naturaleza',
          pistaDiccionario:
            'Principio universal que gobierna los seres vivos y el mundo físico.'
        },
        {
          indicePalabra: 13,
          palabraCorrecta: 'invisible',
          pistaDiccionario:
            'Que no puede ser visto, ya sea por su propia esencia o por ocultación.'
        }
      ]
    },
    {
      id: 10,
      fecha: '2026-06-13',
      autor: 'Oscar Wilde',
      obra: 'El retrato de Dorian Gray',
      'año': '1890',
      textoOriginal:
        'La única manera de librarse de la tentación es caer en ella. Si resistes, tu alma se enferma de nostalgia.',
      palabrasOcultas: [
        {
          indicePalabra: 7,
          palabraCorrecta: 'tentación',
          pistaDiccionario:
            'Estímulo que induce a hacer algo, especialmente si es prohibido o imprudente.'
        },
        {
          indicePalabra: 15,
          palabraCorrecta: 'alma',
          pistaDiccionario:
            'Principio espiritual e inmortal de los seres humanos; esencia interior.'
        },
        {
          indicePalabra: 19,
          palabraCorrecta: 'nostalgia',
          pistaDiccionario:
            'Pena de verse ausente de la patria o de los recuerdos de tiempos felices.'
        }
      ]
    }
  ]);

  /** Devuelve el puzzle de una fecha ISO o `null` si no existe. */
  function getPuzzleByDate(fechaISO) {
    return PUZZLES.find((p) => p.fecha === fechaISO) || null;
  }

  /** Devuelve el puzzle por su id numérico o `null`. */
  function getPuzzleById(id) {
    return PUZZLES.find((p) => p.id === id) || null;
  }

  /** Fecha local (no UTC) en formato YYYY-MM-DD para indexar el día. */
  function todayISO() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  /** El eclipse correspondiente al día local; cae al primero si no hay match. */
  function getTodaysPuzzle() {
    return getPuzzleByDate(todayISO()) || PUZZLES[0];
  }

  global.Litlapse = global.Litlapse || {};
  global.Litlapse.Puzzles = {
    all: PUZZLES,
    getPuzzleByDate,
    getPuzzleById,
    getTodaysPuzzle,
    todayISO
  };
})(typeof window !== 'undefined' ? window : globalThis);
