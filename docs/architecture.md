# Architecture

## System Overview

```mermaid
graph TD
    classDef frontend fill:#3b82f6,stroke:#312e81,stroke-width:2px,color:#fff
    classDef backend fill:#10b981,stroke:#064e3b,stroke-width:2px,color:#fff
    classDef tool fill:#f59e0b,stroke:#78350f,stroke-width:2px,color:#fff
    classDef data fill:#6366f1,stroke:#312e81,stroke-width:2px,color:#fff

    Browser["Browser Client<br/>(voice.js + demo.js)"]:::frontend
    ADK["ADK Live Runner<br/>(WebSocket on :8000)"]:::backend
    Agent["bolan_agent<br/>(Gemini 3.1 Flash Live)"]:::backend

    subgraph "Tools"
        BankID["visa_bankid_verifiering<br/>verifiera_identitet"]:::tool
        Credit["hamta_kreditupplysning"]:::tool
        Accounts["visa_kontooversikt"]:::tool
        AVM["vardera_fastighet"]:::tool
        Rates["visa_rantejamforelse"]:::tool
        Offer["visa_laneerbjudande"]:::tool
        Addons["visa_tillagg"]:::tool
    end

    subgraph "Data Layer"
        MockData["mock_data.py<br/>(customers, properties, rates)"]:::data
        State["Session State<br/>(via tool_context.state)"]:::data
    end

    Browser -- "Audio + Text (WebSocket)" --> ADK
    ADK -- "Forwards to" --> Agent
    Agent -- "Calls" --> BankID
    Agent -- "Calls" --> Credit
    Agent -- "Calls" --> Accounts
    Agent -- "Calls" --> AVM
    Agent -- "Calls" --> Rates
    Agent -- "Calls" --> Offer
    Agent -- "Calls" --> Addons

    BankID --> MockData
    Credit --> MockData
    Accounts --> MockData
    AVM --> MockData
    Rates --> MockData
    Offer --> State
    Offer --> MockData

    BankID -- "Returns widget JSON" --> ADK
    AVM -- "Returns widget JSON" --> ADK
    Rates -- "Returns widget JSON" --> ADK
    Offer -- "Returns widget JSON" --> ADK
    Addons -- "Returns widget JSON" --> ADK
    ADK -- "Streams Text + Audio + Widgets" --> Browser
```

## Model Configuration

The agent uses a custom `AIStudioGemini` LLM class (extending `Gemini`) that forces the Gemini Developer API even if GCP env vars are set:

- **Model**: `gemini-3.1-flash-live-preview`
- **Voice**: `Zephyr` (configured via `speech_config` on the model instance)
- **Live API version**: `v1alpha`
- **API Key**: Set via `GOOGLE_API_KEY` environment variable (loaded from `.env`)
- **Text fallback**: Set `USE_TEXT_MODEL=true` to use `gemini-flash-latest` without voice

> **Important**: The `speech_config` must be set on the `Gemini` model instance, not on the Agent's `generate_content_config`. ADK only reads `speech_config` from the model for Live API sessions.

## Monkey Patches

Two monkey patches on `GeminiLlmConnection` (version-guarded for ADK 2.0.x):

### `receive` (line 46–248)
Handles Gemini 3.1 Live Preview's tool call behavior. Under this model, `turn_complete` is NOT sent when the model issues a tool call — the receive loop must break early on `message.tool_call` to execute the tool immediately. Also handles transcription aggregation, grounding metadata, and session resumption.

### `send_history` (line 272–335)
Converts multi-turn conversation history into a single-turn text transcript. The Live API's `send_client_content` doesn't support the full history format that non-live sessions use, so we serialize it as a labeled transcript and send as a single user content turn.

Also includes `strip_a2ui_payload()` which removes `a2ui_payload` keys from function responses before including them in the transcript (reduces token usage).

## Widget Pipeline (A2UI)

Tools return a dict with `widget_type` as the dispatch key. The pipeline has two stages:

### Backend (agent.py)
1. Tool returns `{'widget_type': '...', ...}` dict
2. `after_tool_callback` (`handle_a2ui_rendering`) stores payload in `state['pending_widgets']` and JSON-serializes the response
3. `after_agent_callback` (`flush_pending_widgets`) reads `pending_widgets`, creates `UiWidget` objects via `render_ui_widgets`, and sets `state_delta` as fallback

### Frontend (voice.js → demo.js)
The frontend checks 4 delivery paths in `onmessage`:
1. `data.actions.render_ui_widgets` — primary path
2. `data.actions.state_delta.widget_*` — fallback for state delta keys
3. `data.content.parts[].functionResponse` — content parts format
4. `data.tool_response.functionResponses` — ADK Live API format

| widget_type | Tool | Frontend Renderer | Timing |
|---|---|---|---|
| `bankid` | `visa_bankid_verifiering` | BankID login card | Immediate |
| `bankid_verified` | `verifiera_identitet` | Verified checkmark | Immediate |
| `financial_overview` | `visa_kontooversikt` | Account balances + investment chart | Immediate |
| `avm_valuation` | `vardera_fastighet` | 5-phase loading → result card | Immediate |
| `rate_comparison` | `visa_rantejamforelse` | Rate comparison chip grid | Deferred |
| `loan_offer` | `visa_laneerbjudande` | Personalized offer card | Deferred |
| `addons` | `visa_tillagg` | Add-on option cards | Deferred |

## Rate Calculation Engine

The offered rate is computed by `calculate_offered_rate()` in `mock_data.py`:

```
offered_rate = base_rate[binding_period]
             + risk_adjustment[uc_category]
             + ltv_adjustment[ltv_tier]
             + employment_adjustment[employment_type]
             
Floor: 2.50%
```

This is wired into `visa_laneerbjudande()` in `tools.py`, using session state for risk category, LTV, and employment type.

## AVM Pipeline (5-Phase)

```
Phase 1: Suppress text (early detect on "valuation" keyword), audio plays through
Phase 2: Render static announcement bubble ("Thanks for the address...")
Phase 3: Loading animation with 5 fake progress steps (~7 seconds)
Phase 4: Render AVM result card (value range ±5%)
Phase 5: Release suppression + 15s cooldown, prompt model for post-AVM commentary
```

## Audio Synchronization

In the Gemini Live API, audio chunks arrive **200–800ms after** corresponding text tokens. The frontend manages three muting modes:

- **`drop`**: Audio chunks are discarded (used during static welcome flow)
- **`buffer`**: Audio is buffered and replayed after widget renders (used for financial overview)
- **unmuted**: Normal playback

Key timing rules:
- Pre-AVM: early detection suppresses text but NOT audio (model's acknowledgment is heard)
- During AVM: model has completed its turn, no unwanted audio follows
- Post-AVM: cooldown flag prevents "valuation" in commentary from re-triggering suppression
