# ☀️ Rutinapp

App web (PWA) para organizar las rutinas de los niños en un iPad, con estrellas, logros, plan de sueño, plan lector, control de pantalla e integración con **Applicatzo**.

No necesita instalación ni App Store: se abre en Safari y se agrega a la pantalla de inicio como si fuera una app.

## Qué hace

**Para los niños** (sin login, eligen su avatar):
- **Mi día**: la rutina de "ahora", la línea del día (rutinas, talleres y pantalla) y los días buenos de la semana.
- **Rutinas paso a paso**: pasos con emoji, lectura en voz alta y temporizador visual tipo *Time Timer*. Cada paso suma 1 ⭐ y completar la rutina suma 2 ⭐ más.
- **Pantalla**: funciona como *primero estudio, después pantalla*. Tiene un presupuesto diario y un cronómetro que sigue contando aunque salgan de la app. Apagar a tiempo da 1 ⭐; si se pasan, ese exceso se descuenta al día siguiente.
- **Plan lector**: calcula cuántas páginas leer cada día para llegar al control.
- **Pruebas**: se anotan al revisar los cuadernos. Si hay una prueba en los próximos 3 días, esa materia pasa primero en el estudio.
- **Premios y logros**: se canjean estrellas por experiencias, con aprobación de un adulto.
- **Menú de juego**: ideas sin pantalla para el tiempo libre.

**Para los adultos** (protegido con PIN):
- **Resumen semanal**: % de cumplimiento, minutos de pantalla, sueño estimado, plan lector, guías de Applicatzo y **sugerencias de ajuste**. Las sugerencias detectan pasos que toman más tiempo del planificado, pasos que casi nunca se cumplen y hábitos listos para "graduarse".
- Editor de rutinas, talleres, premios y menú de juego.
- **Plan de sueño gradual**: adelanta la hora de dormir 15 min cada 3 días hasta la meta.
- Botón **😴 Siesta**: los niños ven un aviso con su plan mientras el adulto duerme.
- Respaldo (descargar y restaurar) y botón para borrar todos los datos.

## Probar en el PC

```bash
python -m http.server 5173
```

Luego abre http://localhost:5173.

## Probar en el iPad (misma red Wi-Fi)

```bash
python -m http.server 5173 --bind 0.0.0.0
```

En el iPad, abre `http://<IP-del-PC>:5173`. Para ver la IP del PC, usa `ipconfig` y busca la "Dirección IPv4" (por ejemplo, 192.168.x.x). Si Windows pregunta por el firewall, permite el acceso en redes privadas.

> Por `http` funciona todo menos el modo sin internet. Los datos de esa dirección son distintos de los de la versión publicada.

## Publicar e instalar en el iPad

Está publicada con **GitHub Pages**: cada `git push` a `main` actualiza el sitio en uno o dos minutos. Para activarlo: en el repositorio, *Settings → Pages → Source: Deploy from a branch → `main` / `(root)`*.

En el iPad: **Safari → Compartir → "Agregar a pantalla de inicio"**. Queda con su ícono, en pantalla completa y funciona sin internet.

Consejos para el iPad:
- *Ajustes → Accesibilidad → Acceso guiado*: deja el iPad bloqueado dentro de Rutinapp.
- *Ajustes → Tiempo en pantalla*: pon "Tiempo de inactividad" una hora antes de dormir y límites a Juegos y Entretenimiento, dejando Safari o Rutinapp permitidos. Como el iPad es compartido, el límite es para el aparato; Rutinapp lleva la cuenta por niño.

## Applicatzo

Applicatzo vive en `applicatzo/index.html` y se abre desde los pasos de estudio. Cuando el niño presiona "Ver mis resultados" o "Revisar", el resultado se guarda en Rutinapp: suma 2 ⭐, marca el paso de estudio y aparece en el resumen del adulto.

**Para actualizar Applicatzo** con una versión nueva:
1. Copia el HTML nuevo sobre `applicatzo/index.html`.
2. Agrega esta línea justo antes del **último** `</body>` del archivo:
   ```html
   <script src="../js/puente-applicatzo.js"></script>
   ```

Si Applicatzo se abre solo, sin pasar por Rutinapp, el puente no hace nada.

## Decisiones basadas en evidencia

| Decisión | Por qué |
|---|---|
| Pasos visuales, "primero / después" y temporizador visible | Los apoyos visuales que usan los cuidadores en casa aumentan la autonomía en las rutinas |
| Las estrellas premian las rutinas; en Applicatzo se premia **terminar la guía**, no cada acierto | Los premios esperados por tareas de aprendizaje pueden bajar la motivación propia (meta-análisis de Deci, Koestner y Ryan, 1999) |
| No se restan estrellas; meta semanal de días buenos en vez de rachas perfectas | Un mal día no borra el esfuerzo |
| La pantalla es un bloque fijo y no un premio | Usar la pantalla como premio o castigo se asoció a más tiempo de pantalla (Universidad de Guelph) |
| Pantalla de ocio: 60 min en días de colegio y 120 min el fin de semana (editable) | AEP 2024: ~1 h entre los 6 y 12 años. Canadá y Suecia: máximo 2 h |
| Plan de sueño gradual hasta 9 a 11 h | AASM: de 6 a 12 años, 9 a 12 h. Acostarse a las 22:00 y levantarse a las 06:30 da solo 8 h 30 min |
| Estudio en bloques con materia rotativa y prioridad por pruebas | Pauta de unos 10 min de tareas por curso; el plan lector se mueve a la rutina de noche |
| Evaluar cambios cada 2 semanas | En adultos, un hábito tarda mediana 66 días en volverse automático (Lally et al., 2010) |

## Privacidad

- Solo se guardan apodo, curso, avatar y la actividad dentro de la app. Rutinapp no necesita apellidos, RUT, fechas de nacimiento ni diagnósticos.
- Los identificadores son opacos (UUID), también en las URL.
- El código es público (GitHub Pages). Los datos reales (apodos, talleres, libros, progreso) **no** están en el código: se ingresan en la app y quedan en el dispositivo.
- **Fase actual**: todo queda en el dispositivo (`localStorage`). No se envía nada a internet.
- El PIN es un candado para niños, no una medida de seguridad.

## Próximos pasos

1. **Sincronización en la nube**, para ver los avances desde el PC o el teléfono. Opción propuesta: Supabase en su plan gratuito, con región São Paulo y un solo login de adulto. Los eventos ya están diseñados para unirse sin conflictos.
2. Pictogramas de [ARASAAC](https://arasaac.org) (CC BY-NC-SA) en vez de emojis para 1º básico.
3. Pantalla de **reunión familiar semanal**: revisar la semana, elegir una meta y firmar un acuerdo.

## Estructura

```
index.html, manifest.webmanifest, sw.js   app instalable y modo sin internet
css/app.css                               estilos
js/main.js                                arranque y rutas (#/…)
js/seed.js                                día escolar típico (editable en la app)
js/store.js · js/acciones.js              guardar datos y cambios
js/logic.js                               cálculos (sueño, lectura, pantalla, logros, sugerencias)
js/kid.js · js/parent.js · js/ui.js       pantallas
js/puente-applicatzo.js                   Applicatzo → Rutinapp
applicatzo/index.html                     copia de Applicatzo con el puente
tools/iconos.mjs                          genera los íconos (node tools/iconos.mjs)
```
