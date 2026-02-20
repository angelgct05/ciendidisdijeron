import { dispatch, getState, initializeState, isSupabaseConnected, subscribe } from "./state.js";

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
const formAnswerTextInputs = Array.from(document.querySelectorAll("[data-answer-text]"));
const formAnswerPointsInputs = Array.from(document.querySelectorAll("[data-answer-points]"));
const newQuestionButton = document.getElementById("new-question");
const exportJsonButton = document.getElementById("export-json");
const importJsonInput = document.getElementById("import-json");

let selectedQuestionIndex = null;
let currentState = null;

async function loadDefaultQuestions() {
  const response = await fetch("./data/questions.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("No se pudo cargar data/questions.json");
  }

  return response.json();
}

function parseAnswersFromInputs() {
  const answers = [];

  for (let index = 0; index < formAnswerTextInputs.length; index += 1) {
    const text = formAnswerTextInputs[index].value.trim();
    const pointsRaw = formAnswerPointsInputs[index].value.trim();

    if (!text) {
      continue;
    }

    const points = Number(pointsRaw);
    answers.push({
      text,
      points: Number.isFinite(points) && points >= 0 ? points : 0,
    });
  }

  return answers;
}

function fillAnswersInputs(answers) {
  formAnswerTextInputs.forEach((input, index) => {
    input.value = answers[index]?.text || "";
  });

  formAnswerPointsInputs.forEach((input, index) => {
    const points = answers[index]?.points;
    input.value = Number.isFinite(Number(points)) ? String(points) : "";
  });
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
  fillAnswersInputs(question.answers);
}

function renderQuestionList(state) {
  questionItems.innerHTML = "";

  state.questions.forEach((item, index) => {
    const row = document.createElement("article");
    row.className = `question-row ${index === selectedQuestionIndex ? "active" : ""}`;

    const textCell = document.createElement("p");
    textCell.className = "question-cell";
    textCell.textContent = `${index + 1}. ${item.question}`;

    const actionsCell = document.createElement("div");
    actionsCell.className = "question-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "question-action-btn";
    editButton.textContent = "Editar";
    editButton.addEventListener("click", () => {
      selectedQuestionIndex = index;
      fillFormFromQuestion(item);
      renderQuestionList(state);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "question-action-btn danger";
    deleteButton.textContent = "Eliminar";
    deleteButton.addEventListener("click", async () => {
      const confirmed = window.confirm("¿Estás seguro de eliminar esta pregunta?");
      if (!confirmed) {
        return;
      }

      try {
        await dispatch("DELETE_QUESTION", { index });
        if (selectedQuestionIndex === index) {
          selectedQuestionIndex = null;
        }
      } catch (error) {
        summaryEl.textContent = error?.message || "No se pudo eliminar en Supabase.";
      }
    });

    actionsCell.appendChild(editButton);
    actionsCell.appendChild(deleteButton);

    row.appendChild(textCell);
    row.appendChild(actionsCell);

    questionItems.appendChild(row);
  });
}

function render(state) {
  currentState = state;

  if (!state.questions.length) {
    summaryEl.textContent = isSupabaseConnected()
      ? "No hay preguntas aún. Crea la primera (guardado en Supabase)."
      : "No hay conexión con Supabase para guardar preguntas.";
    questionItems.innerHTML = "";
    formQuestion.value = "";
    fillAnswersInputs([]);
    return;
  }

  summaryEl.textContent = isSupabaseConnected()
    ? `Total de preguntas: ${state.questions.length} · Guardado en Supabase`
    : `Total de preguntas: ${state.questions.length} · Sin conexión a Supabase`;

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

  questionForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const questionText = formQuestion.value.trim();
    const answers = parseAnswersFromInputs();

    if (!questionText || !answers.length) {
      summaryEl.textContent = "Completa pregunta y respuestas válidas.";
      return;
    }

    try {
      await dispatch("UPSERT_QUESTION", {
        index: selectedQuestionIndex,
        question: {
          id: `q${Date.now()}`,
          question: questionText,
          answers,
        },
      });
    } catch (error) {
      summaryEl.textContent = error?.message || "No se pudo guardar en Supabase.";
    }
  });

  newQuestionButton.addEventListener("click", () => {
    selectedQuestionIndex = null;
    formQuestion.value = "";
    fillAnswersInputs([]);
    formQuestion.focus();
  });

  exportJsonButton.addEventListener("click", () => {
    const questions = currentState?.questions || getState()?.questions || [];
    const blob = new Blob([JSON.stringify(questions, null, 2)], { type: "application/json" });
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
    try {
      await dispatch("SET_QUESTIONS", { questions: parsed });
      selectedQuestionIndex = 0;
      importJsonInput.value = "";
    } catch (error) {
      summaryEl.textContent = error?.message || "No se pudo importar en Supabase.";
    }
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
