# Cien Didis Dijeron

Aplicación web estática para dinámica tipo “100 Mexicanos Dijeron”, con control en tiempo real entre pantallas.

## Pantallas principales

- `admin.html`: panel de conducción del juego (PIN admin).
- `index.html`: pantalla principal para mostrar pregunta, respuestas y marcador.
- `questions.html`: CRUD de tipos de pregunta y banco de preguntas/respuestas.
- `instructions.html`: guía para jugadores.

## Inicio rápido

1. Abre `admin.html`.
2. Ingresa PIN admin: `2026`.
3. Abre `index.html` en otra pestaña/dispositivo para mostrar el tablero.
4. Configura puntuación para ganar, tipo de partida, multiplicador y capitán por texto.
5. Inicia con `Siguiente Pregunta`.

## Reglas de juego implementadas

- Dos equipos compiten por adivinar respuestas populares.
- El control de ronda se define desde Admin con `Dar el control` (Equipo A o B).
- `Mostrar/Ocultar` respuestas solo está habilitado cuando existe control de ronda.
- `Agregar Strike` aplica al equipo con control y tiene tope de `3`.
- `Robo de Puntos` solo se habilita cuando algún equipo llega a `3` strikes.
- Cierre de ronda:
   - `Sumar Respuestas`: suma al equipo con control.
   - `Robo de Puntos`: suma al equipo contrario.
- Al cerrar ronda con `Sumar Respuestas` o `Robo de Puntos`, la ronda se reinicia automáticamente.
- El selector de puntuación para ganar (`250/500/750/1000`) se bloquea al iniciar la pregunta 1 y solo se desbloquea al reiniciar partida.
- Multiplicador y tipo de partida también se bloquean al iniciar la pregunta 1.
- `Terminar Partida` declara ganador al equipo con mayor puntaje.

## Sonidos globales

Se sincronizan entre pantallas conectadas:

- `assets/audio/button.mp3`: asignación de control desde Admin (`Dar el control`).
- `assets/audio/correcto.mp3`: respuesta revelada.
- `assets/audio/incorrecto.mp3`: strike.
- `assets/audio/a_jugar.mp3`: siguiente pregunta.
- `assets/audio/triunfo.mp3`: cierre de ronda con puntos.
- `assets/audio/we-are-the-champions.mp3`: ganador de partida.

## Estructura de datos

### Tipos de pregunta

- Tabla: `game_question_types`
- Campos principales: `room_code`, `id`, `name`, `description`

### Preguntas

- Tabla: `game_questions`
- Campos principales: `room_code`, `position`, `question`, `type_id`, `display_order`, `answers (jsonb)`

## Configuración de Base de Datos

Ejecuta el script:

- `supabase/game_questions.sql`

Este script crea/ajusta:

- Tablas y columnas necesarias.
- Índices.
- Políticas RLS para uso del cliente `anon`.
- Backfill de categoría general para compatibilidad.

## Sincronización

El estado usa sincronización híbrida:

- Supabase Realtime.
- Polling de respaldo.
- Reintentos automáticos ante fallos transitorios.
- Persistencia local para continuidad de sesión.

## Despliegue (Vercel)

1. Sube el proyecto a Git.
2. Importa en Vercel.
3. Preset: `Other`.
4. Build command: vacío.
5. Output directory: raíz del proyecto.

## Recomendaciones operativas

- Haz recarga completa (`Ctrl+F5`) tras cambios de assets o audio.
- Verifica en admin el estado “Base de Datos: conectado”.
- Para evento en vivo: una pestaña para admin y otra para pantalla pública.

## Migración a un proyecto nuevo de Supabase

### Qué debes tomar en cuenta antes de migrar

- Guarda respaldo del estado actual (`game_rooms`, `game_questions`, `game_question_types`).
- Crea el nuevo proyecto y verifica que tenga Realtime habilitado.
- Actualiza credenciales en [js/config.js](js/config.js):
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `ROOM_CODE`
- Ejecuta scripts en este orden:
   1. [supabase/01_schema_full.sql](supabase/01_schema_full.sql) en proyecto nuevo.
   2. [supabase/02_export_old_project.sql](supabase/02_export_old_project.sql) en proyecto viejo.
   3. [supabase/03_import_new_project.sql](supabase/03_import_new_project.sql) en proyecto nuevo (pegando el JSON exportado).

### Validación post-migración

- Abre `admin.html` y confirma “Base de Datos: conectado”.
- Verifica en `questions.html` que aparecen tipos/preguntas.
- Prueba flujo mínimo:
   - seleccionar equipo con `Dar el control`,
   - revelar respuesta,
   - sumar puntos,
   - verificar que `Robo de Puntos` se habilite al llegar a 3 strikes,
   - verificar que la meta de puntaje elegida dispare ganador.

### Migración para instalaciones existentes (sin reiniciar proyecto)

- Si tu proyecto ya tenía buzzer por RPC, ejecuta también:
  - [supabase/05_remove_buzzer_rpc.sql](supabase/05_remove_buzzer_rpc.sql)
- Esta migración elimina la función `try_lock_buzzer` que ya no se utiliza en el flujo actual.
- La puntuación para ganar vive en `state.ui.winningScore` dentro de `game_rooms.state`, no requiere cambios de esquema SQL.
