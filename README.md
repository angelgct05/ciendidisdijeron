# 100 Mexicanos Dijeron (MVP Estático)

Juego web estático con:
- Pantalla de juego: `index.html`
- Panel de administrador: `admin.html`
- Login admin por PIN: `2026`

## Flujo de uso

1. Abre `admin.html` y entra con PIN `2026`.
2. Abre `index.html` en otra ventana/pantalla del mismo navegador.
3. Desde admin:
   - `Abrir Buzzer` para habilitar pulsadores.
   - Usa `Abrir Buzzer Capitán A` y `Abrir Buzzer Capitán B` para abrir la página de cada representante.
   - El primer equipo en pulsar gana el buzzer.
   - Revela respuestas haciendo clic en cada respuesta.
   - Suma o resta puntos por equipo.
4. Usa el editor para crear/editar preguntas o importar/exportar JSON.

## Reglas implementadas (MVP)

- Buzzer con prioridad al primer evento capturado.
- Modo Capitán: la pantalla pública ya no recibe pulsaciones; el buzz se hace desde `captain.html?team=A` y `captain.html?team=B`.
- Una vez bloqueado, no se aceptan más pulsaciones hasta `Reset Ronda` o nueva apertura.
- Estado sincronizado entre ventanas con `BroadcastChannel`.
- Respaldo en `localStorage` para mantener estado tras recarga.

## Despliegue en Vercel

1. Sube esta carpeta a un repositorio Git.
2. Importa el repo en Vercel.
3. Framework preset: `Other`.
4. Build command: vacío.
5. Output directory: `/` (raíz del proyecto estático).

Listo: Vercel servirá `index.html` como página principal y podrás abrir `/admin.html` para el panel de control.
