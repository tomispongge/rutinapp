# ☀️ Rutinapp

App web (PWA) para organizar las rutinas de los niños en un iPad, con estrellas, logros, plan de sueño, plan lector, control de pantalla e integración con **Applicatzo**.

No necesita instalación ni App Store: se abre en Safari y se agrega a la pantalla de inicio como si fuera una app.

## Qué hace

**Para los niños** (sin login, eligen su avatar):
- **Mi día**: la rutina de "ahora", la línea del día (rutinas, talleres y pantalla) y los días buenos de la semana.
- **Rutinas paso a paso**: pasos con emoji y temporizador visual tipo *Time Timer*. Cada paso suma 1 ⭐ y completar la rutina suma 2 ⭐ más.
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

Applicatzo se abre **dentro de Rutinapp** desde su sitio en Vercel (`APPLICATZO_URL` en [`js/config.js`](js/config.js)), así que lo que publiques allá se ve solo, sin copiar archivos. Necesita internet.

Cuando el niño termina una guía, Applicatzo avisa a Rutinapp con un mensaje entre sitios (`postMessage`). Rutinapp suma 2 ⭐, marca el paso de estudio y lo muestra en el resumen del adulto. Solo acepta mensajes del sitio de Applicatzo, del marco abierto y para el niño que lo está usando.

**Requisito (una sola vez):** Applicatzo debe tener esta línea justo antes del **último** `</body>`:
```html
<script src="https://tomispongge.github.io/rutinapp/js/puente-applicatzo.js"></script>
```
Abierta por fuera de Rutinapp, esa línea no hace nada.

La conexión encuentra sola los módulos, incluidos los nuevos, si mantienen el mismo estilo:
- **1º básico:** botón que llama a `mostrarResultados('tipo')` y texto "Respondiste correctamente X de Y". El nombre sale del título `<h1>` de la sección.
- **5º básico:** contenedor `id="contenedor-resultados…"` dentro de `id="modulo-…"`, que muestra "X/Y". El nombre sale del `<h2>` del módulo. Los botones de guía nueva deben tener `generar` o `nuevos` en su id.

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
- El código es público (GitHub Pages). Los datos reales (apodos, talleres, libros, progreso) **no** están en el código: se ingresan en la app (los talleres, en Modo adulto → Talleres) y quedan en el dispositivo.
- Sin cuenta, todo queda en el dispositivo (`localStorage`). Con cuenta, se sincroniza con Supabase y las reglas RLS hacen que cada familia vea solo sus datos. Desde *Modo adulto → ☁️ Nube* se pueden borrar los datos de la nube.
- El PIN es un candado para niños, no una medida de seguridad.

## Sincronización con Supabase

Con una cuenta de adulto, el avance se ve en el iPad, el teléfono y el PC.

- **Cómo funciona.** Los eventos (pasos, minutos, guías, canjes) se unen por id. Los pasos usan un id fijo, así que marcar el mismo paso en dos equipos cuenta una sola vez. La configuración se mezcla en 3 vías por sección y por elemento, así que los cambios hechos en equipos distintos se combinan. Los cronómetros en curso quedan solo en el equipo donde corren.
- **Sin internet** la app funciona igual y sincroniza al volver la conexión.
- **Configuración** (una vez):
  1. Crear un proyecto en [supabase.com](https://supabase.com), región *South America (São Paulo)*.
  2. *SQL Editor* → pegar [`supabase/schema.sql`](supabase/schema.sql) → *Run*.
  3. *Authentication → URL Configuration*: en *Site URL* poner `https://tomispongge.github.io/rutinapp/`.
  4. *Project Settings → API Keys*: copiar la **URL del proyecto** y la **publishable key** (o *anon key*) en [`js/config.js`](js/config.js). **Nunca** pongas ahí la *secret* o *service_role key*.
  5. En la app: *Modo adulto → ☁️ Nube → Crear cuenta*. En los otros equipos: *Bienvenida → Iniciar sesión*.
- El proyecto gratuito de Supabase se pausa tras 7 días sin uso. Si pasa, la app sigue funcionando sola y basta con reactivarlo desde el panel.

## Próximos pasos

1. Invitar a un segundo adulto con su propia cuenta (hoy los adultos comparten la cuenta de la familia).
2. Pictogramas de [ARASAAC](https://arasaac.org) (CC BY-NC-SA).
3. Pantalla de **reunión familiar semanal**.

## Estructura

```
index.html, manifest.webmanifest, sw.js   app instalable y modo sin internet
css/app.css                               estilos
js/main.js                                arranque y rutas (#/…)
js/seed.js                                día escolar típico (editable en la app)
js/store.js · js/acciones.js              guardar datos y cambios
js/nube.js · js/config.js                 sincronización con Supabase
supabase/schema.sql                       tablas y reglas de acceso (RLS)
js/logic.js                               cálculos (sueño, lectura, pantalla, logros, sugerencias)
js/kid.js · js/parent.js · js/ui.js       pantallas
js/puente-applicatzo.js                   Applicatzo → Rutinapp
tools/iconos.mjs                          genera los íconos (node tools/iconos.mjs)
```
