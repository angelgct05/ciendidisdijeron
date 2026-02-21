import { dispatch, getState, initializeState, subscribe, subscribeConnectionStatus } from "./state.js";

const ADMIN_PIN = "2026";
const ADMIN_AUTH_KEY = "fm100_admin_auth";

const authOverlay = document.getElementById("auth-overlay");
const pinForm = document.getElementById("pin-form");
const pinInput = document.getElementById("pin-input");
const pinError = document.getElementById("pin-error");
const adminApp = document.getElementById("admin-app");
const logoutAdminButton = document.getElementById("logout-admin");

const adminTeamNameA = document.getElementById("admin-team-name-a");
const adminTeamNameB = document.getElementById("admin-team-name-b");
const teamNameInputA = document.getElementById("team-name-a-input");
const teamNameInputB = document.getElementById("team-name-b-input");
const adminScoreA = document.getElementById("admin-score-a");
const adminScoreB = document.getElementById("admin-score-b");
const adminStrikesA = document.getElementById("admin-strikes-a");
const adminStrikesB = document.getElementById("admin-strikes-b");
const addStrikeAButton = document.getElementById("add-strike-a");
const addStrikeBButton = document.getElementById("add-strike-b");
const scoreDeltaInputA = document.getElementById("score-delta-a");
const scoreDeltaInputB = document.getElementById("score-delta-b");
const teamMembersA = document.getElementById("team-members-a");
const teamMembersB = document.getElementById("team-members-b");
const openBuzzButton = document.getElementById("open-buzz");
const toggleQrButton = document.getElementById("toggle-qr");
const awardRevealedPointsButton = document.getElementById("award-revealed-points");
const logoutAllPlayersButton = document.getElementById("logout-all-players");
const resetRoundButton = document.getElementById("reset-round");
const nextQuestionButton = document.getElementById("next-question");
const prevQuestionButton = document.getElementById("prev-question");
const resetGameButton = document.getElementById("reset-game");
const adminSupabaseStatus = document.getElementById("admin-supabase-status");
const adminBuzzerStatus = document.getElementById("admin-buzzer-status");
const adminRoundControl = document.getElementById("admin-round-control");
const adminRoundLabel = document.getElementById("admin-round-label");
const adminQuestionText = document.getElementById("admin-question-text");
const adminAnswersList = document.getElementById("admin-answers-list");
const adminConfirmModal = document.getElementById("admin-confirm-modal");
const adminConfirmMessage = document.getElementById("admin-confirm-message");
const adminConfirmCancelButton = document.getElementById("admin-confirm-cancel");
const adminConfirmAcceptButton = document.getElementById("admin-confirm-accept");

let pendingConfirmAction = null;

async function loadDefaultQuestions() {
  const response = await fetch("./data/questions.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("No se pudo cargar data/questions.json");
  }

  return response.json();
}

function renderAdminAnswers(state) {
  const question = state.questions[state.round.questionIndex];
  adminAnswersList.innerHTML = "";

  question.answers.forEach((answer, index) => {
    const item = document.createElement("li");
    const visible = state.round.revealed.includes(index);

    item.className = `answer-item admin-answer-item ${visible ? "revealed" : ""}`;
    item.innerHTML = `
      <div class="admin-answer-main">
        <span>${answer.text}</span>
      </div>
      <div class="admin-answer-actions">
        <strong>${answer.points}</strong>
        <button type="button" class="question-action-btn" data-answer-toggle="${index}">${visible ? "Ocultar" : "Mostrar"}</button>
      </div>
    `;

    const toggleButton = item.querySelector("[data-answer-toggle]");
    toggleButton.addEventListener("click", () => {
      dispatch("TOGGLE_REVEAL", { answerIndex: index });
    });

    adminAnswersList.appendChild(item);
  });
}

function renderBuzzerInfo(state) {
  adminBuzzerStatus.classList.remove("ok", "warn");

  if (state.round.status === "buzz-open") {
    adminBuzzerStatus.textContent = "Buzzer abierto.";
    adminBuzzerStatus.classList.add("ok");
    return;
  }

  if (state.round.status === "locked" && state.round.buzzerWinner) {
    adminBuzzerStatus.textContent = "Buzzer bloqueado.";
    adminBuzzerStatus.classList.add("warn");
    return;
  }

  adminBuzzerStatus.textContent = "Buzzer cerrado.";
}

function getRevealedPointsTotal(state) {
  const question = state.questions[state.round.questionIndex];
  if (!question) {
    return 0;
  }

  const revealedIndexes = Array.from(new Set(state.round.revealed || []));
  return revealedIndexes.reduce((total, index) => {
    const answer = question.answers[index];
    if (!answer) {
      return total;
    }

    const points = Number(answer.points);
    return total + (Number.isFinite(points) && points > 0 ? points : 0);
  }, 0);
}

function renderSupabaseStatus(status) {
  adminSupabaseStatus.classList.remove("status-connected", "status-connecting", "status-disconnected");

  if (status === "connected") {
    adminSupabaseStatus.textContent = "Base de Datos: conectado";
    adminSupabaseStatus.classList.add("status-connected");
    return;
  }

  if (status === "connecting") {
    adminSupabaseStatus.textContent = "Base de Datos: conectando...";
    adminSupabaseStatus.classList.add("status-connecting");
    return;
  }

  adminSupabaseStatus.textContent = "Base de Datos: no conectado";
  adminSupabaseStatus.classList.add("status-disconnected");
}

function syncInputValue(input, value) {
  if (document.activeElement !== input) {
    input.value = value;
  }
}

function renderTeamMembers(state, team, container) {
  const players = (state.players || []).filter((player) => player.active && player.team === team);
  const currentCaptainId = state.round?.captains?.[team] || null;
  container.innerHTML = "";

  if (!players.length) {
    const empty = document.createElement("li");
    empty.className = "team-member-item team-member-empty";
    empty.textContent = "Sin integrantes activos";
    container.appendChild(empty);
    return;
  }

  players.forEach((player) => {
    const isCaptain = player.id === currentCaptainId;
    const item = document.createElement("li");
    item.className = "team-member-item";
    item.innerHTML = `
      <span>${player.name}${isCaptain ? " (Capitán)" : ""}</span>
      <div class="team-member-actions">
        ${isCaptain ? '<span class="captain-badge">Capitán</span>' : `<button type="button" class="question-action-btn" data-player-captain="${player.id}">Elegir Capitán</button>`}
        ${isCaptain ? `<button type="button" class="question-action-btn" data-remove-captain="${team}">Quitar Capitán</button>` : ""}
        <button type="button" class="question-action-btn" data-player-logout="${player.id}">Cerrar sesión</button>
      </div>
    `;

    const captainButton = item.querySelector("[data-player-captain]");
    if (captainButton) {
      captainButton.addEventListener("click", () => {
        dispatch("SET_ROUND_CAPTAIN", { team, playerId: player.id });
      });
    }

    const removeCaptainButton = item.querySelector("[data-remove-captain]");
    if (removeCaptainButton) {
      removeCaptainButton.addEventListener("click", () => {
        dispatch("SET_ROUND_CAPTAIN", { team, playerId: null });
      });
    }

    const logoutButton = item.querySelector("[data-player-logout]");
    logoutButton.addEventListener("click", () => {
      dispatch("LOGOUT_PLAYER", { id: player.id });
    });

    container.appendChild(item);
  });
}

function render(state) {
  const question = state.questions[state.round.questionIndex];

  adminTeamNameA.textContent = state.teams.A.name;
  adminTeamNameB.textContent = state.teams.B.name;
  syncInputValue(teamNameInputA, state.teams.A.name);
  syncInputValue(teamNameInputB, state.teams.B.name);

  adminScoreA.textContent = state.teams.A.score;
  adminScoreB.textContent = state.teams.B.score;
  adminStrikesA.textContent = String(state.teams.A.strikes || 0);
  adminStrikesB.textContent = String(state.teams.B.strikes || 0);
  renderTeamMembers(state, "A", teamMembersA);
  renderTeamMembers(state, "B", teamMembersB);
  toggleQrButton.textContent = state.ui?.showQr ? "Ocultar QR" : "Mostrar QR";
  const controlTeam = state.round.buzzerWinner;
  if (controlTeam === "A" || controlTeam === "B") {
    const controlName = state.teams[controlTeam]?.name || `Equipo ${controlTeam}`;
    adminRoundControl.textContent = `Control de ronda: ${controlName}`;
  } else {
    adminRoundControl.textContent = "Control de ronda: sin equipo";
  }

  const revealedPoints = getRevealedPointsTotal(state);
  awardRevealedPointsButton.disabled = !(controlTeam === "A" || controlTeam === "B") || revealedPoints <= 0;
  prevQuestionButton.disabled = state.round.questionIndex <= 0;
  nextQuestionButton.disabled = state.round.questionIndex >= state.questions.length - 1;

  if (!question) {
    adminRoundLabel.textContent = "Sin preguntas";
    adminQuestionText.textContent = "Importa o crea preguntas";
    adminAnswersList.innerHTML = "";
    return;
  }

  adminRoundLabel.textContent = `Pregunta ${state.round.questionIndex + 1} / ${state.questions.length}`;
  adminQuestionText.textContent = question.question;

  renderAdminAnswers(state);
  renderBuzzerInfo(state);
}

function enableAdmin() {
  authOverlay.classList.add("hidden");
  adminApp.classList.remove("hidden");
}

function disableAdmin() {
  authOverlay.classList.remove("hidden");
  adminApp.classList.add("hidden");
}

function ensureAuth() {
  const saved = localStorage.getItem(ADMIN_AUTH_KEY);
  if (saved === "1") {
    enableAdmin();
  }
}

function closeConfirmModal() {
  adminConfirmModal.classList.add("hidden");
  pendingConfirmAction = null;
}

function openConfirmModal(message, onConfirm) {
  adminConfirmMessage.textContent = message;
  pendingConfirmAction = onConfirm;
  adminConfirmModal.classList.remove("hidden");
}

function attachEvents() {
  pinForm.addEventListener("submit", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const pin = pinInput.value.trim();

    if (!/^\d{4}$/.test(pin)) {
      pinError.textContent = "Ingresa un PIN numérico de 4 dígitos";
      return;
    }

    if (pin !== ADMIN_PIN) {
      pinError.textContent = "PIN incorrecto";
      return;
    }

    localStorage.setItem(ADMIN_AUTH_KEY, "1");
    pinError.textContent = "";
    pinInput.value = "";
    enableAdmin();
  });

  openBuzzButton.addEventListener("click", () => {
    dispatch("OPEN_BUZZ");
  });
  toggleQrButton.addEventListener("click", () => {
    const state = getState();
    dispatch("TOGGLE_QR", { value: !state.ui?.showQr });
  });
  addStrikeAButton.addEventListener("click", () => dispatch("ADD_STRIKE", { team: "A" }));
  addStrikeBButton.addEventListener("click", () => dispatch("ADD_STRIKE", { team: "B" }));
  awardRevealedPointsButton.addEventListener("click", () => {
    const state = getState();
    const controlTeam = state.round.buzzerWinner;
    if (controlTeam !== "A" && controlTeam !== "B") {
      return;
    }

    const points = getRevealedPointsTotal(state);
    if (points <= 0) {
      return;
    }

    dispatch("ADD_SCORE", { team: controlTeam, points });
  });
  logoutAllPlayersButton.addEventListener("click", () => {
    openConfirmModal("¿Seguro que deseas cerrar la sesión de todos los jugadores?", () => dispatch("LOGOUT_ALL_PLAYERS"));
  });
  resetRoundButton.addEventListener("click", () => {
    openConfirmModal("¿Seguro que deseas resetear la ronda actual?", () => dispatch("RESET_ROUND"));
  });
  nextQuestionButton.addEventListener("click", () => dispatch("NEXT_QUESTION"));
  prevQuestionButton.addEventListener("click", () => dispatch("PREV_QUESTION"));
  resetGameButton.addEventListener("click", () => {
    openConfirmModal("¿Seguro que deseas resetear toda la partida?", () => dispatch("RESET_GAME"));
  });

  adminConfirmCancelButton.addEventListener("click", closeConfirmModal);
  adminConfirmAcceptButton.addEventListener("click", () => {
    const action = pendingConfirmAction;
    closeConfirmModal();
    if (action) {
      action();
    }
  });

  adminConfirmModal.addEventListener("click", (event) => {
    if (event.target === adminConfirmModal) {
      closeConfirmModal();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !adminConfirmModal.classList.contains("hidden")) {
      closeConfirmModal();
    }
  });

  logoutAdminButton.addEventListener("click", () => {
    localStorage.removeItem(ADMIN_AUTH_KEY);
    pinError.textContent = "";
    pinInput.value = "";
    disableAdmin();
    pinInput.focus();
  });

  const updateTeamName = (team, input) => {
    dispatch("SET_TEAM_NAME", { team, name: input.value });
  };

  teamNameInputA.addEventListener("change", () => updateTeamName("A", teamNameInputA));
  teamNameInputB.addEventListener("change", () => updateTeamName("B", teamNameInputB));
  teamNameInputA.addEventListener("blur", () => updateTeamName("A", teamNameInputA));
  teamNameInputB.addEventListener("blur", () => updateTeamName("B", teamNameInputB));

  [
    [teamNameInputA, "A"],
    [teamNameInputB, "B"],
  ].forEach(([input, team]) => {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        updateTeamName(team, input);
        input.blur();
      }
    });
  });

  document.querySelectorAll("[data-score-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const [team, operation] = button.dataset.scoreAction.split(":");
      const sourceInput = team === "A" ? scoreDeltaInputA : scoreDeltaInputB;
      const baseValue = Number(sourceInput.value);
      const normalized = Number.isFinite(baseValue) && baseValue > 0 ? Math.floor(baseValue) : 0;
      const points = operation === "sub" ? -normalized : normalized;
      if (!points) {
        return;
      }

      dispatch("ADD_SCORE", { team, points: Number(points) });
    });
  });
}

async function main() {
  attachEvents();
  ensureAuth();

  let defaults = [];
  try {
    defaults = await loadDefaultQuestions();
  } catch (error) {
    pinError.textContent = "No se pudo cargar questions.json. Puedes seguir usando el panel con datos locales.";
  }

  await initializeState(defaults);
  subscribeConnectionStatus(renderSupabaseStatus);
  subscribe(render);
}

main();
