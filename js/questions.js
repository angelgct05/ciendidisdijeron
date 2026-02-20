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
const sortButtons = Array.from(document.querySelectorAll("[data-sort]"));

let selectedQuestionIndex = null;
let currentState = null;
let sortBy = "index";
let sortDirection = "asc";
let expandedQuestionIndex = null;

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

function getSortedItems(state) {
  const mapped = state.questions.map((question, index) => ({ question, index }));

  mapped.sort((left, right) => {
    if (sortBy === "question") {
      const leftText = left.question.question.toLowerCase();
      const rightText = right.question.question.toLowerCase();
      const comparison = leftText.localeCompare(rightText, "es", { sensitivity: "base" });
      return sortDirection === "asc" ? comparison : -comparison;
    }

    const comparison = left.index - right.index;
    return sortDirection === "asc" ? comparison : -comparison;
  });

  return mapped;
}

function renderSortButtons() {
  sortButtons.forEach((button) => {
    const isActive = button.dataset.sort === sortBy;
    button.classList.toggle("active", isActive);

    if (!isActive) {
      button.textContent = button.dataset.sort === "index" ? "#" : "Pregunta";
      return;
    }

    const arrow = sortDirection === "asc" ? "↑" : "↓";
    button.textContent = button.dataset.sort === "index" ? `# ${arrow}` : `Pregunta ${arrow}`;
  });
}

function renderQuestionList(state) {
  questionItems.innerHTML = "";
  renderSortButtons();

  const sortedItems = getSortedItems(state);

  sortedItems.forEach(({ question: item, index }) => {
    const row = document.createElement("tr");
    row.className = `question-row ${index === selectedQuestionIndex ? "active" : ""}`;

    const orderCell = document.createElement("td");
    orderCell.className = "question-order-cell";
    orderCell.textContent = String(index + 1);

    const textCell = document.createElement("td");
    textCell.className = "question-cell";
    textCell.textContent = item.question;

    const actionsCell = document.createElement("td");
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

    const toggleAnswersButton = document.createElement("button");
    toggleAnswersButton.type = "button";
    toggleAnswersButton.className = "question-action-btn";
    toggleAnswersButton.textContent = expandedQuestionIndex === index ? "Ocultar respuestas" : "Respuestas";
    toggleAnswersButton.addEventListener("click", () => {
      expandedQuestionIndex = expandedQuestionIndex === index ? null : index;
      renderQuestionList(state);
    });

    actionsCell.appendChild(editButton);
    actionsCell.appendChild(toggleAnswersButton);
    actionsCell.appendChild(deleteButton);

    row.appendChild(orderCell);
    row.appendChild(textCell);
    row.appendChild(actionsCell);

    questionItems.appendChild(row);

    if (expandedQuestionIndex === index) {
      const expandedRow = document.createElement("tr");
      expandedRow.className = "answers-expanded-row";

      const expandedCell = document.createElement("td");
      expandedCell.colSpan = 3;

      const wrapper = document.createElement("div");
      wrapper.className = "answers-expanded-wrap";

      const title = document.createElement("p");
      title.className = "answers-expanded-title";
      title.textContent = `Configurar respuestas de: ${item.question}`;

      const table = document.createElement("table");
      table.className = "answers-config-table";
      table.innerHTML = `
        <thead>
          <tr>
            <th>#</th>
            <th>Respuesta</th>
            <th>Puntos</th>
          </tr>
        </thead>
      `;

      const tbody = document.createElement("tbody");
      const responseTextInputs = [];
      const responsePointsInputs = [];

      for (let answerIndex = 0; answerIndex < 5; answerIndex += 1) {
        const answer = item.answers[answerIndex] || {};
        const tr = document.createElement("tr");

        const orderTd = document.createElement("td");
        orderTd.textContent = String(answerIndex + 1);

        const textTd = document.createElement("td");
        const textInput = document.createElement("input");
        textInput.placeholder = `Respuesta ${answerIndex + 1}`;
        textInput.value = answer.text || "";
        textTd.appendChild(textInput);

        const pointsTd = document.createElement("td");
        const pointsInput = document.createElement("input");
        pointsInput.type = "number";
        pointsInput.min = "0";
        pointsInput.step = "1";
        pointsInput.placeholder = "Puntos";
        pointsInput.value = Number.isFinite(Number(answer.points)) ? String(answer.points) : "";
        pointsTd.appendChild(pointsInput);

        responseTextInputs.push(textInput);
        responsePointsInputs.push(pointsInput);

        tr.appendChild(orderTd);
        tr.appendChild(textTd);
        tr.appendChild(pointsTd);
        tbody.appendChild(tr);
      }

      table.appendChild(tbody);

      const actions = document.createElement("div");
      actions.className = "answers-expanded-actions";

      const saveButton = document.createElement("button");
      saveButton.type = "button";
      saveButton.textContent = "Guardar respuestas";
      saveButton.addEventListener("click", async () => {
        const nextAnswers = responseTextInputs
          .map((input, responseIndex) => {
            const text = input.value.trim();
            const pointsValue = responsePointsInputs[responseIndex].value.trim();
            if (!text) {
              return null;
            }

            const points = Number(pointsValue);
            return {
              text,
              points: Number.isFinite(points) && points >= 0 ? points : 0,
            };
          })
          .filter(Boolean);

        if (!nextAnswers.length) {
          summaryEl.textContent = "Debes capturar al menos una respuesta para guardar.";
          return;
        }

        try {
          await dispatch("UPSERT_QUESTION", {
            index,
            question: {
              id: item.id || `q${Date.now()}`,
              question: item.question,
              answers: nextAnswers,
            },
          });
          summaryEl.textContent = "Respuestas guardadas correctamente.";
        } catch (error) {
          summaryEl.textContent = error?.message || "No se pudieron guardar las respuestas en Supabase.";
        }
      });

      actions.appendChild(saveButton);
      wrapper.appendChild(title);
      wrapper.appendChild(table);
      wrapper.appendChild(actions);
      expandedCell.appendChild(wrapper);
      expandedRow.appendChild(expandedCell);

      questionItems.appendChild(expandedRow);
    }
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

  sortButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextSortBy = button.dataset.sort;
      if (!nextSortBy) {
        return;
      }

      if (sortBy === nextSortBy) {
        sortDirection = sortDirection === "asc" ? "desc" : "asc";
      } else {
        sortBy = nextSortBy;
        sortDirection = "asc";
      }

      if (currentState) {
        renderQuestionList(currentState);
      }
    });
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
