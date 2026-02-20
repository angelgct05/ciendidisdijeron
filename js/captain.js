import { dispatch, getState, initializeState, subscribe } from "./state.js";

const params = new URLSearchParams(window.location.search);
const team = (params.get("team") || "").toUpperCase();

const captainTitle = document.getElementById("captain-title");
const captainStatus = document.getElementById("captain-status");
const captainBuzzButton = document.getElementById("captain-buzz");

function resolveTeam() {
  return team === "A" || team === "B" ? team : null;
}

async function loadDefaultQuestions() {
  const response = await fetch("./data/questions.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("No se pudo cargar data/questions.json");
  }

  return response.json();
}

function render(state) {
  const validTeam = resolveTeam();
  if (!validTeam) {
    captainTitle.textContent = "Equipo no válido";
    captainStatus.textContent = "Usa la URL con ?team=A o ?team=B";
    captainBuzzButton.disabled = true;
    return;
  }

  captainTitle.textContent = `Capitán Equipo ${validTeam}`;
  const winner = state.round.buzzerWinner;
  const isOpen = state.round.status === "buzz-open";

  captainBuzzButton.disabled = !isOpen || Boolean(winner);
  captainStatus.classList.remove("ok", "warn");

  if (isOpen && !winner) {
    captainStatus.textContent = "Buzzer abierto: ¡presiona ahora!";
    captainStatus.classList.add("ok");
    return;
  }

  if (winner) {
    captainStatus.textContent = winner === validTeam ? "Tu equipo ganó el buzzer" : `Ganó Equipo ${winner}`;
    captainStatus.classList.add("warn");
    return;
  }

  captainStatus.textContent = "Esperando al administrador";
}

function onBuzz() {
  const validTeam = resolveTeam();
  if (!validTeam) {
    return;
  }

  const state = getState();
  if (state.round.status !== "buzz-open" || state.round.buzzerWinner) {
    return;
  }

  dispatch("LOCK_BUZZ", { team: validTeam });
}

function attachEvents() {
  captainBuzzButton.addEventListener("click", onBuzz);
  window.addEventListener("keydown", (event) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      onBuzz();
    }
  });
}

async function main() {
  let defaults = [];
  try {
    defaults = await loadDefaultQuestions();
  } catch {
    defaults = [];
  }

  await initializeState(defaults);
  subscribe(render);
  attachEvents();
}

main();
