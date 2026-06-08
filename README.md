# Bolån Agent – Swedish Mortgage Voice Assistant

An AI-driven mortgage advisor ("Banksy") for Swedish Bank (Svenska Banken). Real-time voice-driven mortgage journey using the **Gemini Live API** streamed through the **Google Agent Development Kit (ADK 2.0)**, with rich A2UI widget rendering in the browser.

**Version**: `0.3.0`

---

## Prerequisites

- Python 3.11+
- A [Gemini API key](https://aistudio.google.com/apikey) (free tier works)

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url> && cd bolan-agent
python3 -m venv .venv && source .venv/bin/activate
pip install -e .

# 2. Configure API keys
cp .env.example .env                          # Backend key
cp frontend/config.example.js frontend/config.js  # Frontend key
# Edit both files and replace YOUR_GEMINI_API_KEY_HERE with your actual key

# 3. Start both servers
chmod +x start.sh
./start.sh

# 4. Open browser
open http://localhost:8080
```

The `start.sh` script starts the ADK API server on port 8000 and the frontend on port 8080. Press `Ctrl+C` to stop both (graceful SIGTERM → SIGKILL fallback).

> **Note**: Both `.env` and `frontend/config.js` are gitignored and will never be committed.

---

## Architecture

Single root agent (`bolan_agent`) with tools — no multi-agent orchestration. The Gemini Live API handles conversational flow via voice.

```
Browser (WebSocket) ←→ ADK Live Runner (:8000) ←→ Gemini 3.1 Flash Live Preview
                                                        ↓
                                                   bolan_agent
                                                   ├── visa_bankid_verifiering
                                                   ├── verifiera_identitet
                                                   ├── hamta_kreditupplysning
                                                   ├── visa_kontooversikt
                                                   ├── vardera_fastighet
                                                   ├── visa_rantejamforelse
                                                   ├── visa_laneerbjudande
                                                   └── visa_tillagg
```

### Voice Configuration

Voice is set on the `AIStudioGemini` model instance (not on Agent's `generate_content_config`):

```python
live_model = AIStudioGemini(
    model="gemini-3.1-flash-live-preview",
    live_streaming=True,
    speech_config=types.SpeechConfig(
        voice_config=types.VoiceConfig(
            prebuilt_voice_config=types.PrebuiltVoiceConfig(
                voice_name="Zephyr",
            )
        )
    ),
)
```

### A2UI Widget Pipeline

Tools return structured dicts with a `widget_type` field. The widget payload flows through two paths:

1. **`after_tool_callback`** — stores widget in `pending_widgets` session state
2. **`after_agent_callback`** — flushes via `render_ui_widgets` + `state_delta`

The frontend (`voice.js`) extracts widgets from `functionResponse`, `state_delta`, `render_ui_widgets`, and `tool_response` messages, then `demo.js` dispatches to the appropriate renderer.

---

## Project Structure

```
bolan-agent/
├── app/                        # Python backend
│   ├── __init__.py             # ADK app entry point
│   ├── agent.py                # Root agent, system instruction, model config, monkey patches
│   ├── tools.py                # 9 tool functions with widget payloads
│   └── mock_data.py            # Swedish mock data (customers, properties, rate matrices)
├── frontend/                   # Browser client
│   ├── index.html              # Swedish Bank landing page + embedded chat drawer
│   ├── styles.css              # Full design system (1,978 lines)
│   ├── demo.js                 # Chat logic, widget renderers, AVM pipeline, i18n
│   ├── voice.js                # WebSocket client, audio capture/playback (AudioWorklet)
│   ├── config.js               # API key (gitignored)
│   └── server.py               # Static HTTP server (port 8080)
├── docs/                       # Documentation
│   ├── architecture.md         # System architecture + widget pipeline
│   └── a2ui-implementation.md  # Widget payloads + ADK Live API quirks
├── start.sh                    # Starts both servers, handles graceful shutdown
├── pyproject.toml              # Python project config (v0.3.0)
└── .gitignore                  # Excludes .env, config.js, logs/, .venv/
```

---

## Demo Walkthrough

Follow this conversation to experience the full mortgage journey. You can speak or type — Banksy responds with voice and renders interactive widgets in real-time.

### 1. Open the chat

Click the **small chat icon** in the bottom-right corner of the page. Don't use the hero chat bar on the landing page — use the floating bubble icon to open the chat drawer.

### 2. Identify with BankID

Banksy will greet you and ask you to verify your identity. Click the **"Open BankID"** button in the chat widget, then click **"I've signed"** to complete verification.

### 3. Ask about your investments

> *"I bought some stocks a month ago and want to see the progress"*

Banksy will pull up your **financial overview widget** — showing account balances, an interactive investment chart, and fund holdings. You can switch between 1M / 3M / YTD / 1Y / ALL periods on the chart.

### 4. Express uncertainty about your mortgage

> *"I'm not sure about the current loan"*

Banksy will notice your existing mortgage and proactively suggest exploring better rates.

### 5. Confirm interest

> *"Yes, let's explore"*

This triggers the property valuation flow.

### 6. Provide your postcode

> *"Postcode is 11231"*

Banksy runs a **5-phase AVM (Automated Valuation Model)** animation — connecting to Lantmäteriet, analyzing comparable sales, and calculating the estimated market value. The result appears as a valuation card with a ±5% confidence range.

### 7. Confirm the valuation

> *"Yeah, that looks OK"*

### 8. State your outstanding loan

> *"2.8M SEK outstanding"*

### 9. Choose your binding period

> *"3 months variable, I want to keep it"*

Banksy shows a **rate comparison widget** with interactive cards for different binding periods (3mo, 1yr, 3yr, 5yr).

### 10. React to the offer

> *"I want to go with the 3.89% but might not want to commit yet"*

Banksy presents a **personalized loan offer card** (green card with rate, monthly cost, LTV, and annual savings vs. your current bank).

### 11. Explore add-ons

> *"Sure, show me the add-ons"*

Banksy shows **insurance and savings options** — home insurance, mortgage protection, and auto-save.

### 12. Ask a follow-up

> *"Yeah one final question, how have my stocks progressed year to date?"*

Banksy references your financial overview and discusses YTD performance.

### 13. Wrap up

> *"Thanks, all for now"*

Banksy closes the conversation.


---

## Rate Engine

The offered rate is calculated dynamically by `calculate_offered_rate()` in `mock_data.py`:

- **Base rate** by binding period (3mo: 3.89%, 1yr: 3.65%, 2yr: 3.45%, 3yr: 3.29%, 5yr: 3.15%)
- **UC risk adjustment** (Very Low: −0.15%, Low: 0%, Medium: +0.25%, High: +0.55%)
- **LTV adjustment** (≤50%: −0.10%, ≤70%: 0%, ≤85%: +0.25%, ≤90%: +0.35%)
- **Employment adjustment** (Permanent: −0.05%, Self-employed: +0.15%, Student: +0.40%)
- **Floor**: 2.50%

Amortization follows Swedish Finansinspektionen rules: 2% for LTV >70%, 1% for LTV 50–70%, 0% below 50%.

---

## AVM Pipeline (5-Phase)

The property valuation widget has a specialized rendering pipeline:

1. **Early detection** — text containing "valuation"/"värdering" triggers text suppression (audio plays through)
2. **Static announcement** — frontend renders "I will now run an automated valuation..."
3. **Loading animation** — 5-step progress animation (~7s) with Lantmäteriet/Booli branding
4. **Result card** — estimated market value rendered as ±5% confidence range
5. **Release** — suppression cleared, 15s cooldown prevents re-trigger, model prompted for commentary

---

## Audio Synchronization

Gemini Live API audio chunks arrive **200–800ms after** corresponding text tokens:

- **Pre-AVM**: early detection suppresses text but NOT audio (model's acknowledgment is heard)
- **During AVM**: model turn is complete, no unwanted audio follows
- **Financial overview**: audio is buffered during widget render, then replayed after
- **Welcome flow**: audio is dropped (not buffered) during static BankID flow

---

## Monkey Patches

Two monkey patches on `GeminiLlmConnection` (version-guarded for ADK 2.0.x):

1. **`receive`** — handles Gemini 3.1 Live Preview's tool call behavior where `turn_complete` is not sent for tool calls, requiring early break from the receive loop
2. **`send_history`** — converts multi-turn history into a single-turn text transcript, since the Live API doesn't support multi-turn `send_client_content`

---

## Debug Mode

Append `?debug` to the URL to enable:
- Version banner in console
- Console monkey-patching that captures `[Live]`/`[Voice]`/`[GeminiVoice]` logs
- Press `Ctrl+Shift+L` to copy debug logs to clipboard

---

## Key Features

- **Real-time voice** via Gemini Live API with configurable voice (Zephyr)
- **A2UI widgets** rendered from tool responses (financial overview, AVM, rates, offers, add-ons)
- **Interactive investment chart** with period switching (1M/3M/YTD/1Y/ALL)
- **Bilingual** (Swedish/English) with `data-i18n` attribute-based translation
- **Swedish regulation math** (90% LTV cap, 3-tier amortization, Finansinspektionen rules)
- **Dynamic rate calculation** based on risk category, LTV, employment, and binding period
- **Cross-turn dedup** prevents Live API duplicate text from creating double bubbles
- **Graceful shutdown** via `start.sh` (SIGTERM → 2s wait → SIGKILL)
