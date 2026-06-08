"""
Bolån Agent – Live API Single-Agent Architecture
==================================================
Single root agent with tools, Gemini 3.1 Flash Live Preview model,
monkey patches for Live API tool call handling.
"""

from __future__ import annotations

import logging
import os
import json
import time
import functools

from google.adk.agents import Agent
from google.adk.agents.callback_context import CallbackContext
from google.adk.apps import App
from google.adk.models import Gemini
from google.adk.tools import BaseTool, ToolContext
from google.adk.events.event_actions import UiWidget
from google.genai import types
from google.adk.models.gemini_llm_connection import GeminiLlmConnection
from google.adk.models import LlmResponse
from google.adk.utils.context_utils import Aclosing

logger = logging.getLogger(__name__)

try:
    import google.adk as _adk_mod
    _adk_version = getattr(_adk_mod, '__version__', 'unknown')
    if not _adk_version.startswith('2.0'):
        logger.warning(
            "Monkey patches were written for ADK 2.0.x but found %s. "
            "Verify patches still work or remove them if fixes are upstream.",
            _adk_version,
        )
except Exception:
    pass

# ──────────────────────────────────────────────
#  Monkey Patch: GeminiLlmConnection.receive
#  Handles Gemini 3.1 Live Preview tool call behavior
# ──────────────────────────────────────────────

async def _patched_receive(self):
    from google.adk.models.google_llm import GoogleLLMVariant
    text = ''
    is_thought = False
    tool_call_parts = []
    
    async with Aclosing(self._gemini_session.receive()) as agen:
      async for message in agen:
        live_session_id = self._gemini_session.session_id
        if message.usage_metadata:
          yield LlmResponse(
              usage_metadata=message.usage_metadata,
              model_version=self._model_version,
              live_session_id=live_session_id,
          )
        if message.server_content:
          content = message.server_content.model_turn

          if (
              not (content and content.parts)
              and message.server_content.grounding_metadata
              and not message.server_content.turn_complete
          ):
            yield LlmResponse(
                grounding_metadata=message.server_content.grounding_metadata,
                interrupted=message.server_content.interrupted,
                model_version=self._model_version,
                live_session_id=live_session_id,
            )

          if content and content.parts:
            llm_response = LlmResponse(
                content=content,
                interrupted=message.server_content.interrupted,
                model_version=self._model_version,
                live_session_id=live_session_id,
            )
            if not message.server_content.turn_complete:
              llm_response.grounding_metadata = (
                  message.server_content.grounding_metadata
              )
            if content.parts[0].text:
              current_is_thought = getattr(content.parts[0], 'thought', False)
              if text and current_is_thought != is_thought:
                yield self._GeminiLlmConnection__build_full_text_response(text, is_thought)
                text = ''
                is_thought = False

              text += content.parts[0].text
              is_thought = current_is_thought
              llm_response.partial = True
            elif text and not content.parts[0].inline_data:
              yield self._GeminiLlmConnection__build_full_text_response(text, is_thought)
              text = ''
              is_thought = False
            yield llm_response
            
          if message.server_content.input_transcription:
            if message.server_content.input_transcription.text:
              self._input_transcription_text += (
                  message.server_content.input_transcription.text
              )
              yield LlmResponse(
                  input_transcription=types.Transcription(
                      text=message.server_content.input_transcription.text,
                      finished=False,
                  ),
                  partial=True,
                  model_version=self._model_version,
                  live_session_id=live_session_id,
              )
            if message.server_content.input_transcription.finished:
              yield LlmResponse(
                  input_transcription=types.Transcription(
                      text=self._input_transcription_text,
                      finished=True,
                  ),
                  partial=False,
                  model_version=self._model_version,
                  live_session_id=live_session_id,
              )
              self._input_transcription_text = ''
          if message.server_content.output_transcription:
            if message.server_content.output_transcription.text:
              self._output_transcription_text += (
                  message.server_content.output_transcription.text
              )
              yield LlmResponse(
                  output_transcription=types.Transcription(
                      text=message.server_content.output_transcription.text,
                      finished=False,
                  ),
                  partial=True,
                  model_version=self._model_version,
                  live_session_id=live_session_id,
              )
            if message.server_content.output_transcription.finished:
              yield LlmResponse(
                  output_transcription=types.Transcription(
                      text=self._output_transcription_text,
                      finished=True,
                  ),
                  partial=False,
                  model_version=self._model_version,
                  live_session_id=live_session_id,
              )
              self._output_transcription_text = ''
          if self._api_backend == GoogleLLMVariant.GEMINI_API and (
              message.server_content.interrupted
              or message.server_content.turn_complete
              or message.server_content.generation_complete
          ):
            if self._input_transcription_text:
              yield LlmResponse(
                  input_transcription=types.Transcription(
                      text=self._input_transcription_text,
                      finished=True,
                  ),
                  partial=False,
                  model_version=self._model_version,
                  live_session_id=live_session_id,
              )
              self._input_transcription_text = ''
            if self._output_transcription_text:
              yield LlmResponse(
                  output_transcription=types.Transcription(
                      text=self._output_transcription_text,
                      finished=True,
                  ),
                  partial=False,
                  model_version=self._model_version,
                  live_session_id=live_session_id,
              )
              self._output_transcription_text = ''
          if message.server_content.turn_complete:
            if text:
              yield self._GeminiLlmConnection__build_full_text_response(text, is_thought)
              text = ''
              is_thought = False
            if tool_call_parts:
              yield LlmResponse(
                  content=types.Content(role='model', parts=tool_call_parts),
                  model_version=self._model_version,
                  live_session_id=live_session_id,
              )
              tool_call_parts = []
            yield LlmResponse(
                turn_complete=True,
                interrupted=message.server_content.interrupted,
                grounding_metadata=message.server_content.grounding_metadata,
                model_version=self._model_version,
                live_session_id=live_session_id,
            )
            break
          if message.server_content.interrupted:
            if text:
              yield self._GeminiLlmConnection__build_full_text_response(text, is_thought)
              text = ''
              is_thought = False
            else:
              yield LlmResponse(
                  interrupted=message.server_content.interrupted,
                  model_version=self._model_version,
                  live_session_id=live_session_id,
              )
        if message.tool_call:
          if text:
            yield self._GeminiLlmConnection__build_full_text_response(text, is_thought)
            text = ''
            is_thought = False
          tool_call_parts.extend([
              types.Part(function_call=function_call)
              for function_call in message.tool_call.function_calls
          ])
          # Break early when a tool call is received. Under Gemini 3.1 Live Preview,
          # turn_complete is not sent for tool calls, so we must exit to execute the tool immediately.
          break
        if message.session_resumption_update:
          from google.adk.models.google_llm import GoogleLLMVariant
          if self._api_backend != GoogleLLMVariant.GEMINI_API:
            yield (
                LlmResponse(
                    live_session_resumption_update=message.session_resumption_update,
                    model_version=self._model_version,
                    live_session_id=live_session_id,
                )
            )

        if message.go_away:
          yield LlmResponse(
              go_away=message.go_away,
              model_version=self._model_version,
              live_session_id=live_session_id,
          )

      if tool_call_parts:
        yield LlmResponse(
            content=types.Content(role='model', parts=tool_call_parts),
            model_version=self._model_version,
            live_session_id=self._gemini_session.session_id,
        )

GeminiLlmConnection.receive = _patched_receive

# ──────────────────────────────────────────────
#  Monkey Patch: GeminiLlmConnection.send_history
#  Converts history to single-turn transcript
# ──────────────────────────────────────────────

original_send_history = GeminiLlmConnection.send_history

def strip_a2ui_payload(response_obj):
    import json
    if isinstance(response_obj, dict):
        response_copy = {k: v for k, v in response_obj.items() if k != 'a2ui_payload'}
        if 'result' in response_copy and isinstance(response_copy['result'], str):
            try:
                res_dict = json.loads(response_copy['result'])
                if isinstance(res_dict, dict):
                    res_dict.pop('a2ui_payload', None)
                    response_copy['result'] = json.dumps(res_dict, ensure_ascii=False)
            except Exception:
                pass
        return response_copy
    return response_obj

async def patched_send_history(self, history):
    import json
    from google.genai import types

    if not history:
        logger.debug("send_history called with empty history")
        return

    # Build a clean text transcript of the history
    lines = []
    lines.append("Here is the conversation history so far for your context:")
    lines.append("=== CONVERSATION HISTORY ===")
    
    for turn in history:
        role_label = "User" if turn.role == "user" else "Model"
        parts_text = []
        for part in turn.parts:
            if part.text:
                parts_text.append(part.text)
            elif part.function_call:
                fc = part.function_call
                args_str = f" with arguments: {fc.args}" if fc.args else ""
                parts_text.append(f"[Called tool `{fc.name}`{args_str}]")
            elif part.function_response:
                fr = part.function_response
                cleaned_resp = strip_a2ui_payload(fr.response)
                resp_str = ""
                if cleaned_resp:
                    if isinstance(cleaned_resp, dict):
                        try:
                            resp_str = json.dumps(cleaned_resp, ensure_ascii=False)
                        except Exception:
                            resp_str = str(cleaned_resp)
                    else:
                        resp_str = str(cleaned_resp)
                parts_text.append(f"[Tool `{fr.name}` returned: {resp_str}]")
        
        if parts_text:
            combined_parts = " ".join(parts_text)
            lines.append(f"[{role_label}]: {combined_parts}")
            
    lines.append("=== END OF CONVERSATION HISTORY ===")
    
    last_is_user = (history[-1].role == 'user')
    if last_is_user:
        lines.append("Please respond to the user's last message or tool response above.")
    else:
        lines.append("Please wait for the next user message.")

    transcript_text = "\n".join(lines)
    
    logger.debug("send_history transcript:\n%s", transcript_text)

    single_content = types.Content(
        role="user",
        parts=[types.Part.from_text(text=transcript_text)]
    )

    await self._gemini_session.send_client_content(
        turns=[single_content],
        turn_complete=last_is_user,
    )

GeminiLlmConnection.send_history = patched_send_history


# ──────────────────────────────────────────────
#  Model Configuration
# ──────────────────────────────────────────────

class AIStudioGemini(Gemini):
    """Forces the use of the Gemini Developer API (AI Studio) even if GCP env vars are set."""

    @functools.cached_property
    def api_client(self):
        from google.genai import Client, types
        kwargs = {
            "http_options": types.HttpOptions(
                headers=self._tracking_headers(),
                retry_options=self.retry_options,
                base_url=self.base_url,
            ),
            "vertexai": False,
        }
        return Client(**kwargs)

    @functools.cached_property
    def _live_api_client(self):
        from google.genai import Client, types
        kwargs = {
            "http_options": types.HttpOptions(
                headers=self._tracking_headers(),
                api_version="v1alpha",
                base_url=self.base_url,
            ),
            "vertexai": False,
        }
        return Client(**kwargs)


USE_TEXT_MODEL = os.environ.get("USE_TEXT_MODEL", "false").lower() == "true"

text_model = AIStudioGemini(model="gemini-flash-latest")
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

bolan_model = text_model if USE_TEXT_MODEL else live_model


# ──────────────────────────────────────────────
#  System Instruction
# ──────────────────────────────────────────────

SYSTEM_INSTRUCTION = """You are Banksy — an AI mortgage advisor for Swedish Bank (Svenska Banken). You help customers with mortgage applications, refinancing, and rate negotiations. You are available 24/7 and can complete processes that normally take 3-5 business days in seconds.

LANGUAGE RULES — CRITICAL:
- Your DEFAULT language is ENGLISH. Start and continue in English unless the user explicitly speaks Swedish.
- If the user speaks English, you MUST respond in English. If the user speaks Swedish, respond in Swedish.
- The tool names are in Swedish (e.g., visa_kontooversikt) — this does NOT mean you should speak Swedish. Tool names are internal and have no bearing on the conversation language.
- NEVER switch to Swedish unless the user speaks Swedish first.

You are a female voice assistant. Maintain a consistent, warm, professional female voice identity throughout the entire conversation regardless of topic changes or language switches.

[CORE BEHAVIOR]
- The customer's name is ALWAYS Erik. NEVER use any other name.
- Keep responses SHORT — 2-3 sentences max. The visual widgets show the data, you don't need to repeat it.
- Be warm, professional, and reassuring. Use a natural conversational tone.
- NEVER read out numbers, percentages, or data that is displayed in a widget card. Just reference it briefly.
- After each tool call and response, STOP and wait for the user to respond.
- NEVER call multiple tools in one turn. Call ONE tool, then respond to the user.

[USER JOURNEY — FOLLOW THIS EXACT FLOW]

Step 1: WELCOME + BANKID (HANDLED BY FRONTEND — SKIP THIS STEP)
- The greeting and BankID flow are handled entirely by the frontend.
- Do NOT greet the customer. Do NOT call visa_bankid_verifiering().
- Just wait silently until you receive a user message with the [SYSTEM CONTEXT] prime.

Step 2: FINANCIAL OVERVIEW
- When the user asks to see their accounts or financial status:
- IMPORTANT: Do NOT say anything before calling the tools. No "sure" or "let me pull up". Call the tools FIRST, silently.
- Call hamta_kreditupplysning() to fetch credit data (backend-only, no widget).
- Call visa_kontooversikt() to show the financial overview widget.
- The widget will render on screen automatically. AFTER it appears, say EXACTLY this (word for word, no changes):
  "Here is your financial overview, Erik. Your investments are up almost 3% this month. Oh, I did notice one more thing. You have had a standing payment of around 14,000 kr a month marked as Mortgage for the last 22 months to another bank. Is your mortgage up for renewal in the next 3 months?"
- CRITICAL: Use these EXACT words. Do NOT change the name. Do NOT shorten. Do NOT paraphrase.
- Do NOT call visa_proaktiv_insikt().
- STOP and wait for the user to respond.

Step 3: MORTGAGE RENEWAL RESPONSE
- The user might say something like "yeah I think so but I'm not sure."
- Say EXACTLY: "Okay, that's no problem. If so, I can help find you the best rates in the market. Would you like to explore what offers are out there?"
- STOP and wait for the user to confirm interest.

Step 4: MORTGAGE QUESTIONNAIRE
- Once the user confirms interest (e.g., "sure, we can have a look"):
- Begin a realistic mortgage questionnaire. Ask the following ONE AT A TIME:
  a) "Great! First, could you give me the address or postcode of the property?"
- STOP and wait for the answer.

Step 5: AVM VALUATION
- After the user provides the address, call vardera_fastighet(adress=the_address) immediately.
- Do NOT ask about valuation documents first. Just call the tool directly.
- After calling vardera_fastighet, you MUST say ONLY this short sentence: "Thanks for the postcode. I will now run an automated property valuation for [repeat the address or postcode the user gave]. One moment." Do NOT add any follow-up questions, commentary, or extra sentences. The frontend handles everything else.

Step 6: OUTSTANDING LOAN AMOUNT
- Once the user confirms the valuation (e.g., "yeah that sounds about right"), respond naturally and positively, then ask what the outstanding amount on their current mortgage is.
- STOP and wait for the answer.

Step 7: ACKNOWLEDGE LOAN AMOUNT
- When the user provides the amount (e.g., "2.8 million"), briefly acknowledge what they said in a natural way.
- Then ask about their current binding period and whether they'd like to keep the same type or explore other options.
- STOP and wait for the answer.

Step 8: RATE COMPARISON
- When the user specifies their binding period preference (e.g., "variable 3 months, I want to keep it"):
- Briefly confirm their choice and let them know you'll pull up the latest options.
- Call visa_rantejamforelse() to show Swedish Bank's rates across all binding periods (3 months variable, 1 year fixed, 3 years fixed, 5 years fixed).
- After calling the tool, briefly present the results and highlight the period the customer expressed interest in. Ask what they think.
- STOP and wait for the user to respond.

Step 9: LOAN OFFER
- When the user responds positively to the rate comparison:
- First, naturally acknowledge what they said (e.g., if they said "Swedish Bank looks best", respond to that specifically).
- Then call visa_laneerbjudande() to show the personalized offer.
- After calling the tool, briefly present the offer and mention the savings. Then naturally ask if they'd also like to see some complementary add-on options like home insurance.
- STOP and wait.

Step 10: ADD-ONS
- If the user expresses any interest in add-ons (even casually like "sure, we can have a look"):
- Call visa_tillagg() immediately.
- After calling the tool, briefly present the options. Respect the user's sentiment — if they sounded hesitant, don't be pushy.
- IMPORTANT: Do NOT mention application processing or next steps here. ONLY present the add-on options.
- STOP and wait for the user to respond about the add-ons before saying anything else.

Step 11: WRAP UP AFTER ADD-ONS
- After the user responds to add-ons, say something like:
  a) "No worries at all, Erik. Is there anything else I can help you with today?"
  b) Or if they chose some: "Great choices, Erik! Is there anything else I can help you with?"
- STOP and wait.

Step 12: GOODBYE
- When the user says they're done (e.g., "no I'm good", "that's all", "nothing else"):
- Say something warm and brief like: "It was great chatting with you, Erik. Don't hesitate to reach out if you need anything. Have a wonderful day!"
- STOP.

[CRITICAL RULES]
- NEVER say a personnummer (social security number) out loud or in text.
- NEVER list data that's already shown in a widget card — just reference it.
- Call tools ONE AT A TIME, wait for each result before calling the next.
- NEVER SKIP STEPS. Follow the journey in the exact order above.
- Ask ONE question at a time. Do not combine multiple questions in one message.
- If the user asks something completely unrelated (e.g., weather, sports, cooking), gently redirect to the mortgage process. However, ALWAYS answer follow-up questions about data you have already shown or discussed (e.g., investments, YTD performance, account balances, credit report, rates). The user has a right to ask about their own financial information.
- The customer's name is Erik. Do NOT invent, guess, or use any other name.

[TEXT FORMATTING]
- Always put a space after periods, commas, colons, and other punctuation.
- Use proper line breaks between separate thoughts.
- Keep sentences clean and well-separated. Never run sentences together without spacing.
"""


# ──────────────────────────────────────────────
#  Tool Imports
# ──────────────────────────────────────────────

from .tools import (
    visa_bankid_verifiering,
    verifiera_identitet,
    hamta_kreditupplysning,
    visa_kontooversikt,
    visa_proaktiv_insikt,
    vardera_fastighet,
    visa_rantejamforelse,
    visa_laneerbjudande,
    visa_tillagg,
    handle_a2ui_rendering,
)


# ──────────────────────────────────────────────
#  After-Agent Callback: Flush Pending Widgets
#  (Live API only delivers render_ui_widgets via
#   after_agent_callback, not after_tool_callback)
# ──────────────────────────────────────────────

async def flush_pending_widgets(callback_context: CallbackContext) -> types.Content | None:
    """Flushes pending widget payloads stored by tools via render_ui_widgets + state_delta."""
    state = callback_context.state
    pending = state.get('pending_widgets', [])
    if not pending:
        return None

    # Clear pending
    state['pending_widgets'] = []

    # Inject each widget
    if not callback_context.actions.render_ui_widgets:
        callback_context.actions.render_ui_widgets = []
    if not getattr(callback_context.actions, 'state_delta', None):
        callback_context.actions.state_delta = {}

    for widget_payload in pending:
        wtype = widget_payload.get('widget_type', 'unknown')
        callback_context.actions.render_ui_widgets.append(
            UiWidget(id=f'widget_{wtype}', provider='bolan', payload=widget_payload)
        )
        # Also set state_delta as fallback
        callback_context.actions.state_delta[f'widget_{wtype}'] = widget_payload

    # Return a silent text chunk to force-flush the state_delta over WebSocket
    return types.Content(role="model", parts=[types.Part.from_text(text=" ")])


# ──────────────────────────────────────────────
#  Single Root Agent
# ──────────────────────────────────────────────

bolan_agent = Agent(
    name="bolan_agent",
    model=bolan_model,
    instruction=SYSTEM_INSTRUCTION,
    tools=[
        visa_bankid_verifiering,
        verifiera_identitet,
        hamta_kreditupplysning,
        visa_kontooversikt,
        visa_proaktiv_insikt,
        vardera_fastighet,
        visa_rantejamforelse,
        visa_laneerbjudande,
        visa_tillagg,
    ],
    after_tool_callback=handle_a2ui_rendering,
    after_agent_callback=flush_pending_widgets,
)


# ──────────────────────────────────────────────
#  ADK App Entry Point
# ──────────────────────────────────────────────

app = App(root_agent=bolan_agent, name="app")

