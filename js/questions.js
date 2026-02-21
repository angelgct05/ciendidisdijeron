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
const newQuestionButton = document.getElementById("new-question");
const sortButtons = Array.from(document.querySelectorAll("[data-sort]"));
const questionModal = document.getElementById("question-modal");
const questionModalTitle = document.getElementById("question-modal-title");
const questionModalInput = document.getElementById("question-modal-input");
const questionModalError = document.getElementById("question-modal-error");
const questionModalCancel = document.getElementById("question-modal-cancel");
const questionModalSave = document.getElementById("question-modal-save");
const successModal = document.getElementById("success-modal");
const successModalMessage = document.getElementById("success-modal-message");
const successModalClose = document.getElementById("success-modal-close");
const correctSound = new Audio("./assets/audio/correcto.mp3");
const incorrectSound = new Audio("./assets/audio/incorrecto.mp3");
const aJugarSound = new Audio("./assets/audio/a_jugar.mp3");
const triunfoSound = new Audio("./assets/audio/triunfo.mp3");

let currentState = null;
let sortBy = "index";
let sortDirection = "asc";
let expandedQuestionIndex = null;
let modalMode = "create";
let modalQuestionIndex = null;
let modalQuestionBase = null;
let lastSoundEventVersion = null;
let pendingSoundEvent = null;
let audioUnlockConfigured = false;

function playSound(sound) {
  if (!sound) {
    return Promise.resolve(false);
  }

  sound.currentTime = 0;
  return sound.play().then(() => true).catch(() => false);
}

function getSoundByType(type) {
  if (type === "correct") {
    return correctSound;
  }

  if (type === "incorrect") {
    return incorrectSound;
  }

  if (type === "a_jugar") {
    return aJugarSound;
  }

  if (type === "triunfo") {
    return triunfoSound;
  }

  return null;
}

async function tryPlaySoundEvent(type, version) {
  const sound = getSoundByType(type);
  if (!sound) {
    return;
  }

  const played = await playSound(sound);
  if (played) {
    lastSoundEventVersion = version;
    pendingSoundEvent = null;
  } else {
    pendingSoundEvent = { type, version };
  }
}

async function unlockAudioAndReplay() {
  const sounds = [correctSound, incorrectSound, aJugarSound, triunfoSound];
  await Promise.allSettled(
    sounds.map(async (sound) => {
      sound.muted = true;
      sound.currentTime = 0;
      const ok = await playSound(sound);
      if (ok) {
        sound.pause();
        sound.currentTime = 0;
      }
      sound.muted = false;
    })
  );

  if (pendingSoundEvent) {
    const { type, version } = pendingSoundEvent;
    tryPlaySoundEvent(type, version);
  }
}

function setupAudioUnlock() {
  if (audioUnlockConfigured) {
    return;
  }

  audioUnlockConfigured = true;
  const unlock = () => {
    unlockAudioAndReplay();
  };

  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("touchstart", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}

function handleGlobalSound(state) {
  const version = Number(state.ui?.soundEventVersion) || 0;
  const type = state.ui?.soundEventType || null;

  if (lastSoundEventVersion === null) {
    lastSoundEventVersion = version;
    return;
  }

  if (version <= lastSoundEventVersion || !type) {
    return;
  }

  tryPlaySoundEvent(type, version);
}

async function loadDefaultQuestions() {
  const response = await fetch("./data/questions.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("No se pudo cargar data/questions.json");
  }

  return response.json();
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

function openQuestionModal({ mode, index = null, questionText = "", questionBase = null }) {
  modalMode = mode;
  modalQuestionIndex = index;
  modalQuestionBase = questionBase;
  questionModalTitle.textContent = mode === "edit" ? "Editar pregunta" : "Nueva pregunta";
  questionModalInput.value = questionText;
  questionModalError.textContent = "";
  questionModal.classList.remove("hidden");
  questionModalInput.focus();
}

function closeQuestionModal() {
  questionModal.classList.add("hidden");
  questionModalInput.value = "";
  questionModalError.textContent = "";
  modalQuestionIndex = null;
  modalQuestionBase = null;
}

function openSuccessModal(message) {
  successModalMessage.textContent = message;
  successModal.classList.remove("hidden");
}

function closeSuccessModal() {
  successModal.classList.add("hidden");
}

async function saveQuestionFromModal() {
  const questionText = questionModalInput.value.trim();
  if (!questionText) {
    questionModalError.textContent = "Escribe el texto de la pregunta.";
    return;
  }

  const fallbackAnswers = [{ text: "Respuesta", points: 0 }];
  const baseAnswers = modalQuestionBase?.answers?.length ? modalQuestionBase.answers : fallbackAnswers;

  try {
    await dispatch("UPSERT_QUESTION", {
      index: modalMode === "edit" ? modalQuestionIndex : undefined,
      question: {
        id: modalQuestionBase?.id || `q${Date.now()}`,
        question: questionText,
        answers: baseAnswers,
      },
    });

    if (modalMode === "create") {
      expandedQuestionIndex = currentState?.questions?.length ?? null;
    }

    closeQuestionModal();
  } catch (error) {
    questionModalError.textContent = error?.message || "No se pudo guardar en Base de Datos.";
  }
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
    row.className = "question-row";

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
      openQuestionModal({
        mode: "edit",
        index,
        questionText: item.question,
        questionBase: item,
      });
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
        if (expandedQuestionIndex === index) {
          expandedQuestionIndex = null;
        }
      } catch (error) {
        summaryEl.textContent = error?.message || "No se pudo eliminar en Base de Datos.";
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
          openSuccessModal("Las respuestas se guardaron correctamente en Base de Datos.");
        } catch (error) {
          summaryEl.textContent = error?.message || "No se pudieron guardar las respuestas en Base de Datos.";
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
  handleGlobalSound(state);
  currentState = state;

  if (!state.questions.length) {
    summaryEl.textContent = isSupabaseConnected()
      ? "No hay preguntas aún. Crea la primera (guardado en Base de Datos)."
      : "No hay conexión con Base de Datos para guardar preguntas.";
    questionItems.innerHTML = "";
    return;
  }

  summaryEl.textContent = isSupabaseConnected()
    ? `Total de preguntas: ${state.questions.length} · Guardado en Base de Datos`
    : `Total de preguntas: ${state.questions.length} · Sin conexión a Base de Datos`;

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

  newQuestionButton.addEventListener("click", async () => {
    openQuestionModal({ mode: "create" });
  });

  questionModalCancel.addEventListener("click", closeQuestionModal);
  questionModalSave.addEventListener("click", saveQuestionFromModal);
  successModalClose.addEventListener("click", closeSuccessModal);
  successModal.addEventListener("click", (event) => {
    if (event.target === successModal) {
      closeSuccessModal();
    }
  });
  questionModalInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveQuestionFromModal();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !successModal.classList.contains("hidden")) {
      closeSuccessModal();
    }
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

}

async function main() {
  setupAudioUnlock();
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
