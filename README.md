# Cien Didis Dijeron (MVP Estático)

Juego web estático con:
- Pantalla de juego: `index.html`
- Panel de administrador: `admin.html`
- Login admin por PIN: `2026`

## Flujo de uso

1. Abre `admin.html` y entra con PIN `2026`.
2. Abre `index.html` en otra ventana/pantalla del mismo navegador.
3. Desde admin:
   - `Abrir Buzzer` para habilitar pulsadores.
   - Gestiona capitanes por ronda desde la lista de integrantes de cada equipo.
   - El primer equipo en pulsar gana el buzzer.
   - Revela respuestas con botón `Mostrar/Ocultar` por cada respuesta.
   - Suma o resta puntos por equipo.
4. Usa el editor para crear/editar preguntas y guardar respuestas.

## Reglas implementadas (MVP)

- Buzzer con prioridad al primer evento capturado.
- Modo Capitán: solo el capitán asignado por equipo en la ronda puede usar su buzzer.
- Una vez bloqueado, no se aceptan más pulsaciones hasta `Reset Ronda` o nueva apertura.
- Estado sincronizado entre ventanas con `BroadcastChannel`.
- Respaldo en `localStorage` para mantener estado tras recarga.

## Cambios recientes

- Se agregó `stateVersion` monotónica para sincronización consistente entre admin, index y móvil.
- Se reforzó sincronización híbrida (`Realtime + polling`) con reintentos automáticos de escritura.
- Se corrigió latencia de “primera acción” en móviles (acciones aplican desde el primer evento).
- Se implementó sesión de jugador en `index` con persistencia en sesión del navegador.
- El admin puede cerrar sesión individual o global de jugadores.
- Se agregó selección de capitán por ronda con control de acceso estricto a `captain.html`.
- Se añadió modal de éxito al guardar respuestas en editor de preguntas.

## Despliegue en Vercel

1. Sube esta carpeta a un repositorio Git.
2. Importa el repo en Vercel.
3. Framework preset: `Other`.
4. Build command: vacío.
5. Output directory: `/` (raíz del proyecto estático).

Listo: Vercel servirá `index.html` como página principal y podrás abrir `/admin.html` para el panel de control.

## Base de Datos (tabla dedicada de preguntas)

El CRUD de preguntas/respuestas usa la tabla dedicada `game_questions`.

Antes de usar el editor de preguntas, ejecuta el SQL de:

- `supabase/game_questions.sql`

Esto crea tabla, índices y políticas RLS mínimas para demo con `anon`.
