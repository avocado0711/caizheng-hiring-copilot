"use strict";

const params = new URLSearchParams(window.location.search);
const sessionId = params.get("session") || "";
const token = params.get("token") || "";
const localCall = {
  status: "loading",
  plan: null,
  dialog: [],
  turnIndex: 0,
  transcript: [],
  answers: [],
  startedAt: null,
  endedAt: null,
  timer: null,
  recognition: null,
  listening: false,
  consentConfirmed: false,
  currentPrompt: "",
};

const $ = (selector) => document.querySelector(selector);

async function phoneApi(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `请求失败（${response.status}）`);
  return data;
}

async function postPhoneEvent(type, data = {}) {
  try {
    await phoneApi(`/api/call-sessions/${encodeURIComponent(sessionId)}/events?token=${encodeURIComponent(token)}`, {
      method: "POST",
      body: JSON.stringify({ token, type, data }),
    });
  } catch (error) {
    console.warn("事件同步失败：", error.message);
  }
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function showError(message) {
  $("#phone-incoming").hidden = true;
  $("#phone-call").hidden = true;
  $("#phone-ended").hidden = true;
  $("#phone-error").hidden = false;
  $("#phone-error-copy").textContent = message;
}

function setCallStatus(text) {
  $("#phone-call-status").textContent = text;
  $("#phone-stage-label").textContent = text;
}

function setAnswerSupport(text, isWarning = false) {
  const element = $("#phone-answer-support");
  element.textContent = text;
  element.classList.toggle("is-warning", isWarning);
}

function updateBrowserCapabilities() {
  const recognitionSupported = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  const speechSupported = "speechSynthesis" in window
    && typeof window.SpeechSynthesisUtterance === "function";
  if (!window.isSecureContext) {
    $("#phone-mic").disabled = true;
    setAnswerSupport("当前页面不是 HTTPS，手机浏览器通常不允许麦克风。请让 HR 重新生成 HTTPS 二维码，或直接输入回答。", true);
  } else if (!recognitionSupported) {
    $("#phone-mic").disabled = true;
    setAnswerSupport("当前手机浏览器不支持网页语音识别。请直接输入回答，或改用最新版 Android Edge / Chrome。", true);
  } else {
    $("#phone-mic").disabled = false;
    setAnswerSupport("语音识别由浏览器提供；首次使用时需要允许麦克风权限。");
  }
  $("#phone-replay").disabled = !speechSupported;
  if (!speechSupported) setAnswerSupport("当前浏览器不支持自动语音朗读，请阅读文字问题并输入回答。", true);
}

function addTranscript(role, text) {
  const value = clean(text);
  if (!value) return;
  localCall.transcript.push({ role, text: value, at: new Date().toISOString() });
  const container = $("#phone-live-transcript");
  const line = document.createElement("p");
  line.textContent = `${role === "ai" ? "AI" : "你"}：${value}`;
  container.appendChild(line);
  container.scrollTop = container.scrollHeight;
}

function speak(text, options = {}) {
  const record = options.record !== false;
  localCall.currentPrompt = text;
  if (record) {
    addTranscript("ai", text);
    postPhoneEvent("ai.speaking", { text });
  }
  $("#phone-question").textContent = text;
  $("#phone-answer-box").hidden = true;
  $("#phone-wave").classList.add("is-active");
  if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance !== "function") {
    $("#phone-wave").classList.remove("is-active");
    $("#phone-answer-box").hidden = false;
    setCallStatus("当前浏览器无法自动朗读，请阅读问题");
    setAnswerSupport("请阅读上方问题，并使用文字输入回答。", true);
    return;
  }
  window.speechSynthesis.cancel();
  window.speechSynthesis.resume();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = 0.96;
  const voice = window.speechSynthesis.getVoices().find((item) => /^zh[-_]/i.test(item.lang));
  if (voice) utterance.voice = voice;
  setCallStatus("AI 正在说话");
  let finished = false;
  let fallbackTimer = null;
  const complete = () => {
    if (finished) return;
    finished = true;
    clearTimeout(fallbackTimer);
    $("#phone-wave").classList.remove("is-active");
    setCallStatus("等待你的回答");
    $("#phone-answer-box").hidden = false;
  };
  utterance.onend = () => {
    setAnswerSupport(window.isSecureContext && (window.SpeechRecognition || window.webkitSpeechRecognition)
      ? "可以点击“开始说话”回答，也可以直接输入文字。"
      : "请直接输入文字回答。");
    complete();
  };
  utterance.onerror = () => {
    setAnswerSupport("自动语音播放失败，请点击“播放问题”重试，或阅读文字问题。", true);
    complete();
  };
  fallbackTimer = setTimeout(complete, Math.min(25_000, Math.max(8_000, text.length * 160)));
  try {
    window.speechSynthesis.speak(utterance);
  } catch {
    setAnswerSupport("自动语音播放失败，请点击“播放问题”重试，或阅读文字问题。", true);
    complete();
  }
}

function startTimer() {
  clearInterval(localCall.timer);
  const tick = () => {
    if (!localCall.startedAt || localCall.endedAt) return;
    const elapsed = Math.floor((Date.now() - new Date(localCall.startedAt).getTime()) / 1000);
    $("#phone-call-timer").textContent = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;
  };
  tick();
  localCall.timer = setInterval(tick, 1000);
}

function buildDialog() {
  localCall.dialog = [
    {
      id: "consent",
      type: "consent",
      text: `你好，我是才证 AI 招聘助理。本次为“${localCall.plan.jobTitle}”岗位进行初筛。对话会转写为招聘记录，但不会保存录音。你是否同意继续？`,
    },
    {
      id: "availability",
      type: "availability",
      text: "好的，本次沟通预计需要三到五分钟，现在是否方便继续？",
    },
    ...localCall.plan.questions.map((question) => ({
      id: question.id,
      type: "question",
      text: question.question,
      criterionId: question.criterionId,
    })),
  ];
}

function askCurrent() {
  const current = localCall.dialog[localCall.turnIndex];
  if (!current) {
    finishCall("completed");
    return;
  }
  speak(current.text);
}

function stopRecognition() {
  if (localCall.recognition && localCall.listening) {
    try { localCall.recognition.stop(); } catch { /* noop */ }
  }
}

async function toggleMic() {
  if (localCall.listening) {
    stopRecognition();
    return;
  }
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    $("#phone-mic").disabled = true;
    setAnswerSupport("当前手机浏览器不支持网页语音识别，请直接输入文字回答。", true);
    $("#phone-answer-input").focus();
    return;
  }
  if (!window.isSecureContext) {
    $("#phone-mic").disabled = true;
    setAnswerSupport("麦克风需要 HTTPS 页面。请重新生成二维码，或直接输入回答。", true);
    $("#phone-answer-input").focus();
    return;
  }
  $("#phone-mic").disabled = true;
  $("#phone-mic").textContent = "请求麦克风…";
  setCallStatus("正在请求麦克风权限");
  try {
    if (navigator.mediaDevices?.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    }
  } catch {
    $("#phone-mic").disabled = false;
    $("#phone-mic").textContent = "开始说话";
    setCallStatus("麦克风权限未开启");
    setAnswerSupport("麦克风权限被拒绝。请在浏览器设置中允许麦克风，或直接输入文字回答。", true);
    $("#phone-answer-input").focus();
    return;
  }
  const recognition = new Recognition();
  recognition.lang = "zh-CN";
  recognition.continuous = true;
  recognition.interimResults = true;
  let finalText = "";
  recognition.onstart = () => {
    localCall.listening = true;
    $("#phone-mic").disabled = false;
    $("#phone-mic").textContent = "停止录音";
    setCallStatus("正在聆听回答");
    $("#phone-wave").classList.add("is-active");
  };
  recognition.onresult = (event) => {
    let interim = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const text = event.results[index][0]?.transcript || "";
      if (event.results[index].isFinal) finalText += text;
      else interim += text;
    }
    $("#phone-answer-input").value = `${$("#phone-answer-input").value}${finalText || interim}`.trim();
    finalText = "";
  };
  recognition.onerror = (event) => {
    $("#phone-mic").disabled = false;
    setCallStatus("语音识别不可用，请使用文字输入");
    setAnswerSupport(
      event.error === "not-allowed" || event.error === "service-not-allowed"
        ? "麦克风或浏览器的语音识别服务被禁用。移动 Edge 可能不支持该服务，请改用 Chrome，或点击输入框后使用手机键盘上的麦克风听写。"
        : event.error === "network"
          ? "语音识别服务网络不可达，常见于移动 Edge 或当前网络限制。请改用 Chrome；如果仍失败，点击输入框后使用手机键盘的麦克风输入。"
          : event.error === "language-not-supported"
            ? "当前浏览器不支持中文语音识别，请改用 Chrome，或使用手机键盘麦克风输入。"
        : event.error === "no-speech"
          ? "没有识别到语音，请点击“开始说话”重试或输入回答。"
          : `语音识别失败（${event.error || "未知错误"}），请直接输入回答。`,
      true,
    );
    $("#phone-answer-input").focus();
  };
  recognition.onend = () => {
    localCall.listening = false;
    localCall.recognition = null;
    $("#phone-mic").textContent = "开始说话";
    $("#phone-wave").classList.remove("is-active");
    if (localCall.status === "connected") setCallStatus("请确认并提交回答");
  };
  localCall.recognition = recognition;
  try {
    recognition.start();
  } catch {
    $("#phone-mic").disabled = false;
    $("#phone-mic").textContent = "开始说话";
    setCallStatus("请使用文字输入回答");
    setAnswerSupport("无法启动网页语音识别，请直接输入回答。", true);
  }
}

function submitAnswer() {
  const input = $("#phone-answer-input");
  const answer = clean(input.value);
  if (!answer) {
    input.focus();
    return;
  }
  stopRecognition();
  const current = localCall.dialog[localCall.turnIndex];
  if (!current) return;
  const decline = /不同意|不愿意|拒绝|不想/;
  const unavailable = /不方便|没时间|稍后|改天|正在忙/;
  if (current.type === "consent" && decline.test(answer)) {
    finishCall("declined");
    return;
  }
  if (current.type === "consent") localCall.consentConfirmed = true;
  if (current.type === "availability" && unavailable.test(answer)) {
    finishCall("reschedule");
    return;
  }
  addTranscript("candidate", answer);
  postPhoneEvent("candidate.transcript", {
    questionId: current.id,
    question: current.text,
    answer,
  });
  localCall.answers.push({
    questionId: current.id,
    question: current.text,
    answer,
  });
  input.value = "";
  $("#phone-answer-box").hidden = true;
  localCall.turnIndex += 1;
  if (localCall.turnIndex >= localCall.dialog.length) {
    finishCall("completed");
  } else {
    setTimeout(askCurrent, 320);
  }
}

async function finishCall(reason) {
  if (localCall.endedAt) return;
  localCall.endedAt = new Date().toISOString();
  clearInterval(localCall.timer);
  stopRecognition();
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  const durationSec = Math.max(
    0,
    Math.round((new Date(localCall.endedAt).getTime() - new Date(localCall.startedAt).getTime()) / 1000),
  );
  const questionIds = new Set((localCall.plan?.questions || []).map((question) => question.id));
  const jobAnswers = localCall.answers.filter((answer) => questionIds.has(answer.questionId));
  $("#phone-call").hidden = true;
  $("#phone-ended").hidden = false;
  $("#phone-ended-summary").textContent = localCall.consentConfirmed
    ? `已完成 ${jobAnswers.length} 个岗位问题，记录已同步到招聘控制台。`
    : "未取得继续沟通授权，本次通话已结束。";
  await postPhoneEvent("call.ended", {
    consent: localCall.consentConfirmed,
    completionReason: reason,
    startedAt: localCall.startedAt,
    endedAt: localCall.endedAt,
    durationSec,
    questions: localCall.plan?.questions || [],
    answers: jobAnswers,
    transcript: localCall.transcript,
  });
}

async function acceptCall() {
  $("#phone-incoming").hidden = true;
  $("#phone-call").hidden = false;
  localCall.status = "connected";
  localCall.startedAt = new Date().toISOString();
  localCall.consentConfirmed = false;
  localCall.answers = [];
  localCall.transcript = [];
  localCall.turnIndex = 0;
  buildDialog();
  startTimer();
  postPhoneEvent("call.accepted", { startedAt: localCall.startedAt });
  askCurrent();
}

async function rejectCall() {
  localCall.startedAt = new Date().toISOString();
  localCall.endedAt = localCall.startedAt;
  await postPhoneEvent("call.ended", {
    consent: false,
    completionReason: "declined",
    startedAt: localCall.startedAt,
    endedAt: localCall.endedAt,
    durationSec: 0,
    questions: localCall.plan?.questions || [],
    answers: [],
    transcript: [],
  });
  $("#phone-incoming").hidden = true;
  $("#phone-ended").hidden = false;
  $("#phone-ended-copy").textContent = "已拒绝本次 AI 招聘来电。";
  $("#phone-ended-summary").textContent = "未进入岗位问题环节。";
}

async function initPhoneCall() {
  if (!sessionId || !token) {
    showError("二维码链接缺少会话信息。");
    return;
  }
  try {
    const result = await phoneApi(`/api/call-sessions/${encodeURIComponent(sessionId)}/join?token=${encodeURIComponent(token)}`, {
      method: "POST",
      body: JSON.stringify({ token }),
    });
    localCall.plan = result.plan;
    $("#incoming-candidate").textContent = `${result.plan.candidate.name} · ${result.plan.jobTitle}`;
    $("#phone-job-title").textContent = result.plan.jobTitle;
    $("#phone-answer").addEventListener("click", acceptCall);
    $("#phone-reject").addEventListener("click", rejectCall);
    $("#phone-mic").addEventListener("click", toggleMic);
    $("#phone-replay").addEventListener("click", () => {
      if (localCall.currentPrompt) speak(localCall.currentPrompt, { record: false });
    });
    $("#phone-submit-answer").addEventListener("click", submitAnswer);
    $("#phone-hangup").addEventListener("click", () => finishCall("manual_end"));
    $("#phone-answer-input").addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        submitAnswer();
      }
    });
    updateBrowserCapabilities();
  } catch (error) {
    showError(error.message);
  }
}

initPhoneCall();
