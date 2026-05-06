// ============================================================
// Vaani — Real-Time AI Speech Translation
// Main Application Script
// ============================================================

const API_BASE = window.location.origin;
let wsClient = null;
let currentMode = "text-text";
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let realtimeEnabled = false;
let realtimeTimer = null;
let lastTranslatedText = "";
let lastAudioBlob = null;
let history = JSON.parse(localStorage.getItem("vaani_history") || "[]");

// ── Init ──────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  populateLanguageSelects();
  updateBadges();
  renderHistory();
  initWebSocket();
  setMode("text-text");
});

// ── WebSocket ─────────────────────────────
function initWebSocket() {
  const wsUrl = API_BASE.replace("http", "ws") + "/ws/translate";
  setStatus("connecting");
  try {
    wsClient = new WebSocket(wsUrl);
    wsClient.onopen = () => {
      setStatus("connected");
      pingWs();
    };
    wsClient.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "translation") {
        showTranslation(data.translated, data.original, data.source_lang, data.target_lang);
      } else if (data.type === "error") {
        showToast("WS: " + data.message, "error");
      }
    };
    wsClient.onclose = () => {
      setStatus("error");
      setTimeout(initWebSocket, 5000);
    };
    wsClient.onerror = () => setStatus("error");
  } catch (e) {
    setStatus("error");
  }
}

function pingWs() {
  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
    wsClient.send(JSON.stringify({ mode: "ping" }));
    setTimeout(pingWs, 30000);
  }
}

function setStatus(state) {
  const dot = document.getElementById("status-dot");
  const lbl = document.getElementById("status-label");
  dot.className = "status-dot";
  if (state === "connected") {
    dot.classList.add("connected");
    lbl.textContent = "Connected";
  } else if (state === "error") {
    dot.classList.add("error");
    lbl.textContent = "Offline";
  } else {
    lbl.textContent = "Connecting…";
  }
}

// ── Mode Management ───────────────────────
function setMode(mode) {
  currentMode = mode;
  document.querySelectorAll(".mode-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.mode === mode);
  });

  const isSpeechInput  = mode === "speech-text" || mode === "speech-speech";
  const isSpeechOutput = mode === "text-speech"  || mode === "speech-speech";

  document.getElementById("text-input-section").classList.toggle("hidden", isSpeechInput);
  document.getElementById("speech-input-section").classList.toggle("hidden", !isSpeechInput);
  document.getElementById("tts-btn").classList.toggle("hidden", !isSpeechOutput);
  document.getElementById("dl-btn").classList.toggle("hidden", !isSpeechOutput);
  document.getElementById("realtime-toggle-wrap").classList.toggle("hidden", isSpeechInput);

  clearOutput();
}

// ── Language Handling ─────────────────────
function onLangChange() { updateBadges(); }

function updateBadges() {
  const sl = document.getElementById("source-lang").value;
  const tl = document.getElementById("target-lang").value;
  document.getElementById("source-badge").textContent = LANGUAGES[sl]?.native || sl;
  document.getElementById("target-badge").textContent = LANGUAGES[tl]?.native || tl;
}

function swapLanguages() {
  const sl = document.getElementById("source-lang");
  const tl = document.getElementById("target-lang");
  [sl.value, tl.value] = [tl.value, sl.value];
  updateBadges();
  const srcText = document.getElementById("source-text").value;
  const outText = document.getElementById("output-text").textContent;
  if (outText && outText !== lastTranslatedText) return;
  if (srcText && outText) {
    document.getElementById("source-text").value = outText;
    onTextInput();
    doTranslate();
  }
}

// ── Text Input ────────────────────────────
function onTextInput() {
  const text = document.getElementById("source-text").value;
  const count = document.getElementById("char-count");
  count.textContent = `${text.length} / 5000`;
  if (text.length > 5000) {
    document.getElementById("source-text").value = text.slice(0, 5000);
  }
  if (realtimeEnabled && text.trim()) {
    clearTimeout(realtimeTimer);
    realtimeTimer = setTimeout(() => doTranslate(), 700);
  }
}

function clearSource() {
  document.getElementById("source-text").value = "";
  document.getElementById("char-count").textContent = "0 / 5000";
  clearOutput();
}

function clearOutput() {
  document.getElementById("output-placeholder").classList.remove("hidden");
  document.getElementById("output-text").classList.add("hidden");
  document.getElementById("output-text").textContent = "";
  document.getElementById("loading-dots").classList.add("hidden");
  document.getElementById("tts-btn").classList.add("hidden");
  document.getElementById("dl-btn").classList.add("hidden");
  document.getElementById("audio-player").classList.add("hidden");
  lastTranslatedText = "";
  lastAudioBlob = null;
}

// ── Main Translate ────────────────────────
async function doTranslate() {
  const sl = document.getElementById("source-lang").value;
  const tl = document.getElementById("target-lang").value;

  if (currentMode === "text-text" || currentMode === "text-speech") {
    const text = document.getElementById("source-text").value.trim();
    if (!text) return showToast("Please enter text to translate");
    await translateText(text, sl, tl);
    if (currentMode === "text-speech") await speakTranslation();

  } else if (currentMode === "speech-text") {
    if (!isRecording) startRecording("text");

  } else if (currentMode === "speech-speech") {
    if (!isRecording) startRecording("speech");
  }
}

async function translateText(text, sl, tl) {
  showLoading(true);
  try {
    // Try WebSocket first for speed
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
      wsClient.send(JSON.stringify({ mode: "text", text, source_lang: sl, target_lang: tl }));
      return; // result handled by wsClient.onmessage
    }
    // Fallback to REST
    const res = await fetch(`${API_BASE}/translate/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, source_lang: sl, target_lang: tl })
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    showTranslation(data.translated_text, text, sl, tl);
  } catch (e) {
    showLoading(false);
    showToast("Translation failed: " + e.message, "error");
  }
}

function showTranslation(translated, original, sl, tl) {
  showLoading(false);
  lastTranslatedText = translated;

  const out = document.getElementById("output-text");
  document.getElementById("output-placeholder").classList.add("hidden");
  out.classList.remove("hidden");
  out.textContent = translated;
  out.classList.toggle("rtl", LANGUAGES[tl]?.rtl || false);

  // Show TTS/DL if relevant
  const isSpeechOutput = currentMode === "text-speech" || currentMode === "speech-speech";
  if (isSpeechOutput) {
    document.getElementById("tts-btn").classList.remove("hidden");
    document.getElementById("dl-btn").classList.remove("hidden");
  }

  addToHistory(original, translated, sl, tl);
  animateOutput(out);
}

function animateOutput(el) {
  el.style.opacity = "0";
  el.style.transform = "translateY(8px)";
  requestAnimationFrame(() => {
    el.style.transition = "opacity 0.3s ease, transform 0.3s ease";
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";
  });
}

function showLoading(on) {
  const dots = document.getElementById("loading-dots");
  const ph = document.getElementById("output-placeholder");
  dots.classList.toggle("hidden", !on);
  if (on) ph.classList.add("hidden");
}

// ── TTS ───────────────────────────────────
async function speakTranslation() {
  if (!lastTranslatedText) return;
  const tl = document.getElementById("target-lang").value;
  const btn = document.getElementById("tts-btn");
  btn.disabled = true;
  btn.textContent = "Generating…";
  try {
    const res = await fetch(`${API_BASE}/translate/text-to-speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: lastTranslatedText, language: tl })
    });
    if (!res.ok) throw new Error("TTS failed");
    const blob = await res.blob();
    lastAudioBlob = blob;
    const url = URL.createObjectURL(blob);
    const audio = document.getElementById("audio-elem");
    audio.src = url;
    document.getElementById("audio-player").classList.remove("hidden");
    audio.play();
    btn.classList.remove("hidden");
    document.getElementById("dl-btn").classList.remove("hidden");
  } catch (e) {
    showToast("TTS error: " + e.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg> Speak`;
  }
}

function downloadAudio() {
  if (!lastAudioBlob) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(lastAudioBlob);
  a.download = "vaani_translation.mp3";
  a.click();
}

// ── Recording ─────────────────────────────
async function toggleRecording() {
  if (isRecording) stopRecording();
  else await startRecording(currentMode === "speech-speech" ? "speech" : "text");
}

async function startRecording(outputType) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = () => processRecording(outputType, stream);
    mediaRecorder.start();
    isRecording = true;

    const btn = document.getElementById("mic-btn");
    btn.classList.add("recording");
    document.getElementById("mic-label").textContent = "Recording… tap to stop";
    document.getElementById("waveform").classList.add("active");
    document.getElementById("transcript-box").innerHTML = `<p class="transcript-placeholder">Listening…</p>`;
  } catch (e) {
    showToast("Microphone access denied", "error");
  }
}

function stopRecording() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    isRecording = false;
    const btn = document.getElementById("mic-btn");
    btn.classList.remove("recording");
    document.getElementById("mic-label").textContent = "Processing…";
    document.getElementById("waveform").classList.remove("active");
  }
}

async function processRecording(outputType, stream) {
  stream.getTracks().forEach(t => t.stop());
  document.getElementById("mic-label").textContent = "Tap to speak";

  const blob = new Blob(audioChunks, { type: "audio/webm" });
  const sl = document.getElementById("source-lang").value;
  const tl = document.getElementById("target-lang").value;

  if (outputType === "text") {
    await sttOnly(blob, sl, tl);
  } else {
    await speechToSpeech(blob, sl, tl);
  }
}

async function sttOnly(blob, sl, tl) {
  showLoading(true);
  try {
    const form = new FormData();
    form.append("audio", blob, "recording.webm");
    form.append("source_lang", sl);

    const sttRes = await fetch(`${API_BASE}/translate/speech-to-text`, { method: "POST", body: form });
    const sttData = await sttRes.json();
    const transcript = sttData.transcript;

    document.getElementById("transcript-box").innerHTML = `<p style="font-size:14px;color:var(--text)">${transcript}</p>`;

    if (currentMode === "speech-text") {
      const tRes = await fetch(`${API_BASE}/translate/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: transcript, source_lang: sl, target_lang: tl })
      });
      const tData = await tRes.json();
      showTranslation(tData.translated_text, transcript, sl, tl);
    }
  } catch (e) {
    showLoading(false);
    showToast("STT error: " + e.message, "error");
  }
}

async function speechToSpeech(blob, sl, tl) {
  showLoading(true);
  try {
    const form = new FormData();
    form.append("audio", blob, "recording.webm");
    form.append("source_lang", sl);
    form.append("target_lang", tl);

    const res = await fetch(`${API_BASE}/translate/speech-to-speech`, { method: "POST", body: form });
    const data = await res.json();

    document.getElementById("transcript-box").innerHTML =
      `<p style="font-size:14px;color:var(--text)">${data.transcript}</p>`;
    showTranslation(data.translated_text, data.transcript, sl, tl);

    if (data.audio_available) {
      await speakTranslation();
    }
  } catch (e) {
    showLoading(false);
    showToast("Speech-to-Speech error: " + e.message, "error");
  }
}

// ── Realtime Toggle ───────────────────────
function toggleRealtime() {
  realtimeEnabled = document.getElementById("realtime-toggle").checked;
  showToast(realtimeEnabled ? "Live mode ON" : "Live mode OFF");
}

// ── Copy ──────────────────────────────────
async function copyText(which) {
  let text = "";
  if (which === "source") text = document.getElementById("source-text").value;
  else text = document.getElementById("output-text").textContent;
  if (!text) return;
  await navigator.clipboard.writeText(text);
  showToast("Copied to clipboard");
}

// ── History ───────────────────────────────
function addToHistory(original, translated, sl, tl) {
  history.unshift({ original, translated, sl, tl, time: new Date().toLocaleTimeString() });
  if (history.length > 20) history.pop();
  localStorage.setItem("vaani_history", JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById("history-list");
  const section = document.getElementById("history-section");
  if (!history.length) { section.style.display = "none"; return; }
  section.style.display = "";
  list.innerHTML = history.slice(0, 8).map((item, i) => `
    <div class="history-item" onclick="restoreHistory(${i})">
      <div class="history-original">${escHtml(item.original)}</div>
      <div class="history-arrow">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14m-7-7 7 7-7 7"/></svg>
      </div>
      <div class="history-translated">${escHtml(item.translated)}</div>
      <div class="history-meta">
        <span>${LANGUAGES[item.sl]?.native || item.sl} → ${LANGUAGES[item.tl]?.native || item.tl}</span>
        <span>${item.time}</span>
      </div>
    </div>
  `).join("");
}

function restoreHistory(i) {
  const item = history[i];
  document.getElementById("source-lang").value = item.sl;
  document.getElementById("target-lang").value = item.tl;
  updateBadges();
  document.getElementById("source-text").value = item.original;
  setMode("text-text");
  showTranslation(item.translated, item.original, item.sl, item.tl);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function clearHistory() {
  history = [];
  localStorage.removeItem("vaani_history");
  renderHistory();
}

// ── Utils ─────────────────────────────────
function escHtml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

let toastTimer;
function showToast(msg, type = "info") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.style.borderColor = type === "error" ? "#ef4444" : "rgba(255,255,255,0.13)";
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2500);
}
