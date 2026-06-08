# A2UI Implementation — ADK Live API

## Widget Dispatch

Tools return a dict with `widget_type` as the routing key. The backend stores these in session state via `after_tool_callback`, then flushes via `after_agent_callback` using `render_ui_widgets` and `state_delta`. The frontend parses multiple delivery formats and dispatches:

```javascript
// demo.js — widget routing
switch (payload.widget_type) {
  case 'bankid':             addBankID(); break;
  case 'financial_overview': addFinancialOverview(); break;
  case 'avm_valuation':      runAVMThenShow(payload); break;
  case 'rate_comparison':    showRateComparison(payload); break;
  case 'loan_offer':         renderOfferCard(payload); break;
  case 'addons':             renderAddons(); break;
}
```

## Widget Payloads

### `financial_overview` (from `visa_kontooversikt`)
```python
{
  'widget_type': 'financial_overview',
  'status': 'shown',
  'investment_summary': {
    'total_value_sek': 142_800,
    'performance': {'1m': '+2.9%', '3m': '+8.2%', 'ytd': '+8.7%', '1y': '+12.4%'},
    'holdings': [
      {'name': 'Avanza Zero', 'value_sek': 89_400, 'change_1m': '+1.8%', 'change_ytd': '+12.4%'},
      {'name': 'Länsförsäkringar Global Index', 'value_sek': 34_200, ...},
      {'name': 'Spiltan Aktiefond Investmentbolag', 'value_sek': 19_200, ...},
    ],
  },
  'transaction_insights': {
    'recurring_transfer': {
      'recipient': 'Current Bank', 'label': 'Bolån',
      'monthly_amount': 13683, 'months_observed': 22,
    },
  },
}
```

### `avm_valuation` (from `vardera_fastighet`)
```python
{
  'widget_type': 'avm_valuation',
  'address': 'Kungsgatan 44, 111 35 Stockholm',
  'estimated_value_sek': 5_000_000,  # Frontend renders as ±5% range
  'living_area_sqm': 65,
  'rooms': 2,
  'monthly_fee_sek': 4_200,
  'year_built': 1945,
}
```

### `rate_comparison` (from `visa_rantejamforelse`)
```python
{
  'widget_type': 'rate_comparison',
  'status': 'shown',
  'rates': [
    {'period_months': 3, 'rate_pct': 3.89},
    {'period_months': 12, 'rate_pct': 3.65},
    {'period_months': 24, 'rate_pct': 3.45},
    {'period_months': 36, 'rate_pct': 3.29},
    {'period_months': 60, 'rate_pct': 3.15},
  ],
}
```

### `loan_offer` (from `visa_laneerbjudande`)
```python
{
  'widget_type': 'loan_offer',
  'offered_rate': 3.69,        # Dynamically calculated
  'loan_amount': 2_800_000,
  'ltv_pct': 53.8,
  'interest_monthly': 8_610,
  'amort_monthly': 2_333,
  'amort_pct': 1.0,
  'total_monthly': 10_943,
  'current_rate': 4.15,
  'current_bank': 'Current Bank',
  'annual_savings': 12_880,
}
```

### `addons` (from `visa_tillagg`)
```python
{
  'widget_type': 'addons',
  'status': 'shown',
  'addons': [
    {'id': 'home_insurance', 'title_sv': 'Hemförsäkring', 'title_en': 'Home Insurance', 'price_sek': 199},
    {'id': 'mortgage_protection', 'title_sv': 'Bolåneskydd', 'title_en': 'Mortgage Protection', 'price_sek': 149},
    {'id': 'auto_save', 'title_sv': 'Autospar', 'title_en': 'Auto-Save', 'price_sek': 500},
  ],
}
```

## Immediate vs Deferred Widgets

Some widgets render immediately (before/alongside agent speech); others wait for text to finish:

```javascript
const IMMEDIATE_WIDGETS = new Set([
  'financial_overview',  // Suppress text, render widget, then release
  'bankid',              // Static BankID card
  'bankid_verified',     // Verified checkmark transition
  'avm_valuation',       // 5-phase loading pipeline
]);
```

Deferred widgets (`rate_comparison`, `loan_offer`, `addons`) use `queueWidgetRender()` which polls until the active agent text bubble finishes streaming.

## Widget Dedup

Widgets are deduped by a key of `widget_type + JSON.stringify(payload).length`. The `_renderedWidgets` Set prevents the same widget from rendering twice (important because the Live API can deliver widgets through multiple paths simultaneously).

## ADK Live API Quirks

- **`turn_complete` not sent for tool calls** — Under Gemini 3.1 Live Preview, the model issues tool calls without sending `turn_complete`. The patched `receive()` in `agent.py` breaks early on `message.tool_call` to execute tools immediately.
- **`speech_config` location** — Must be set on the `Gemini` model instance, not on Agent's `generate_content_config`.
- **Audio lags text by 200–800ms** — Never clear the audio queue when you want the model's speech to finish playing.
- **History format** — Live API doesn't support multi-turn `send_client_content`. The patched `send_history()` serializes history as a text transcript.
- **Widget delivery paths** — The frontend checks 4 paths: `render_ui_widgets`, `state_delta`, `functionResponse` in content parts, and `tool_response.functionResponses`.
