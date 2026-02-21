import { dispatch, initializeState, subscribe } from "./state.js";

const scoreAEl = document.getElementById("score-a");
const scoreBEl = document.getElementById("score-b");
const teamNameAEl = document.getElementById("team-name-a");
const teamNameBEl = document.getElementById("team-name-b");
const playerIdentityEl = document.getElementById("player-identity");
const questionTextEl = document.getElementById("question-text");
const answersListEl = document.getElementById("answers-list");
const roundLabelEl = document.getElementById("round-label");
const buzzerStatusEl = document.getElementById("buzzer-status");
const qrModalEl = document.getElementById("qr-modal");
const playerGateEl = document.getElementById("player-gate");
const playerGateFormEl = document.getElementById("player-gate-form");
const playerNameInputEl = document.getElementById("player-name-input");
const playerTeamSelectEl = document.getElementById("player-team-select");
const playerGateErrorEl = document.getElementById("player-gate-error");
const PLAYER_SESSION_KEY = "fm100_player_session";

let playerRegistered = false;
let redirectingToCaptain = false;

function loadPlayerSession() {
  const raw = sessionStorage.getItem(PLAYER_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    const id = String(parsed?.id || "").trim();
    const name = String(parsed?.name || "").trim();
    const team = String(parsed?.team || "").trim();

    if (!id || !name || (team !== "A" && team !== "B")) {
      return null;
    }

    return { id, name, team };
  } catch {
    return null;
  }
}

function savePlayerSession(id, name, team) {
  sessionStorage.setItem(PLAYER_SESSION_KEY, JSON.stringify({ id, name, team }));
}

function clearPlayerSession() {
  sessionStorage.removeItem(PLAYER_SESSION_KEY);
}

function createPlayerId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `p-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

async function loadDefaultQuestions() {
  const response = await fetch("./data/questions.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("No se pudo cargar data/questions.json");
  }

  return response.json();
}

function renderAnswers(state) {
  const question = state.questions[state.round.questionIndex];
  answersListEl.innerHTML = "";

  question.answers.forEach((answer, index) => {
    const item = document.createElement("li");
    const visible = state.round.revealed.includes(index);

    item.className = `answer-item ${visible ? "revealed" : "hidden-answer"}`;
    item.innerHTML = `
      <span>${visible ? answer.text : "████████████"}</span>
      <strong>${visible ? answer.points : "--"}</strong>
    `;

    answersListEl.appendChild(item);
  });
}

function renderBuzzerState(state) {
  const isOpen = state.round.status === "buzz-open";
  const isLocked = state.round.status === "locked" && state.round.buzzerWinner;

  buzzerStatusEl.classList.remove("ok", "warn");

  if (isOpen) {
    buzzerStatusEl.textContent = "Buzzer abierto: ¡presionen ahora!";
    buzzerStatusEl.classList.add("ok");
    return;
  }

  if (isLocked) {
    const winnerName = state.teams[state.round.buzzerWinner]?.name || `Equipo ${state.round.buzzerWinner}`;
    buzzerStatusEl.textContent = `Ganó el buzzer: ${winnerName}`;
    buzzerStatusEl.classList.add("warn");
    return;
  }

  buzzerStatusEl.textContent = "Esperando al administrador para abrir buzzer";
}

function render(state) {
  const question = state.questions[state.round.questionIndex];

  teamNameAEl.textContent = state.teams.A.name;
  teamNameBEl.textContent = state.teams.B.name;
  const optionA = playerTeamSelectEl.querySelector('option[value="A"]');
  const optionB = playerTeamSelectEl.querySelector('option[value="B"]');
  optionA.textContent = state.teams.A.name;
  optionB.textContent = state.teams.B.name;

  const session = loadPlayerSession();
  if (session) {
    const teamName = session.team === "A" ? state.teams.A.name : state.teams.B.name;
    playerIdentityEl.innerHTML = `Jugador: <span class="player-identity-value">${session.name}</span> | Equipo: <span class="player-identity-value">${teamName}</span>`;
  } else {
    playerIdentityEl.innerHTML = "Jugador: <span class=\"player-identity-value\">--</span> | Equipo: <span class=\"player-identity-value\">--</span>";
  }

  scoreAEl.textContent = state.teams.A.score;
  scoreBEl.textContent = state.teams.B.score;
  qrModalEl.classList.toggle("hidden", !state.ui?.showQr);
  enforcePlayerSession(state);
  maybeRedirectCaptain(state);

  if (!question) {
    roundLabelEl.textContent = "Sin preguntas";
    questionTextEl.textContent = "Agrega preguntas desde el panel de admin";
    answersListEl.innerHTML = "";
    return;
  }

  roundLabelEl.textContent = `Pregunta ${state.round.questionIndex + 1} / ${state.questions.length}`;
  questionTextEl.textContent = question.question;

  renderAnswers(state);
  renderBuzzerState(state);
}

function maybeRedirectCaptain(state) {
  if (redirectingToCaptain) {
    return;
  }

  const session = loadPlayerSession();
  if (!session) {
    return;
  }

  const captainId = state.round?.captains?.[session.team] || null;
  if (captainId && captainId === session.id) {
    redirectingToCaptain = true;
    window.location.replace(`./captain.html?team=${session.team}`);
  }
}

function enforcePlayerSession(state) {
  const session = loadPlayerSession();
  if (!session) {
    playerRegistered = false;
    playerGateEl.classList.remove("hidden");
    return;
  }

  const current = (state.players || []).find((player) => player.id === session.id);
  if (current && current.active === false) {
    clearPlayerSession();
    playerRegistered = false;
    playerGateErrorEl.textContent = "Tu sesión fue cerrada por el administrador.";
    playerGateEl.classList.remove("hidden");
    return;
  }

  playerRegistered = true;
  playerGateEl.classList.add("hidden");
}

function attachPlayerGateEvents() {
  const existingSession = loadPlayerSession();
  if (existingSession) {
    playerNameInputEl.value = existingSession.name;
    playerTeamSelectEl.value = existingSession.team;
    playerRegistered = true;
    playerGateEl.classList.add("hidden");
    return;
  }

  playerNameInputEl.focus();

  playerGateFormEl.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = playerNameInputEl.value.trim();
    const team = playerTeamSelectEl.value;
    const existing = loadPlayerSession();
    const playerId = existing?.id || createPlayerId();

    if (!name.length) {
      playerGateErrorEl.textContent = "Ingresa tu nombre.";
      return;
    }

    if (team !== "A" && team !== "B") {
      playerGateErrorEl.textContent = "Selecciona un equipo.";
      return;
    }

    await dispatch("REGISTER_PLAYER", { id: playerId, name, team });
    savePlayerSession(playerId, name, team);
    playerRegistered = true;
    playerGateErrorEl.textContent = "";
    playerGateEl.classList.add("hidden");
  });
}

async function main() {
  try {
    attachPlayerGateEvents();
    const defaultQuestions = await loadDefaultQuestions();
    const initialState = await initializeState(defaultQuestions);

    const session = loadPlayerSession();
    if (session) {
      const existing = (initialState.players || []).find((player) => player.id === session.id);
      if (!existing) {
        await dispatch("REGISTER_PLAYER", { id: session.id, name: session.name, team: session.team });
      }
    }

    subscribe(render);

    if (!playerRegistered) {
      playerGateEl.classList.remove("hidden");
    }
  } catch (error) {
    questionTextEl.textContent = "Error cargando la configuración del juego";
    buzzerStatusEl.textContent = error.message;
  }
}

main();
