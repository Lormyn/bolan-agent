/* ═══════════════════════════════════════════
   Gemini Live Voice Module — ADK WebSocket
   Bidirectional voice+text via /run_live
   ═══════════════════════════════════════════ */

const GeminiVoice = (() => {
  // ── State ──
  let ws = null;
  let isConnected = false;
  let isListening = false;
  let recordingCtx = null;     // 16kHz for mic capture
  let playbackCtx = null;      // 24kHz for playback
  let micStream = null;
  let micSource = null;
  let workletNode = null;
  let gainNode = null;
  let agentAnalyser = null;
  let audioQueue = [];
  let scheduledSources = [];
  let nextPlayTime = 0;
  let muted = false; // When true, handle incoming audio based on muteMode
  let muteMode = 'drop'; // 'drop' = discard audio, 'buffer' = save for replay on unmute
  let mutedAudioBuffer = []; // Buffered audio chunks during mute (buffer mode only)
  let gotTranscriptionThisTurn = false; // Dedup: skip content.parts text if outputTranscription received

  // ── Callbacks ──
  let onUserTranscript = null;    // (text) => {} — user speech transcript
  let onAgentText = null;         // (text) => {} — agent text response chunk (streaming)
  let onAgentAudioStart = null;   // () => {} — first audio chunk arrived
  let onAgentAudioEnd = null;     // () => {} — all audio done
  let onConnectionReady = null;   // () => {}
  let onConnectionError = null;   // (err) => {}
  let onConnectionClose = null;   // () => {}
  let onInterrupted = null;       // () => {} — agent was interrupted by user barge-in
  let onWidgetReceived = null;    // (payload) => {} — tool widget from backend
  let onTurnComplete = null;      // () => {} — agent turn finished

  // ── Utilities ──
  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  // ── Audio Playback (gapless scheduling at 24kHz) ──
  function ensurePlaybackCtx() {
    if (!playbackCtx) {
      playbackCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
      gainNode = playbackCtx.createGain();
      agentAnalyser = playbackCtx.createAnalyser();
      agentAnalyser.fftSize = 256;
      gainNode.connect(agentAnalyser);
      agentAnalyser.connect(playbackCtx.destination);
    }
    if (playbackCtx.state === 'suspended') playbackCtx.resume();
  }

  function scheduleBuffers() {
    if (!playbackCtx || !gainNode) return;

    // If playhead fell behind, fast-forward to now
    if (nextPlayTime < playbackCtx.currentTime) {
      nextPlayTime = playbackCtx.currentTime + 0.05;
    }

    while (audioQueue.length > 0) {
      const audioBuffer = audioQueue.shift();
      const source = playbackCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(gainNode);
      source.start(nextPlayTime);
      nextPlayTime += audioBuffer.duration;

      scheduledSources.push(source);
      source.onended = () => {
        scheduledSources = scheduledSources.filter(s => s !== source);
        // If nothing left scheduled and queue is empty, signal audio end
        if (scheduledSources.length === 0 && audioQueue.length === 0) {
          if (onAgentAudioEnd) onAgentAudioEnd();
        }
      };
    }
  }

  function clearAudioQueue() {
    audioQueue = [];
    nextPlayTime = 0;
    for (const source of scheduledSources) {
      try { source.stop(); source.disconnect(); } catch (e) {}
    }
    scheduledSources = [];
  }

  function handleAudioData(data, mimeType) {
    ensurePlaybackCtx();
    if (!playbackCtx) return;

    // Fix URL-safe base64
    let base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) base64 += '=';

    try {
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);

      // Ensure even length for Int16Array
      const safeBytes = bytes.length % 2 !== 0
        ? new Uint8Array(bytes.buffer, 0, bytes.length - 1)
        : bytes;

      const int16 = new Int16Array(safeBytes.buffer, 0, safeBytes.length / 2);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768.0;

      // Read sample rate from mimeType if present
      let sampleRate = 24000;
      const rateMatch = mimeType && mimeType.match(/rate=(\d+)/);
      if (rateMatch) sampleRate = parseInt(rateMatch[1], 10);

      // Handle muted state
      if (muted) {
        if (muteMode === 'buffer') {
          const audioBuffer = playbackCtx.createBuffer(1, float32.length, sampleRate);
          audioBuffer.getChannelData(0).set(float32);
          mutedAudioBuffer.push(audioBuffer);
        }
        // In 'drop' mode, audio is silently discarded
        return;
      }

      const audioBuffer = playbackCtx.createBuffer(1, float32.length, sampleRate);
      audioBuffer.getChannelData(0).set(float32);

      const wasEmpty = audioQueue.length === 0 && scheduledSources.length === 0;
      audioQueue.push(audioBuffer);
      if (wasEmpty && onAgentAudioStart) onAgentAudioStart();
      scheduleBuffers();
    } catch (err) {
      console.error('[GeminiVoice] Error processing audio chunk:', err);
    }
  }

  // ── WebSocket Connection (ADK /run_live) ──
  async function connect(sessionId = 'default') {
      if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
        console.log('[GeminiVoice] Already connected');
        return;
      }

      // Ensure session exists
      try {
        const checkRes = await fetch(`http://127.0.0.1:8000/apps/app/users/default/sessions/${sessionId}`, { method: 'GET' });
        console.log(`[GeminiVoice] Session check: ${checkRes.status}`);
        if (checkRes.status === 404) {
          console.log(`[GeminiVoice] Creating session ${sessionId}...`);
          const createRes = await fetch(`http://127.0.0.1:8000/apps/app/users/default/sessions/${sessionId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
          });
          console.log(`[GeminiVoice] Session create: ${createRes.status}`);
        }
      } catch (e) {
        console.warn('[GeminiVoice] Could not ensure session:', e.message || e);
      }

      const wsUrl = `ws://127.0.0.1:8000/run_live?app_name=app&user_id=default&session_id=${sessionId}&modalities=AUDIO`;
      console.log('[GeminiVoice] Connecting:', wsUrl);

      return new Promise((resolve, reject) => {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('[GeminiVoice] WebSocket open');
          isConnected = true;

          // Send activity_start to initialize the live session
          ws.send(JSON.stringify({ activity_start: {} }));

          if (onConnectionReady) onConnectionReady();
          resolve();
        };

        ws.onmessage = async (event) => {
          try {
            const data = JSON.parse(event.data);

            // Handle interruption
            if (data.interrupted) {
              console.log('[GeminiVoice] Interrupted');
              clearAudioQueue();
              if (onInterrupted) onInterrupted();
            }

            // Handle audio output (blob format from ADK)
            if (data.blob) {
              const mime = data.blob.mime_type || data.blob.mimeType || '';
              if (mime.includes('audio/pcm') || mime.includes('audio/l16')) {
                handleAudioData(data.blob.data, mime);
              }
            }

            // Handle audio in content.parts (alternative format)
            if (data.content?.parts) {
              for (const part of data.content.parts) {
                const inlineData = part.inlineData || part.inline_data;
                if (inlineData) {
                  const mime = inlineData.mimeType || inlineData.mime_type || '';
                  if (mime.includes('audio/pcm') || mime.includes('audio/l16')) {
                    handleAudioData(inlineData.data, mime);
                  }
                }
              }
            }

            // Handle input transcription (user speech → text)
            const inputTranscription = data.inputTranscription || data.input_transcription;
            if (inputTranscription?.text) {
              console.log('[GeminiVoice] User said:', inputTranscription.text);
              if (onUserTranscript) onUserTranscript(inputTranscription.text);
            }

            // ── WIDGETS FIRST — process before text so widget renders before speech ──

            // Handle widget events from tool callbacks (UiWidget payloads)
            if (data.actions?.render_ui_widgets) {
              for (const w of data.actions.render_ui_widgets) {
                if (w.payload && onWidgetReceived) {
                  console.log('[GeminiVoice] Widget received:', w.payload.widget_type || w.id);
                  onWidgetReceived(w.payload);
                }
              }
            }
            // Check state_delta for widget_* keys (fallback path)
            if (data.actions?.state_delta) {
              for (const [key, val] of Object.entries(data.actions.state_delta)) {
                if (key.startsWith('widget_') && val && typeof val === 'object' && val.widget_type && onWidgetReceived) {
                  console.log('[GeminiVoice] Widget via state_delta:', val.widget_type);
                  onWidgetReceived(val);
                }
              }
              // Also check pending_widgets array in state_delta
              const pw = data.actions.state_delta.pending_widgets;
              if (Array.isArray(pw)) {
                for (const w of pw) {
                  if (w?.widget_type && onWidgetReceived) {
                    console.log('[GeminiVoice] Widget via state_delta.pending_widgets:', w.widget_type);
                    onWidgetReceived(w);
                  }
                }
              }
            }
            // Check functionResponse parts for widget payloads (content.parts format)
            if (data.content?.parts) {
              for (const part of data.content.parts) {
                const fr = part.functionResponse || part.function_response;
                if (fr?.response) {
                  try {
                    const resp = typeof fr.response === 'string' ? JSON.parse(fr.response) : fr.response;
                    const payload = resp.result ? (typeof resp.result === 'string' ? JSON.parse(resp.result) : resp.result) : resp;
                    if (payload?.widget_type && onWidgetReceived) {
                      console.log('[GeminiVoice] Widget via functionResponse:', payload.widget_type);
                      onWidgetReceived(payload);
                    }
                  } catch (e) { /* not JSON, skip */ }
                }
              }
            }
            // Check tool_response.functionResponses (ADK Live API format)
            if (data.tool_response?.functionResponses) {
              for (const fr of data.tool_response.functionResponses) {
                if (fr?.response) {
                  try {
                    const resp = typeof fr.response === 'string' ? JSON.parse(fr.response) : fr.response;
                    const payload = resp.result ? (typeof resp.result === 'string' ? JSON.parse(resp.result) : resp.result) : resp;
                    if (payload?.widget_type && onWidgetReceived) {
                      console.log('[GeminiVoice] Widget via tool_response:', payload.widget_type);
                      onWidgetReceived(payload);
                    }
                  } catch (e) { /* not JSON, skip */ }
                }
              }
            }

            // ── THEN TEXT — agent speech renders after widgets ──

            // Handle output transcription (agent speech → text, streaming)
            const outputTranscription = data.outputTranscription || data.output_transcription;
            if (outputTranscription?.text) {
              gotTranscriptionThisTurn = true;
              console.log('[GeminiVoice] Agent text:', outputTranscription.text.substring(0, 60));
              if (onAgentText) onAgentText(outputTranscription.text, !!outputTranscription.finished);
            }

            // Handle text in content.parts (only if we didn't get outputTranscription)
            // In audio mode, outputTranscription is the live transcript — content.parts/data.text are duplicates
            if (!gotTranscriptionThisTurn) {
              if (data.text) {
                if (onAgentText) onAgentText(data.text, true);
              } else if (data.content?.parts) {
                const textParts = data.content.parts.filter(p => p.text).map(p => p.text);
                if (textParts.length > 0) {
                  if (onAgentText) onAgentText(textParts.join(''), false);
                }
              }
            }

            // Handle turn complete
            if (data.turn_complete || data.turnComplete) {
              console.log('[GeminiVoice] Turn complete');
              gotTranscriptionThisTurn = false; // Reset for next turn
              if (onTurnComplete) onTurnComplete();
            }

          } catch (e) {
            console.error('[GeminiVoice] Error parsing message:', e);
          }
        };

        ws.onerror = (err) => {
          console.error('[GeminiVoice] WebSocket error — likely CORS or backend not running on :8000');
          console.error('[GeminiVoice] Tip: Restart with ./start.sh (adds --allow_origins)');
          if (onConnectionError) onConnectionError(err);
          reject(err);
        };

        ws.onclose = (e) => {
          console.log(`[GeminiVoice] WebSocket closed — code: ${e.code}, reason: ${e.reason || '(none)'}`);
          if (e.code === 1008) console.error('[GeminiVoice] 1008 = Origin not allowed. Backend needs --allow_origins "http://localhost:8080"');
          if (e.code === 1002) console.error('[GeminiVoice] 1002 = Session not found. Try a different session ID.');
          isConnected = false;
          isListening = false;
          if (onConnectionClose) onConnectionClose();
        };
      });
  }

  // ── Mic Capture (16kHz PCM via AudioWorklet) ──
  async function startListening() {
    if (isListening) return;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn('[GeminiVoice] Cannot start listening — not connected');
      return;
    }

    // Barge-in: stop playback when user starts talking
    clearAudioQueue();

    try {
      recordingCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      if (recordingCtx.state === 'suspended') await recordingCtx.resume();

      await recordingCtx.audioWorklet.addModule('pcm-recorder-processor.js');

      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true }
      });

      micSource = recordingCtx.createMediaStreamSource(micStream);
      workletNode = new AudioWorkletNode(recordingCtx, 'pcm-recorder-processor');

      workletNode.port.onmessage = (e) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        const base64 = arrayBufferToBase64(e.data);
        ws.send(JSON.stringify({
          blob: {
            mime_type: 'audio/pcm;rate=16000',
            data: base64
          }
        }));
      };

      micSource.connect(workletNode);

      // Connect worklet to destination via muted gain to keep processing alive
      const muteNode = recordingCtx.createGain();
      muteNode.gain.value = 0;
      workletNode.connect(muteNode);
      muteNode.connect(recordingCtx.destination);

      isListening = true;
      console.log('[GeminiVoice] Mic started (16kHz)');
    } catch (err) {
      console.error('[GeminiVoice] Mic access failed:', err);
      throw err;
    }
  }

  function stopListening() {
    isListening = false;
    if (workletNode) { workletNode.disconnect(); workletNode = null; }
    if (micSource) { micSource.disconnect(); micSource = null; }
    if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null; }
    if (recordingCtx) { recordingCtx.close().catch(() => {}); recordingCtx = null; }
    console.log('[GeminiVoice] Mic stopped');
  }

  // ── Send text (for typed input while connected) ──
  function sendText(text) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ensurePlaybackCtx();
    clearAudioQueue();
    ws.send(JSON.stringify({
      content: {
        role: 'user',
        parts: [{ text }]
      }
    }));
  }

  // ── Disconnect ──
  function disconnect() {
    stopListening();
    clearAudioQueue();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ activity_end: {} }));
      ws.close();
    }
    ws = null;
    isConnected = false;
    if (agentAnalyser) { agentAnalyser = null; }
    if (playbackCtx && playbackCtx.state !== 'closed') {
      playbackCtx.close().catch(() => {});
    }
    playbackCtx = null;
    gainNode = null;
  }

  // ── Public API ──
  return {
    connect,
    startListening,
    stopListening,
    sendText,
    clearAudioQueue,
    disconnect,
    get isConnected() { return isConnected; },
    get isListening() { return isListening; },
    get isPlaying() { return scheduledSources.length > 0 || audioQueue.length > 0; },
    set muted(v) {
      const wasMuted = muted;
      muted = !!v;
      if (muted) {
        clearAudioQueue();
        mutedAudioBuffer = [];
      } else if (wasMuted && mutedAudioBuffer.length > 0) {
        // Unmuting — replay buffered audio
        console.log('[GeminiVoice] Unmuting: replaying', mutedAudioBuffer.length, 'buffered audio chunks');
        const buffered = mutedAudioBuffer.splice(0);
        for (const buf of buffered) {
          audioQueue.push(buf);
        }
        if (audioQueue.length > 0) {
          if (onAgentAudioStart) onAgentAudioStart();
          scheduleBuffers();
        }
      }
    },
    get muted() { return muted; },
    set muteMode(v) { muteMode = v === 'buffer' ? 'buffer' : 'drop'; },
    get muteMode() { return muteMode; },

    // Callback setters
    set onUserTranscript(fn) { onUserTranscript = fn; },
    set onAgentText(fn) { onAgentText = fn; },
    set onAgentAudioStart(fn) { onAgentAudioStart = fn; },
    set onAgentAudioEnd(fn) { onAgentAudioEnd = fn; },
    set onConnectionReady(fn) { onConnectionReady = fn; },
    set onConnectionError(fn) { onConnectionError = fn; },
    set onConnectionClose(fn) { onConnectionClose = fn; },
    set onInterrupted(fn) { onInterrupted = fn; },
    set onWidgetReceived(fn) { onWidgetReceived = fn; },
    set onTurnComplete(fn) { onTurnComplete = fn; },
  };
})();
