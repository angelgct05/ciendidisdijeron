import { dispatch, initializeState, subscribe } from "./state.js";

const ADMIN_PIN = "2026";
const ADMIN_AUTH_KEY = "fm100_admin_auth";

const authOverlay = document.getElementById("auth-overlay");
const pinForm = document.getElementById("pin-form");
const pinInput = document.getElementById("pin-input");
const pinError = document.getElementById("pin-error");
const questionsApp = document.getElementById("questions-app");
const logoutAdminButton = document.getElementById("logout-admin");

const summaryEl = document.getElementById("questions-summary");
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

function enableQuestions() {
  authOverlay.classList.add("hidden");
  questionsApp.classList.remove("hidden");
}

function disableQuestions() {
  authOverlay.classList.remove("hidden");
  questionsApp.classList.add("hidden");
}

function ensureAuth() {
  if (localStorage.getItem(ADMIN_AUTH_KEY) === "1") {
    enableQuestions();
    return true;
  }

  window.location.href = "./admin.html";
  return false;
}

function fillFormFromQuestion(question) {
  formQuestion.value = question.question;
  formAnswers.value = formatAnswers(question.answers);
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
      fillFormFromQuestion(item);
      renderQuestionList(state);
    });

    questionItems.appendChild(button);
  });
}

function render(state) {
  if (!state.questions.length) {
    summaryEl.textContent = "No hay preguntas aún. Crea la primera.";
    questionItems.innerHTML = "";
    formQuestion.value = "";
    formAnswers.value = "";
    return;
  }

  summaryEl.textContent = `Total de preguntas: ${state.questions.length}`;

  if (selectedQuestionIndex === null || selectedQuestionIndex >= state.questions.length) {
    selectedQuestionIndex = state.round.questionIndex;
  }

  fillFormFromQuestion(state.questions[selectedQuestionIndex]);
  renderQuestionList(state);
}

function attachEvents() {
  pinForm.addEventListener("submit", (event) => {
    event.preventDefault();
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
    enableQuestions();
  });

  logoutAdminButton.addEventListener("click", () => {
    localStorage.removeItem(ADMIN_AUTH_KEY);
    pinError.textContent = "";
    pinInput.value = "";
    disableQuestions();
    pinInput.focus();
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
  if (!ensureAuth()) {
    return;
  }

  attachEvents();

  let defaults = [];
  try {
    defaults = await loadDefaultQuestions();
  } catch {
    defaults = [];
  }

  await initializeState(defaults);
  subscribe(render);
}

main();
