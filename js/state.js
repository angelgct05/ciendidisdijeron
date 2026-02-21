import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ROOM_CODE, SUPABASE_ANON_KEY, SUPABASE_URL } from "./config.js";

const STORAGE_KEY = "fm100_state_v1";
const CHANNEL_NAME = "fm100_channel";
const QUESTION_ACTIONS = new Set(["SET_QUESTIONS", "UPSERT_QUESTION", "DELETE_QUESTION"]);

let state = null;
let channel = null;
let supabase = null;
let realtimeChannel = null;
let questionsRealtimeChannel = null;
let supabaseEnabled = false;
const listeners = new Set();
const connectionListeners = new Set();
let connectionStatus = "connecting";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeQuestions(questions) {
  if (!Array.isArray(questions) || !questions.length) {
    return [];
  }

  return questions
    .map((item, index) => ({
      id: item.id || `q${index + 1}`,
      question: String(item.question || "Pregunta sin texto"),
      answers: Array.isArray(item.answers)
        ? item.answers
            .map((answer) => ({
              text: String(answer.text || "Respuesta"),
              points: Number.isFinite(Number(answer.points)) ? Number(answer.points) : 0,
            }))
            .filter((answer) => answer.text.trim().length > 0)
        : [],
    }))
    .filter((item) => item.answers.length > 0);
}

function normalizeTeamName(value, fallback) {
  const text = String(value || "").trim();
  return text.length ? text.slice(0, 24) : fallback;
}

function createInitialState(defaultQuestions = []) {
  const questions = normalizeQuestions(defaultQuestions);

  return {
    version: 1,
    teams: {
      A: { name: "Equipo A", score: 0 },
      B: { name: "Equipo B", score: 0 },
    },
    questions,
    round: {
      questionIndex: 0,
      status: "idle",
      buzzerWinner: null,
      revealed: [],
    },
    updatedAt: Date.now(),
  };
}

function validateState(nextState, fallbackQuestions = []) {
  if (!nextState || typeof nextState !== "object") {
    return createInitialState(fallbackQuestions);
  }

  const questions = normalizeQuestions(nextState.questions?.length ? nextState.questions : fallbackQuestions);
  const maxQuestionIndex = Math.max(0, questions.length - 1);

  return {
    version: 1,
    teams: {
      A: {
        name: normalizeTeamName(nextState.teams?.A?.name, "Equipo A"),
        score: Number(nextState.teams?.A?.score) || 0,
      },
      B: {
        name: normalizeTeamName(nextState.teams?.B?.name, "Equipo B"),
        score: Number(nextState.teams?.B?.score) || 0,
      },
    },
    questions,
    round: {
      questionIndex: Math.min(Math.max(Number(nextState.round?.questionIndex) || 0, 0), maxQuestionIndex),
      status: ["idle", "buzz-open", "locked", "round-end"].includes(nextState.round?.status)
        ? nextState.round.status
        : "idle",
      buzzerWinner: ["A", "B", null].includes(nextState.round?.buzzerWinner) ? nextState.round.buzzerWinner : null,
      revealed: Array.isArray(nextState.round?.revealed)
        ? nextState.round.revealed.filter((value) => Number.isInteger(value) && value >= 0)
        : [],
    },
    updatedAt: Number(nextState.updatedAt) || Date.now(),
  };
}

function persistAndNotify(shouldBroadcast = true) {
  state.updatedAt = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  if (shouldBroadcast && channel) {
    channel.postMessage({
      type: "state:update",
      payload: state,
    });
  }

  listeners.forEach((callback) => callback(getState()));
}

function notifyOnly() {
  listeners.forEach((callback) => callback(getState()));
}

function notifyConnectionStatus() {
  connectionListeners.forEach((callback) => callback(connectionStatus));
}

function setConnectionStatus(nextStatus) {
  if (connectionStatus === nextStatus) {
    return;
  }

  connectionStatus = nextStatus;
  notifyConnectionStatus();
}

function setupChannel() {
  if (channel || typeof BroadcastChannel === "undefined") {
    return;
  }

  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (event) => {
    if (!event?.data || event.data.type !== "state:update") {
      return;
    }

    const remoteState = validateState(event.data.payload, state?.questions || []);
    if (!state || remoteState.updatedAt >= state.updatedAt) {
      state = remoteState;
      persistAndNotify(false);
    }
  };
}

export function initializeState(defaultQuestions = []) {
  return initializeStateAsync(defaultQuestions);
}

export function getState() {
  return clone(state);
}

export function subscribe(callback) {
  listeners.add(callback);
  callback(getState());

  return () => {
    listeners.delete(callback);
  };
}

export function getConnectionStatus() {
  return connectionStatus;
}

export function isSupabaseConnected() {
  return supabaseEnabled && connectionStatus === "connected";
}

export function subscribeConnectionStatus(callback) {
  connectionListeners.add(callback);
  callback(getConnectionStatus());

  return () => {
    connectionListeners.delete(callback);
  };
}

function clampQuestionIndex(nextIndex) {
  const max = Math.max(0, state.questions.length - 1);
  return Math.min(Math.max(nextIndex, 0), max);
}

function resetRoundInternals() {
  state.round.status = "idle";
  state.round.buzzerWinner = null;
  state.round.revealed = [];
}

function applyActionLocal(action, payload = {}) {
  switch (action) {
    case "OPEN_BUZZ": {
      state.round.status = "buzz-open";
      state.round.buzzerWinner = null;
      break;
    }
    case "LOCK_BUZZ": {
      if (state.round.status === "buzz-open" && !state.round.buzzerWinner) {
        if (payload.team === "A" || payload.team === "B") {
          state.round.buzzerWinner = payload.team;
          state.round.status = "locked";
        }
      }
      break;
    }
    case "RESET_ROUND": {
      resetRoundInternals();
      break;
    }
    case "TOGGLE_REVEAL": {
      const answerIndex = Number(payload.answerIndex);
      if (!Number.isInteger(answerIndex) || answerIndex < 0) {
        break;
      }

      if (state.round.revealed.includes(answerIndex)) {
        state.round.revealed = state.round.revealed.filter((value) => value !== answerIndex);
      } else {
        state.round.revealed.push(answerIndex);
      }
      break;
    }
    case "ADD_SCORE": {
      const team = payload.team;
      const points = Number(payload.points) || 0;
      if (team !== "A" && team !== "B") {
        break;
      }

      state.teams[team].score = Math.max(0, state.teams[team].score + points);
      break;
    }
    case "SET_TEAM_NAME": {
      const team = payload.team;
      if (team !== "A" && team !== "B") {
        break;
      }

      const fallback = team === "A" ? "Equipo A" : "Equipo B";
      state.teams[team].name = normalizeTeamName(payload.name, fallback);
      break;
    }
    case "SET_QUESTION_INDEX": {
      const nextIndex = Number(payload.index);
      if (!Number.isInteger(nextIndex)) {
        break;
      }

      state.round.questionIndex = clampQuestionIndex(nextIndex);
      resetRoundInternals();
      break;
    }
    case "NEXT_QUESTION": {
      state.round.questionIndex = clampQuestionIndex(state.round.questionIndex + 1);
      resetRoundInternals();
      break;
    }
    case "PREV_QUESTION": {
      state.round.questionIndex = clampQuestionIndex(state.round.questionIndex - 1);
      resetRoundInternals();
      break;
    }
    case "SET_QUESTIONS": {
      const normalized = normalizeQuestions(payload.questions);
      if (!normalized.length) {
        break;
      }

      state.questions = normalized;
      state.round.questionIndex = clampQuestionIndex(state.round.questionIndex);
      resetRoundInternals();
      break;
    }
    case "UPSERT_QUESTION": {
      const index = Number(payload.index);
      const question = normalizeQuestions([payload.question])[0];
      if (!question) {
        break;
      }

      if (Number.isInteger(index) && index >= 0 && index < state.questions.length) {
        state.questions[index] = question;
      } else {
        state.questions.push(question);
      }

      state.round.questionIndex = clampQuestionIndex(state.round.questionIndex);
      break;
    }
    case "DELETE_QUESTION": {
      const index = Number(payload.index);
      if (!Number.isInteger(index) || index < 0 || index >= state.questions.length || state.questions.length === 1) {
        break;
      }

      state.questions.splice(index, 1);
      state.round.questionIndex = clampQuestionIndex(state.round.questionIndex);
      resetRoundInternals();
      break;
    }
    case "RESET_GAME": {
      state.teams.A.score = 0;
      state.teams.B.score = 0;
      state.round.questionIndex = 0;
      resetRoundInternals();
      break;
    }
    default:
      break;
  }
}

async function upsertRoomState(nextState) {
  if (!supabaseEnabled || !supabase) {
    return false;
  }

  const roomPayload = {
    ...nextState,
    questions: [],
  };

  const { error } = await supabase.from("game_rooms").upsert(
    {
      room_code: ROOM_CODE,
      state: roomPayload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "room_code" }
  );

  if (error) {
    return false;
  }

  return true;
}

async function loadRoomState() {
  if (!supabaseEnabled || !supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("game_rooms")
    .select("state")
    .eq("room_code", ROOM_CODE)
    .maybeSingle();

  if (error || !data?.state) {
    return null;
  }

  return data.state;
}

async function loadQuestionsFromSupabase() {
  if (!supabaseEnabled || !supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("game_questions")
    .select("position,question,answers")
    .eq("room_code", ROOM_CODE)
    .order("position", { ascending: true });

  if (error) {
    return null;
  }

  const questions = (data || []).map((row, index) => ({
    id: `q${index + 1}`,
    question: row.question,
    answers: Array.isArray(row.answers) ? row.answers : [],
  }));

  return normalizeQuestions(questions);
}

async function replaceQuestionsInSupabase(questions) {
  if (!supabaseEnabled || !supabase) {
    return false;
  }

  const { error: deleteError } = await supabase.from("game_questions").delete().eq("room_code", ROOM_CODE);
  if (deleteError) {
    return false;
  }

  if (!questions.length) {
    return true;
  }

  const rows = questions.map((item, index) => ({
    room_code: ROOM_CODE,
    position: index,
    question: item.question,
    answers: item.answers,
    updated_at: new Date().toISOString(),
  }));

  const { error: insertError } = await supabase.from("game_questions").insert(rows);
  if (insertError) {
    return false;
  }

  return true;
}

async function refreshQuestionsFromSupabase() {
  const questions = await loadQuestionsFromSupabase();
  if (!questions) {
    return false;
  }

  state.questions = questions;
  state.round.questionIndex = clampQuestionIndex(state.round.questionIndex);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  notifyOnly();
  return true;
}

async function setupSupabase(defaultQuestions = []) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !ROOM_CODE) {
    supabaseEnabled = false;
    setConnectionStatus("disconnected");
    return;
  }

  setConnectionStatus("connecting");
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  supabaseEnabled = true;

  let remoteState = await loadRoomState();
  if (!remoteState) {
    await upsertRoomState(validateState(state, defaultQuestions));
    remoteState = await loadRoomState();
  }

  if (remoteState) {
    state = validateState(remoteState, defaultQuestions);
    persistAndNotify(false);
    setConnectionStatus("connected");
  } else {
    setConnectionStatus("disconnected");
  }

  const questionsFromTable = await loadQuestionsFromSupabase();
  if (questionsFromTable && questionsFromTable.length) {
    state.questions = questionsFromTable;
  } else {
    const seeded = await replaceQuestionsInSupabase(state.questions);
    if (!seeded) {
      setConnectionStatus("disconnected");
    }
  }
  persistAndNotify(false);

  if (!realtimeChannel) {
    realtimeChannel = supabase
      .channel(`room-${ROOM_CODE}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_rooms",
          filter: `room_code=eq.${ROOM_CODE}`,
        },
        (payload) => {
          const nextState = validateState(payload?.new?.state, state?.questions || []);
          if (!state || nextState.updatedAt >= state.updatedAt) {
            state = nextState;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            notifyOnly();
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnectionStatus("connected");
          return;
        }

        if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnectionStatus("disconnected");
        }
      });
  }

  if (!questionsRealtimeChannel) {
    questionsRealtimeChannel = supabase
      .channel(`questions-${ROOM_CODE}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_questions",
          filter: `room_code=eq.${ROOM_CODE}`,
        },
        async () => {
          const refreshed = await refreshQuestionsFromSupabase();
          if (!refreshed) {
            setConnectionStatus("disconnected");
          }
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnectionStatus("disconnected");
        }
      });
  }
}

async function initializeStateAsync(defaultQuestions = []) {
  if (!state) {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    state = validateState(parsed, defaultQuestions);
    persistAndNotify(false);
  }

  setupChannel();

  try {
    await setupSupabase(defaultQuestions);
  } catch {
    supabaseEnabled = false;
    setConnectionStatus("disconnected");
  }

  return getState();
}

export function dispatch(action, payload = {}) {
  return dispatchAsync(action, payload);
}

async function dispatchAsync(action, payload = {}) {
  if (!state) {
    throw new Error("State no inicializado. Llama initializeState primero.");
  }

  if (QUESTION_ACTIONS.has(action) && !supabaseEnabled) {
    throw new Error("No hay conexión con Supabase. No se puede guardar preguntas en modo local.");
  }

  if (supabaseEnabled && action === "LOCK_BUZZ") {
    const team = payload.team;
    if (team !== "A" && team !== "B") {
      return getState();
    }

    const { data, error } = await supabase.rpc("try_lock_buzzer", {
      p_room: ROOM_CODE,
      p_team: team,
    });

    if (!error && Array.isArray(data) && data.length) {
      const result = data[0];
      if (result?.state) {
        state = validateState(result.state, state.questions || []);
        persistAndNotify(true);
      }
      return getState();
    }

    setConnectionStatus("disconnected");
  }

  const previousState = clone(state);

  applyActionLocal(action, payload);

  if (QUESTION_ACTIONS.has(action) && supabaseEnabled) {
    const questionsSynced = await replaceQuestionsInSupabase(state.questions);
    if (!questionsSynced) {
      setConnectionStatus("disconnected");
      state = previousState;
      persistAndNotify(true);
      throw new Error("No se pudo guardar preguntas/respuestas en Supabase.");
    }
  }

  if (supabaseEnabled) {
    const synced = await upsertRoomState(state);
    if (!synced) {
      setConnectionStatus("disconnected");
      if (QUESTION_ACTIONS.has(action)) {
        state = previousState;
        persistAndNotify(true);
        throw new Error("No se pudo guardar en Supabase. Verifica conexión y permisos.");
      }
      persistAndNotify(true);
      return getState();
    }

    setConnectionStatus("connected");
  }

  persistAndNotify(true);
  return getState();
}
