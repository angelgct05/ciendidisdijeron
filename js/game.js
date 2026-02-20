import { initializeState, subscribe } from "./state.js";

const scoreAEl = document.getElementById("score-a");
const scoreBEl = document.getElementById("score-b");
const questionTextEl = document.getElementById("question-text");
const answersListEl = document.getElementById("answers-list");
const roundLabelEl = document.getElementById("round-label");
const buzzerStatusEl = document.getElementById("buzzer-status");

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
    buzzerStatusEl.textContent = `Ganó el buzzer: Equipo ${state.round.buzzerWinner}`;
    buzzerStatusEl.classList.add("warn");
    return;
  }

  buzzerStatusEl.textContent = "Esperando al administrador para abrir buzzer";
}

function render(state) {
  const question = state.questions[state.round.questionIndex];

  scoreAEl.textContent = state.teams.A.score;
  scoreBEl.textContent = state.teams.B.score;

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

async function main() {
  try {
    const defaultQuestions = await loadDefaultQuestions();
    await initializeState(defaultQuestions);
    subscribe(render);
  } catch (error) {
    questionTextEl.textContent = "Error cargando la configuración del juego";
    buzzerStatusEl.textContent = error.message;
  }
}

main();
