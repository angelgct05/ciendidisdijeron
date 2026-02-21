import { dispatch, getState, initializeState, subscribe } from "./state.js";

const params = new URLSearchParams(window.location.search);
const team = (params.get("team") || "").toUpperCase();

const captainTitle = document.getElementById("captain-title");
const captainRoundControl = document.getElementById("captain-round-control");
const captainStrikes = document.getElementById("captain-strikes");
const captainBuzzButton = document.getElementById("captain-buzz");
const teamBackModalEl = document.getElementById("team-back-modal");
const teamBackAcceptButton = document.getElementById("team-back-accept");
const PLAYER_SESSION_KEY = "fm100_player_session";
const TEAM_BACK_SEEN_KEY = "fm100_team_back_seen";

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

function getSeenTeamBackVersion() {
  return Number(sessionStorage.getItem(TEAM_BACK_SEEN_KEY)) || 0;
}

function setSeenTeamBackVersion(version) {
  sessionStorage.setItem(TEAM_BACK_SEEN_KEY, String(version));
}

function renderTeamBackModal(state, validTeam) {
  const targetTeam = state.ui?.teamBackAlertTeam;
  const version = Number(state.ui?.teamBackAlertVersion) || 0;
  if ((targetTeam === "A" || targetTeam === "B") && targetTeam === validTeam && version > 0) {
    const seen = getSeenTeamBackVersion();
    teamBackModalEl.dataset.version = String(version);
    teamBackModalEl.classList.toggle("hidden", seen >= version);
    return;
  }

  teamBackModalEl.classList.add("hidden");
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
  renderTeamBackModal(state, validTeam);

  const controlTeam = state.round.buzzerWinner;
  if (controlTeam === "A" || controlTeam === "B") {
    const controlName = state.teams[controlTeam]?.name || `Equipo ${controlTeam}`;
    captainRoundControl.textContent = `Control de ronda: ${controlName}`;
  } else {
    captainRoundControl.textContent = "Control de ronda: sin equipo";
  }

  const ownStrikes = Number(state.teams[validTeam]?.strikes) || 0;
  captainStrikes.innerHTML = `Strikes: <strong>${ownStrikes}</strong>`;

  const winner = state.round.buzzerWinner;
  const isOpen = state.round.status === "buzz-open";

  captainBuzzButton.disabled = !isOpen || Boolean(winner);
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
  teamBackAcceptButton.addEventListener("click", () => {
    const seenVersion = Number(teamBackModalEl.dataset.version || 0);
    if (seenVersion > 0) {
      setSeenTeamBackVersion(seenVersion);
    }
    teamBackModalEl.classList.add("hidden");
  });
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
