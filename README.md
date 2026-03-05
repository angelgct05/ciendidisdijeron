# Cien Didis Dijeron

Aplicación web estática para dinámica tipo “100 Mexicanos Dijeron”, con control en tiempo real entre pantallas.

## Pantallas

- `admin.html`: operación de la partida (requiere PIN `2026`).
- `index.html`: pantalla del juego para público/jugadores.
- `questions.html`: administración de tipos y preguntas.
- `instructions.html`: guía para jugadores.

## Flujo rápido

1. Abre `admin.html` e ingresa el PIN.
2. Configura meta de puntos, tipo de ronda y multiplicador (antes de iniciar pregunta 1).
3. Asigna control de ronda con `Dar el control`.
4. Inicia con `Siguiente Pregunta`.
5. Revela respuestas, suma strikes y cierra ronda con `Sumar Puntos` o `Robo de Puntos`.

## Reglas implementadas

- Control de ronda manual desde admin (`Equipo 1` o `Equipo 2`).
- `Agregar Strike` aplica solo al equipo con control y tiene tope de 3.
- `Robo de Puntos` solo está habilitado cuando al menos un equipo llega a 3 strikes.
- `Sumar Puntos` suma al equipo con control.
- `Robo de Puntos` suma al equipo contrario.
- Al cerrar ronda:
  - si era la última pregunta del bloque, vuelve a `Pregunta 0` (espera de inicio),
  - si no era la última, queda cerrada y se avanza con `Siguiente Pregunta`.
- Meta de puntaje configurable: `250 / 500 / 750 / 1000`.
- Meta, multiplicador y tipo de ronda se bloquean al iniciar la pregunta 1.
- `Terminar Partida` declara ganador al equipo con mayor puntaje.

## UX actual

- Menú superior colapsado por defecto en todas las pantallas.
- Navegación en misma pestaña para enlaces internos (excepto `Pantalla de Juego`, que abre en nueva pestaña).
- Botonería de acción con iconos.
- Overlay QR con leyenda para entrada desde celular.

## Sonidos sincronizados

- `assets/audio/correcto.mp3`: revelar respuesta.
- `assets/audio/incorrecto.mp3`: strike.
- `assets/audio/a_jugar.mp3`: avance de pregunta.
- `assets/audio/triunfo.mp3`: cierre de ronda con puntos.
- `assets/audio/we-are-the-champions.mp3`: ganador final.

## Base de datos y estado

- Tablas principales:
  - `game_rooms`
  - `game_question_types`
  - `game_questions`
- La meta de puntaje se guarda en `game_rooms.state.ui.winningScore`.
- Sin RPC de buzzer activo: el control de ronda se maneja en estado.

## Migración / actualización

### Proyecto nuevo

Ejecutar en este orden:

1. `supabase/01_schema_full.sql`
2. `supabase/02_export_old_project.sql` (en proyecto origen)
3. `supabase/03_import_new_project.sql` (en proyecto destino)
4. `supabase/04_post_migration_checks.sql`

### Proyecto existente

- Si aún existe RPC legado de buzzer, ejecutar:
  - `supabase/05_remove_buzzer_rpc.sql`

### Nota de esta actualización

- Los cambios recientes de iconografía, navegación y menús son solo de frontend.
- No agregan nuevas tablas ni columnas, por lo que no requieren migración SQL adicional.

## Verificación recomendada

1. Confirmar “Base de Datos: conectado” en admin.
2. Validar que menús inician colapsados.
3. Probar navegación interna en misma pestaña.
4. Abrir QR y confirmar leyenda encima del código.
5. Ejecutar una ronda completa:
   - control,
   - revelar,
   - strikes,
   - sumar/robar,
   - avance de pregunta.

