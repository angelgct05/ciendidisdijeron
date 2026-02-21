import { dispatch, getState, initializeState, subscribe } from "./state.js";

const params = new URLSearchParams(window.location.search);
const team = (params.get("team") || "").toUpperCase();

const captainTitle = document.getElementById("captain-title");
const captainStatus = document.getElementById("captain-status");
const captainBuzzButton = document.getElementById("captain-buzz");
const PLAYER_SESSION_KEY = "fm100_player_session";

function resolveTeam() {
  return team === "A" || team === "B" ? team : null;
}

function loadPlayerSession() {
  const raw = sessionStorage.getItem(PLAYER_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    const id = String(parsed?.id || "").trim();
    const playerTeam = String(parsed?.team || "").trim();
    const name = String(parsed?.name || "").trim();
    if (!id || !name || (playerTeam !== "A" && playerTeam !== "B")) {
      return null;
    }

    return {
      id,
      team: playerTeam,
      name,
    };
  } catch {
    return null;
  }
}

function denyCaptainAccess() {
  window.location.replace("./index.html");
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

  const session = loadPlayerSession();
  if (!session || session.team !== validTeam) {
    denyCaptainAccess();
    return;
  }

  const player = (state.players || []).find((item) => item.id === session.id);
  const assignedCaptain = state.round?.captains?.[validTeam] || null;
  if (!player || !player.active || assignedCaptain !== session.id) {
    denyCaptainAccess();
    return;
  }

  const ownTeamName = state.teams[validTeam]?.name || `Equipo ${validTeam}`;
  captainTitle.textContent = `Capitán ${ownTeamName}`;
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
    const winnerName = state.teams[winner]?.name || `Equipo ${winner}`;
    captainStatus.textContent = winner === validTeam ? "Tu equipo ganó el buzzer" : `Ganó ${winnerName}`;
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
