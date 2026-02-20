import { dispatch, initializeState, subscribe } from "./state.js";

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
const adminBuzzerStatus = document.getElementById("admin-buzzer-status");
const adminRoundLabel = document.getElementById("admin-round-label");
const adminQuestionText = document.getElementById("admin-question-text");
const adminAnswersList = document.getElementById("admin-answers-list");

const questionItems = document.getElementById("question-items");
const questionForm = document.getElementById("question-form");
const formQuestion = document.getElementById("form-question");
const formAnswers = document.getElementById("form-answers");
const newQuestionButton = document.getElementById("new-question");
const deleteQuestionButton = document.getElementById("delete-question");
const exportJsonButton = document.getElementById("export-json");
const importJsonInput = document.getElementById("import-json");

let selectedQuestionIndex = null;

async function loadDefaultQuestions() {
  const response = await fetch("./data/questions.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("No se pudo cargar data/questions.json");
  }

  return response.json();
}

function parseAnswers(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [answerText, pointsRaw] = line.split("|");
      const points = Number(pointsRaw);

      return {
        text: (answerText || "").trim(),
        points: Number.isFinite(points) ? points : 0,
      };
    })
    .filter((item) => item.text.length > 0);
}

function formatAnswers(answers) {
  return answers.map((answer) => `${answer.text}|${answer.points}`).join("\n");
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

function renderQuestionList(state) {
  questionItems.innerHTML = "";

  state.questions.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `question-item ${index === selectedQuestionIndex ? "active" : ""}`;
    button.textContent = `${index + 1}. ${item.question}`;

    button.addEventListener("click", () => {
      selectedQuestionIndex = index;
      formQuestion.value = item.question;
      formAnswers.value = formatAnswers(item.answers);
      renderQuestionList(state);
    });

    questionItems.appendChild(button);
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

function render(state) {
  const question = state.questions[state.round.questionIndex];

  adminScoreA.textContent = state.teams.A.score;
  adminScoreB.textContent = state.teams.B.score;

  if (!question) {
    adminRoundLabel.textContent = "Sin preguntas";
    adminQuestionText.textContent = "Importa o crea preguntas";
    adminAnswersList.innerHTML = "";
    questionItems.innerHTML = "";
    return;
  }

  adminRoundLabel.textContent = `Pregunta ${state.round.questionIndex + 1} / ${state.questions.length}`;
  adminQuestionText.textContent = question.question;

  renderAdminAnswers(state);
  renderBuzzerInfo(state);

  if (selectedQuestionIndex === null || selectedQuestionIndex >= state.questions.length) {
    selectedQuestionIndex = state.round.questionIndex;
    formQuestion.value = state.questions[selectedQuestionIndex].question;
    formAnswers.value = formatAnswers(state.questions[selectedQuestionIndex].answers);
  }

  renderQuestionList(state);
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

  questionForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const questionText = formQuestion.value.trim();
    const answers = parseAnswers(formAnswers.value);

    if (!questionText || !answers.length) {
      return;
    }

    dispatch("UPSERT_QUESTION", {
      index: selectedQuestionIndex,
      question: {
        id: `q${Date.now()}`,
        question: questionText,
        answers,
      },
    });
  });

  newQuestionButton.addEventListener("click", () => {
    selectedQuestionIndex = null;
    formQuestion.value = "";
    formAnswers.value = "";
    formQuestion.focus();
  });

  deleteQuestionButton.addEventListener("click", () => {
    if (selectedQuestionIndex === null) {
      return;
    }

    dispatch("DELETE_QUESTION", { index: selectedQuestionIndex });
    selectedQuestionIndex = null;
  });

  exportJsonButton.addEventListener("click", () => {
    const state = JSON.parse(localStorage.getItem("fm100_state_v1") || "{}");
    const blob = new Blob([JSON.stringify(state.questions || [], null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "questions.json";
    anchor.click();
    URL.revokeObjectURL(url);
  });

  importJsonInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    const parsed = JSON.parse(text);
    dispatch("SET_QUESTIONS", { questions: parsed });
    selectedQuestionIndex = 0;
    importJsonInput.value = "";
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
  subscribe(render);
}

main();
