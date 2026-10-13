// Estado inicial: un día escolar típico (levantarse 06:30, volver 13:30) para
// un niño de 1º y otro de 5º básico. Todo es editable desde el modo adulto.
// Este archivo es público (GitHub Pages): no pongas aquí datos reales de la
// familia. Apodos, talleres y libros se ingresan en la app y quedan solo en el dispositivo.
import { uuid, dayKey } from './util.js';

const LV = [1, 2, 3, 4, 5];
const TODOS = [0, 1, 2, 3, 4, 5, 6];
const FINDE = [0, 6];

const paso = (emoji, texto, min, accion) => ({ id: uuid(), emoji, texto, min, ...(accion ? { accion } : {}) });

export const AVATARES = ['🦋', '🦖', '🐱', '🐶', '🦊', '🐼', '🦄', '🐙', '🚀', '⚽', '🌸', '🐉', '🦁', '🐢', '🎸', '🌈'];

export const MATERIAS = {
  1: ['Matemática', 'Lenguaje', 'Ciencias Naturales', 'Historia', 'Inglés', 'Otra'],
  5: ['Matemática', 'Lenguaje', 'Inglés', 'Ciencias Naturales', 'Historia', 'Otra'],
};

export const TIPOS_RUTINA = {
  manana: 'Mañana',
  llegada: 'Llegada',
  estudio: 'Estudio',
  movimiento: 'Movimiento',
  noche: 'Noche',
  otra: 'Otra',
};

export const ACCIONES = {
  '': 'Ninguna',
  materia: 'Materia sugerida del día',
  applicatzo: 'Abrir Applicatzo',
  copia: 'Abrir Copia (Applicatzo)',
  pruebas: 'Anotar pruebas',
  lector: 'Plan lector',
};

export function seedState() {
  const hoy = dayKey();
  const A = uuid(); // 5º básico
  const B = uuid(); // 1º básico

  const ninos = [
    {
      id: A, apodo: 'Hija', avatar: '🦋', color: '#7c5cff', curso: 5, voz: false,
      pantallaHabil: 60, pantallaFinde: 120,
      sueno: { actual: '22:00', meta: '21:00', pasoMin: 15, cadaDias: 3, inicio: hoy },
    },
    {
      id: B, apodo: 'Hijo', avatar: '🦖', color: '#f07b2f', curso: 1, voz: true,
      pantallaHabil: 60, pantallaFinde: 120,
      sueno: { actual: '22:00', meta: '20:15', pasoMin: 15, cadaDias: 3, inicio: hoy },
    },
  ];

  const rutinas = [
    {
      id: uuid(), nombre: 'Mañana de colegio', emoji: '🌅', tipo: 'manana', ninos: [A, B], dias: LV, hora: '06:30',
      pasos: [
        paso('🛏️', 'Levantarme', 2),
        paso('🚽', 'Baño y lavarme la cara', 5),
        paso('👕', 'Vestirme con la ropa que dejé lista', 8),
        paso('🥣', 'Desayunar', 15),
        paso('🪥', 'Lavarme los dientes', 3),
        paso('🎒', 'Mochila y zapatos en la puerta', 5),
      ],
    },
    {
      id: uuid(), nombre: 'Llegada del colegio', emoji: '🏠', tipo: 'llegada', ninos: [B], dias: LV, hora: '13:30',
      pasos: llegada(),
    },
    {
      id: uuid(), nombre: 'Llegada del colegio', emoji: '🏠', tipo: 'llegada', ninos: [A], dias: [1, 3, 5], hora: '13:30',
      horaPorDia: { 3: '13:20', 5: '14:00' },
      pasos: llegada(),
    },
    {
      id: uuid(), nombre: 'Llegada del taller', emoji: '🏐', tipo: 'llegada', ninos: [A], dias: [2, 4], hora: '19:00',
      horaPorDia: { 4: '17:00' },
      pasos: [
        paso('🧼', 'Lavarme las manos', 2),
        paso('🧺', 'Ropa deportiva al canasto', 3),
        paso('📓', 'Revisar cuadernos: ¿hay tareas o pruebas?', 5, 'pruebas'),
        paso('🎒', 'Hacer la mochila de mañana', 5),
        paso('🚿', 'Ducha', 10),
      ],
    },
    {
      id: uuid(), nombre: 'Estudio', emoji: '📚', tipo: 'estudio', ninos: [B], dias: LV, hora: '14:45',
      pasos: [
        paso('📱', 'Guía de Applicatzo', 12, 'applicatzo'),
        paso('✏️', 'Copia en mi cuaderno', 10, 'copia'),
        paso('📖', 'Leer en voz alta con alguien', 10),
      ],
    },
    {
      id: uuid(), nombre: 'Estudio', emoji: '📚', tipo: 'estudio', ninos: [A], dias: [1, 3, 4, 5], hora: '14:45',
      horaPorDia: { 3: '14:30', 4: '17:30', 5: '15:00' },
      pasos: [
        paso('🎯', '{materia}', 25, 'materia'),
        paso('📝', 'Tareas del cuaderno (si hay)', 15),
      ],
    },
    {
      id: uuid(), nombre: 'Juego activo', emoji: '🏃', tipo: 'movimiento', ninos: [B], dias: LV, hora: '17:00',
      pasos: [paso('🏃', '60 minutos moviéndome: bici, pelota, patio', 60)],
    },
    {
      id: uuid(), nombre: 'Juego activo', emoji: '🏃', tipo: 'movimiento', ninos: [A], dias: [1, 5], hora: '17:00',
      pasos: [paso('🏃', '45 minutos moviéndome al aire libre', 45)],
    },
    {
      id: uuid(), nombre: 'Rutina de noche', emoji: '🌙', tipo: 'noche', ninos: [A], dias: TODOS,
      pasos: [
        paso('🚿', 'Ducha y pijama', 10),
        paso('👕', 'Dejar lista la ropa de mañana', 5),
        paso('🪥', 'Lavarme los dientes', 3),
        paso('📖', 'Plan lector en la cama', 25, 'lector'),
        paso('💡', 'Luces apagadas', 1),
      ],
    },
    {
      id: uuid(), nombre: 'Rutina de noche', emoji: '🌙', tipo: 'noche', ninos: [B], dias: TODOS,
      pasos: [
        paso('🚿', 'Ducha y pijama', 10),
        paso('👕', 'Dejar lista la ropa de mañana', 5),
        paso('🪥', 'Lavarme los dientes', 3),
        paso('📖', 'Cuento con un adulto', 15),
        paso('💡', 'Luces apagadas', 1),
      ],
    },
    {
      id: uuid(), nombre: 'Mañana de fin de semana', emoji: '☀️', tipo: 'manana', ninos: [A, B], dias: FINDE, hora: '09:00',
      pasos: [
        paso('🛏️', 'Hacer la cama', 3),
        paso('🥣', 'Desayunar', 20),
        paso('🪥', 'Lavarme los dientes', 3),
        paso('🧹', 'Ordenar mi pieza', 15),
      ],
    },
  ];

  // Talleres y actividades (días: 0 = domingo … 6 = sábado). Se agregan en
  // Modo adulto → Talleres, para que los horarios reales no queden en el código público.
  const actividades = [];

  // Premios de experiencias y privilegios. La pantalla no es moneda de cambio:
  // es un bloque fijo del día (ver README).
  const premios = [
    { id: uuid(), emoji: '🎲', nombre: 'Juego de mesa con un adulto', costo: 10 },
    { id: uuid(), emoji: '🎬', nombre: 'Elegir la película del viernes', costo: 15 },
    { id: uuid(), emoji: '🍕', nombre: 'Elegir el menú de un día', costo: 20 },
    { id: uuid(), emoji: '🧁', nombre: 'Cocinar algo juntos', costo: 25 },
    { id: uuid(), emoji: '🏞️', nombre: 'Salida especial', costo: 60 },
  ];

  const juegos = [
    '🧱 Construir con Lego', '🎨 Dibujar o pintar', '🚲 Andar en bici', '⚽ Pelota en el patio',
    '🎲 Juego de mesa juntos', '🏰 Armar un fuerte con cojines', '📚 Leer cómics', '🧩 Armar un puzzle',
    '🎭 Disfraces y teatro', '💡 Inventar un juego nuevo',
  ];

  return {
    version: 1,
    creado: hoy,
    ajustes: {
      configurado: false,
      pinHash: null,
      pinSalt: uuid(),
      despertar: '06:30',
      findeExtraMin: 30,
      descontarExceso: true,
      metaSemanal: 5,
      minPorPagina: 2.5,
      siestaHasta: null,
      rotacion: {
        5: { 1: 'Matemática', 3: 'Lenguaje e Inglés', 4: 'Ciencias o Historia', 5: 'Repaso de la semana' },
        1: {},
      },
      planB: 'Hoy no hubo taller: 30 minutos de juego activo en casa 🏃',
    },
    ninos, rutinas, actividades, premios, juegos,
    libros: [],
    pruebas: [],
    eventos: [],
    timers: {},
    desbloqueos: {},
  };
}

function llegada() {
  return [
    paso('🧼', 'Lavarme las manos', 2),
    paso('👕', 'Cambiarme de ropa', 5),
    paso('📓', 'Revisar cuadernos: ¿hay tareas o pruebas?', 5, 'pruebas'),
    paso('🎒', 'Hacer la mochila de mañana', 5),
    paso('🛏️', 'Hacer la cama', 3),
  ];
}
