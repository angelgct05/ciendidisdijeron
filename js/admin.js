import { dispatch, initializeState, subscribe, subscribeConnectionStatus } from "./state.js";

const ADMIN_PIN = "2026";
const ADMIN_AUTH_KEY = "fm100_admin_auth";

const authOverlay = document.getElementById("auth-overlay");
const pinForm = document.getElementById("pin-form");
const pinInput = document.getElementById("pin-input");
const pinError = document.getElementById("pin-error");
const adminApp = document.getElementById("admin-app");
const logoutAdminButton = document.getElementById("logout-admin");

const adminScoreA = document.getElementById("admin-score-a");
const adminScoreB = document.getElementById("admin-score-b");
const openBuzzButton = document.getElementById("open-buzz");
const resetRoundButton = document.getElementById("reset-round");
const nextQuestionButton = document.getElementById("next-question");
const prevQuestionButton = document.getElementById("prev-question");
const resetGameButton = document.getElementById("reset-game");
const adminSupabaseStatus = document.getElementById("admin-supabase-status");
const adminBuzzerStatus = document.getElementById("admin-buzzer-status");
const adminRoundLabel = document.getElementById("admin-round-label");
const adminQuestionText = document.getElementById("admin-question-text");
const adminAnswersList = document.getElementById("admin-answers-list");

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

    item.className = `answer-item ${visible ? "revealed" : "hidden-answer"}`;
    item.innerHTML = `
      <span>${visible ? answer.text : "████████████"}</span>
      <strong>${visible ? answer.points : "--"}</strong>
    `;

    item.addEventListener("click", () => {
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
    adminBuzzerStatus.textContent = `Ganó el buzzer: Equipo ${state.round.buzzerWinner}`;
    adminBuzzerStatus.classList.add("warn");
    return;
  }

  adminBuzzerStatus.textContent = "Buzzer cerrado.";
}

function renderSupabaseStatus(status) {
  adminSupabaseStatus.classList.remove("status-connected", "status-connecting", "status-disconnected");

  if (status === "connected") {
    adminSupabaseStatus.textContent = "Supabase: conectado";
    adminSupabaseStatus.classList.add("status-connected");
    return;
  }

  if (status === "connecting") {
    adminSupabaseStatus.textContent = "Supabase: conectando...";
    adminSupabaseStatus.classList.add("status-connecting");
    return;
  }

  adminSupabaseStatus.textContent = "Supabase: no conectado";
  adminSupabaseStatus.classList.add("status-disconnected");
}

function render(state) {
  const question = state.questions[state.round.questionIndex];

  adminScoreA.textContent = state.teams.A.score;
  adminScoreB.textContent = state.teams.B.score;

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

  openBuzzButton.addEventListener("click", () => dispatch("OPEN_BUZZ"));
  resetRoundButton.addEventListener("click", () => dispatch("RESET_ROUND"));
  nextQuestionButton.addEventListener("click", () => dispatch("NEXT_QUESTION"));
  prevQuestionButton.addEventListener("click", () => dispatch("PREV_QUESTION"));
  resetGameButton.addEventListener("click", () => dispatch("RESET_GAME"));

  logoutAdminButton.addEventListener("click", () => {
    localStorage.removeItem(ADMIN_AUTH_KEY);
    pinError.textContent = "";
    pinInput.value = "";
    disableAdmin();
    pinInput.focus();
  });

  document.querySelectorAll("[data-score]").forEach((button) => {
    button.addEventListener("click", () => {
      const [team, points] = button.dataset.score.split(":");
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
