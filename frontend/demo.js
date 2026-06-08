/* ═══════════════════════════════════════════════════════════
   Banksy — Live API Mortgage Advisor
   Agent-driven conversation via ADK Live WebSocket
   ═══════════════════════════════════════════════════════════ */
if (window.location.search.includes('debug')) {
  console.log('%c[DEMO.JS] ✅ v0.3.0 loaded', 'color: lime; font-size: 14px; font-weight: bold;');
}
// ── DOM Selectors & State ──
const $=s=>document.querySelector(s);
const chatToggle=$('#chatToggle'),chatPanel=$('#chatPanel'),chatClose=$('#chatClose'),chatBody=$('#chatBody'),chatBadge=$('#chatBadge'),overlay=$('#chatOverlay'),restartBtn=$('#chatRestart');
let isOpen=false,started=false,demoTime=new Date();
function ts(){const h=String(demoTime.getHours()).padStart(2,'0'),m=String(demoTime.getMinutes()).padStart(2,'0');demoTime.setMinutes(demoTime.getMinutes()+Math.floor(Math.random()*2));return`${h}:${m}`}

let currentLang = 'en';
let voiceConnected = false;
let currentAgentBubble = null; // The bubble being streamed into
let agentTextBuffer = '';      // Accumulates agent text chunks
let pendingPrime = '';         // Context to prepend to user's first message after BankID

// ── Hero Chat Bar ──
const heroChatInput=$('#heroChatInput'),heroChatSend=$('#heroChatSend'),heroChatbar=$('#heroChatbar');
let heroInitialMsg='';
function updateHeroPlaceholder(){if(heroChatInput)heroChatInput.placeholder=heroChatInput.getAttribute('data-placeholder-'+currentLang)||''}
if(heroChatInput){
  heroChatInput.addEventListener('input',()=>{heroChatSend.disabled=!heroChatInput.value.trim()});
  const submitHero=()=>{
    const msg=heroChatInput.value.trim();if(!msg)return;
    heroInitialMsg=msg;
    heroChatbar.classList.add('sending');
    setTimeout(()=>{openChat();heroChatbar.classList.add('sent')},400);
  };
  heroChatInput.addEventListener('keydown',e=>{if(e.key==='Enter')submitHero()});
  heroChatSend.addEventListener('click',submitHero);
}
setTimeout(updateHeroPlaceholder,0);


/* ═══════════════════════════════════════════════════════════
   Translations (T_DB)
   ═══════════════════════════════════════════════════════════ */
const T_DB = {
  sv: {
    nav_private: 'Privat', nav_corp: 'Företag', nav_wealth: 'Wealth Management',
    nav_about: 'Om oss', nav_support: 'Kundservice', nav_login: 'Logga in',
    hero_badge: 'Framtidens bank är här',
    hero_title: 'Välkommen till<br><span class="hero-highlight">framtidens bank.</span>',
    hero_sub: 'Upplev en helt ny typ av bank där AI och smarta digitala processer ger dig bättre villkor, lägre räntor och personlig rådgivning dygnet runt.',
    hero_feat_1: '<span class="hf-icon">✓</span>Bolån med marknadens lägsta räntor',
    hero_feat_2: '<span class="hf-icon">✓</span>Personlig AI-assistent dygnet runt',
    hero_feat_3: '<span class="hf-icon">✓</span>Säkert, snabbt och transparent',
    hero_apply_btn: 'Prata med Banksy', hero_calc_btn: 'Beräkna bolån',
    calc_title: 'Beräkna din boendekostnad', calc_prop_val: 'Bostadens värde',
    calc_loan_amt: 'Lånebelopp', calc_ltv: 'Belåningsgrad',
    calc_rate: 'Rörlig ränta (3 mån)', calc_monthly_cost: 'Beräknad månadskostnad',
    calc_currency: 'kr/mån', calc_action_btn: 'Ansök om flytt med Banksy ➔',
    hero_chatbar_hint: 'Fråga om bolån, räntor, låneflytt eller vad som helst',
    hero_disclaimer: 'Swedish Bank är nästa generations digitala bank för dig som ställer högre krav.',
    hero_card_label: 'Vår lägsta listränta', hero_card_period: 'Bunden ränta, 10 år',
    rate_type_floating: 'Rörlig (3 mån)', rate_type_fixed_3: 'Bunden 3 år',
    hero_card_date: 'Uppdaterad 2026-05-19',
    rates_title: 'Aktuella bolåneräntor',
    rates_sub: 'Listräntor per 2026-05-19. Individuell ränta baseras på belåningsgrad, kreditvärdighet och engagemang.',
    rate_period_3m: '3 mån', rate_type_floating_label: 'Rörlig', rate_detail_3m: 'Kan ändras kvartalsvis',
    rate_period_1y: '1 år', rate_type_fixed_label: 'Bunden', rate_detail_1y: 'Fast i 12 månader',
    rate_badge_pop: 'Populärast', rate_period_3y: '3 år', rate_detail_3y: 'Balans trygghet/pris',
    rate_period_5y: '5 år', rate_detail_5y: 'Långsiktig stabilitet',
    rate_period_10y: '10 år', rate_detail_10y: 'Maximal förutsägbarhet',
    rates_footnote: 'Räntorna ovan är listräntor. Din individuella ränta kan vara lägre beroende på belåningsgrad och helkundsengagemang.',
    info_title_1: 'Köpa bostad', info_text_1: 'Från lånelöfte till tillträde. Vi guidar dig genom hela processen — digital ansökan, värdering och signering via BankID.',
    info_link: 'Läs mer →',
    info_title_2: 'Flytta bolån till oss', info_text_2: 'Byt bank utan krångel. Vi hämtar ditt amorteringsunderlag, matchar eller förbättrar din ränta och sköter hela flytten.',
    info_title_3: 'Ränteguide &amp; rådgivning', info_text_3: 'Bunden eller rörlig? Vår rådgivningsmotor rekommenderar räntestrategi baserat på din ekonomi och marknadsutsikt.',
    footer_title_1: 'Swedish Bank AB', footer_text_1: 'Org.nr: 556000-1234<br>Bankgiro: 191-0912<br>Finansinspektionens tillstånd: 2024-0001',
    footer_title_2: 'Kundservice', footer_text_2: '0771-22 11 22<br>Mån–Fre 08:00–20:00<br>Lör 10:00–14:00',
    footer_title_3: 'Viktig information', footer_text_3: 'Kreditgivare: Swedish Bank AB. Kreditprövning sker alltid. Amorteringskrav enligt Finansinspektionens föreskrifter.',
    chat_header_status: 'Din personliga rådgivare - dygnet runt',
    user_label: 'DU', input_placeholder: 'Skriv ditt meddelande...',
    input_ph_active: 'Skriv en fråga eller välj ett alternativ...',
    welcome_hello: 'Hej! Jag är <strong>Banksy</strong>, din personliga bankassistent. Jag kan hjälpa dig med allt från bolån och ränteförhandling till sparande. Är du redan kund hos oss?',
    welcome_login: 'Ja, logga in med BankID',
    welcome_explore: 'Nej, jag vill registrera mig',
    bankid_verifying: 'Väntar på BankID-verifiering...',
    bankid_verified_name: 'Erik Wallström', bankid_verified_ssn: '199003XX-XXXX',
    account_overview_title: 'Dina konton',
    account_checking: 'Lönekonto', account_savings: 'Sparkonto',
    account_checking_balance: '47 230 kr', account_savings_balance: '312 500 kr',
    investment_title: 'Investeringar',
    investment_fund: 'Swedbank Robur Teknik', investment_fund_value: '89 400 kr', investment_fund_change: '+1,8%',
    investment_fund2: 'SEB Hållbar Sverige', investment_fund2_value: '34 200 kr', investment_fund2_change: '+0,6%',
    investment_fund3: 'Avanza Global', investment_fund3_value: '19 200 kr', investment_fund3_change: '+3,1%',
    investment_isk: 'ISK Totalt', investment_isk_value: '142 800 kr', investment_isk_change: '+2,9%',
    insight_title: 'Ekonomisk insikt',
    insight_text: 'Vi ser att du kan spara <strong>AMOUNT kr/år</strong> genom att flytta ditt bolån från BANK (OLDRATE%) till vår ränta (NEWRATE%).',
    insight_yes: 'Ja, hjälp mig hitta bättre räntor', insight_no: 'Inte just nu',
  },
  en: {
    nav_private: 'Personal', nav_corp: 'Corporate', nav_wealth: 'Wealth Management',
    nav_about: 'About Us', nav_support: 'Customer Service', nav_login: 'Log In',
    hero_badge: 'The bank of the future is here',
    hero_title: 'Welcome to the<br><span class="hero-highlight">bank of the future.</span>',
    hero_sub: 'Experience a brand new kind of bank where AI and smart digital processes give you better terms, lower interest rates, and personal advice 24/7.',
    hero_feat_1: '<span class="hf-icon">✓</span>Mortgages with the market\'s lowest rates',
    hero_feat_2: '<span class="hf-icon">✓</span>Personal AI assistant available 24/7',
    hero_feat_3: '<span class="hf-icon">✓</span>Secure, fast, and transparent',
    hero_apply_btn: 'Talk to Banksy', hero_calc_btn: 'Calculate Mortgage',
    calc_title: 'Calculate your housing cost', calc_prop_val: 'Property value',
    calc_loan_amt: 'Loan amount', calc_ltv: 'Loan-to-value (LTV)',
    calc_rate: 'Variable rate (3 mo)', calc_monthly_cost: 'Estimated monthly cost',
    calc_currency: 'SEK/mo', calc_action_btn: 'Apply for transfer with Banksy ➔',
    hero_chatbar_hint: 'Ask about mortgages, rates, loan transfers or anything',
    hero_disclaimer: 'Swedish Bank is the next generation digital bank for those who demand more.',
    hero_card_label: 'Our lowest list rate', hero_card_period: 'Fixed rate, 10 years',
    rate_type_floating: 'Variable (3 mo)', rate_type_fixed_3: 'Fixed 3 years',
    hero_card_date: 'Updated 2026-05-19',
    rates_title: 'Current Mortgage Rates',
    rates_sub: 'List rates as of 2026-05-19. Your individual rate is based on loan-to-value, creditworthiness, and consolidation.',
    rate_period_3m: '3 mo', rate_type_floating_label: 'Variable', rate_detail_3m: 'Subject to quarterly adjustment',
    rate_period_1y: '1 year', rate_type_fixed_label: 'Fixed', rate_detail_1y: 'Fixed for 12 months',
    rate_badge_pop: 'Most Popular', rate_period_3y: '3 years', rate_detail_3y: 'Balanced security & price',
    rate_period_5y: '5 years', rate_detail_5y: 'Long-term stability',
    rate_period_10y: '10 years', rate_detail_10y: 'Maximum predictability',
    rates_footnote: 'The interest rates above are list rates. Your individual rate may be lower depending on LTV and total consolidation.',
    info_title_1: 'Buying a Home', info_text_1: 'From loan commitment to move-in day. We guide you through the entire process — digital application, valuation, and signing via BankID.',
    info_link: 'Read more →',
    info_title_2: 'Transfer Mortgage to Us', info_text_2: 'Switch banks hassle-free. We fetch your amortization plan, match or beat your interest rate, and handle the entire transfer.',
    info_title_3: 'Interest Rates & Advisory', info_text_3: 'Fixed or variable? Our advisory engine recommends an interest rate strategy based on your finances and market outlook.',
    footer_title_1: 'Swedish Bank AB', footer_text_1: 'Reg.no: 556000-1234<br>Bankgiro: 191-0912<br>Licensed by Finansinspektionen: 2024-0001',
    footer_title_2: 'Customer Service', footer_text_2: '0771-22 11 22<br>Mon–Fri 08:00–20:00<br>Sat 10:00–14:00',
    footer_title_3: 'Important Information', footer_text_3: 'Lender: Swedish Bank AB. A credit assessment is always conducted. Amortization rules apply according to Swedish financial authority regulations.',
    chat_header_status: 'Your personal advisor - 24/7',
    user_label: 'YOU', input_placeholder: 'Type your message...',
    input_ph_active: 'Type a message or select an option...',
    welcome_hello: 'Hi! I\'m <strong>Banksy</strong>, your personal banking assistant. I can help you with everything from mortgages and rate negotiation to savings. Are you an existing customer?',
    welcome_login: 'Yes, sign in with BankID',
    welcome_explore: 'No, I would like to register',
    bankid_verifying: 'Waiting for BankID verification...',
    bankid_verified_name: 'Erik Wallström', bankid_verified_ssn: '199003XX-XXXX',
    account_overview_title: 'Your Accounts',
    account_checking: 'Checking Account', account_savings: 'Savings Account',
    account_checking_balance: '47 230 kr', account_savings_balance: '312 500 kr',
    investment_title: 'Investments',
    investment_fund: 'Swedbank Robur Tech', investment_fund_value: '89 400 kr', investment_fund_change: '+1.8%',
    investment_fund2: 'SEB Sustainable Sweden', investment_fund2_value: '34 200 kr', investment_fund2_change: '+0.6%',
    investment_fund3: 'Avanza Global', investment_fund3_value: '19 200 kr', investment_fund3_change: '+3.1%',
    investment_isk: 'ISK Total', investment_isk_value: '142 800 kr', investment_isk_change: '+2.9%',
    insight_title: 'Financial Insight',
    insight_text: 'We see you could save <strong>AMOUNT kr/year</strong> by moving your mortgage from BANK (OLDRATE%) to our rate (NEWRATE%).',
    insight_yes: 'Yes, help me find better rates', insight_no: 'Not right now',
  }
};


/* ═══════════════════════════════════════════════════════════
   Translation Helpers
   ═══════════════════════════════════════════════════════════ */

const t = (key, data = {}) => {
  const translations = T_DB[currentLang];
  if (!translations || !translations[key]) return key;
  return translations[key];
};

function translatePage(lang) {
  currentLang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const text = t(key);
    if (text !== key) el.innerHTML = text;
  });
  const btnSV = $('#langBtnSV'), btnEN = $('#langBtnEN');
  if (lang === 'sv') {
    if (btnSV) btnSV.classList.add('active');
    if (btnEN) btnEN.classList.remove('active');
    document.documentElement.lang = 'sv';
    document.title = 'Swedish Bank AB — Bolån och bostadsfinansiering';
  } else {
    if (btnSV) btnSV.classList.remove('active');
    if (btnEN) btnEN.classList.add('active');
    document.documentElement.lang = 'en';
    document.title = 'Swedish Bank AB — Mortgages and home finance';
  }
  if (chatInput) chatInput.placeholder = t('input_placeholder');
  if (restartBtn) restartBtn.title = lang === 'sv' ? 'Starta om demo' : 'Restart demo';
}

function setLanguage(lang) {
  if (currentLang === lang) return;
  translatePage(lang);
  updateHeroPlaceholder();
}
window.setLanguage = setLanguage;


/* ═══════════════════════════════════════════════════════════
   Chat Panel Controls
   ═══════════════════════════════════════════════════════════ */

function openChat(){
  isOpen=true;
  chatPanel.classList.add('open');
  chatToggle.classList.add('open');
  chatBadge.classList.add('hidden');
  overlay.classList.add('active');
  if(!started){
    started=true;
    connectAndStart();
  }
}
function closeChat(){isOpen=false;chatPanel.classList.remove('open');chatToggle.classList.remove('open');overlay.classList.remove('active')}
function restartDemo(){
  chatBody.innerHTML='';
  started=false;
  currentAgentBubble=null;
  agentTextBuffer='';
  voiceConnected=false;
  if(typeof GeminiVoice!=='undefined')GeminiVoice.disconnect();
  started=true;
  connectAndStart();
}
chatToggle.onclick=openChat;chatClose.onclick=closeChat;overlay.onclick=closeChat;
if(restartBtn)restartBtn.onclick=restartDemo;


/* ═══════════════════════════════════════════════════════════
   Core Helpers
   ═══════════════════════════════════════════════════════════ */

const sl=ms=>new Promise(r=>setTimeout(r,ms));
const chatInput=$('#chatInput'),chatSend=$('#chatSend'),chatMic=$('#chatMic');

function enableInput(ph){if(chatInput){chatInput.disabled=false;chatInput.placeholder=ph||t('input_ph_active')}if(chatSend)chatSend.disabled=false;if(chatMic)chatMic.disabled=false}
function disableInput(){if(chatInput){chatInput.disabled=true;chatInput.placeholder=t('input_placeholder')}if(chatSend)chatSend.disabled=true;if(chatMic){chatMic.disabled=true;chatMic.classList.remove('recording')}}
function scr(){chatBody.scrollTop=chatBody.scrollHeight}

translatePage(currentLang);

const MIC_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;


/* ═══════════════════════════════════════════════════════════
   Live API Connection & Callbacks
   ═══════════════════════════════════════════════════════════ */

GeminiVoice.onConnectionReady = () => {
  console.log('[Live] Connected to ADK Live API ✓');
  voiceConnected = true;
  if (chatMic) chatMic.classList.add('connected');
  rmT(); // Remove connecting indicator

  // Immediately tell the agent to stay silent — the frontend handles greeting + BankID
  GeminiVoice.sendText('[SYSTEM — do NOT read this aloud, do NOT speak, do NOT call any tools] You are now connected. Do NOT greet the customer. Do NOT say anything. Do NOT call any tools. The frontend handles the welcome flow and BankID verification. The customer name is Erik — always use Erik. Wait silently until you receive the next user message.');

  // Suppress ALL agent output (text + widgets + audio) during the static welcome flow
  _suppressAgentText = true;
  _suppressWidgets = true;
  GeminiVoice.muteMode = 'drop'; // DROP audio during welcome — don't buffer for replay
  GeminiVoice.muted = true;
  // Safety timeout — clear after 15s in case handleSend doesn't fire
  setTimeout(() => { _suppressAgentText = false; _suppressedTextQueue = []; _suppressWidgets = false; GeminiVoice.muted = false; }, 15000);

  // Always show the static welcome flow first
  showWelcome();
};

GeminiVoice.onConnectionError = (err) => {
  console.error('[Live] Connection error:', err);
  voiceConnected = false;
  enableInput();
};

GeminiVoice.onConnectionClose = () => {
  console.log('[Live] Disconnected');
  voiceConnected = false;
  currentAgentBubble = null;
  agentTextBuffer = '';
  if (chatMic) chatMic.classList.remove('recording', 'connected');
};

// ── Agent text streaming ──────────────────────────────────────
// Suppress flag — AVM loading blocks text until animation finishes
let _suppressAgentText = false;
let _suppressWidgets = false; // Block widget rendering during static welcome flow
let _suppressedTextQueue = [];
let _avmInProgress = false; // Guards suppress state during AVM loading flow
let _avmCooldown = false;    // Prevents early AVM detection re-triggering on post-AVM text
let _waitingForFinancialWidget = false; // Guards suppress state while waiting for financial_overview widget

GeminiVoice.onAgentText = (text, finished) => {
  if (!text || text.trim() === '') return;

  // If suppressed (waiting for widget), buffer silently — keep typing indicator visible
  if (_suppressAgentText) {
    console.log('%c[DEBUG] ⛔ Text SUPPRESSED:', 'color: red; font-weight: bold;', text.substring(0, 60), '| waiting:', _waitingForFinancialWidget, '| avm:', _avmInProgress);
    _suppressedTextQueue.push({ text, finished });
    return;
  }

  // ── Early AVM detection ──
  // The model says "Thanks, let me run the valuation for you." BEFORE the widget
  // arrives (~1s gap). Suppress the TEXT so it doesn't flash, but let the audio
  // play so the user hears the acknowledgment naturally.
  // Skip if AVM in progress or recently completed (cooldown prevents re-trigger
  // on post-AVM text like "the latest automated valuation above").
  if (!_avmInProgress && !_avmCooldown) {
    const check = (agentTextBuffer + text).toLowerCase();
    if (check.includes('valuation') || check.includes('värdering')) {
      console.log('%c[DEBUG] 🏠 EARLY AVM DETECT — suppressing text only (audio plays)', 'color: orange; font-weight: bold;');
      _suppressAgentText = true;
      _suppressedTextQueue = [];
      // NOTE: Do NOT mute audio here — let the model's short acknowledgment be heard
      // Remove the bubble that's already been created
      if (currentAgentBubble) {
        const parentBubble = currentAgentBubble.closest('.chat-bubble');
        if (parentBubble) parentBubble.remove();
        currentAgentBubble = null;
        agentTextBuffer = '';
      }
      return;
    }
  }

  console.log('%c[DEBUG] ✅ Text RENDERING:', 'color: green;', text.substring(0, 60));
  rmT();
  _renderAgentText(text, finished);
};

// Track recent completed agent bubble texts for cross-turn dedup
const _recentAgentTexts = [];

function _renderAgentText(text, finished) {
  if (!currentAgentBubble) {
    // Cross-turn dedup: if this new bubble starts with the same text as a recent bubble, skip it
    const incoming = text.trim();
    if (incoming.length > 20) {
      const incomingStart = incoming.substring(0, 50);
      for (const recent of _recentAgentTexts) {
        if (recent.startsWith(incomingStart) || incomingStart.startsWith(recent.substring(0, 50))) {
          console.log('[Live] Cross-turn dedup: skipping duplicate bubble');
          return;
        }
      }
    }

    const d = document.createElement('div');
    d.className = 'chat-bubble agent';
    d.innerHTML = `<div class="bubble-avatar">${AVA}</div><div class="bubble-wrap"><div class="bubble-label">BANKSY</div><div class="bubble-content"></div><div class="bubble-time">${ts()}</div></div>`;
    chatBody.appendChild(d);
    currentAgentBubble = d.querySelector('.bubble-content');
    agentTextBuffer = '';
    scr();
  }

  if (finished) {
    const finalText = (text.length >= agentTextBuffer.length) ? text : agentTextBuffer;
    const trimmed = finalText.trim();

    // Cross-turn dedup at FINISH: first chunks were too short to catch at creation
    if (trimmed.length > 20) {
      const finalStart = trimmed.substring(0, 50);
      for (const recent of _recentAgentTexts) {
        if (recent.startsWith(finalStart) || finalStart.startsWith(recent.substring(0, 50))) {
          console.log('[Live] Cross-turn dedup (finish): removing duplicate bubble');
          // Remove the entire bubble DOM element
          if (currentAgentBubble) {
            const parentBubble = currentAgentBubble.closest('.chat-bubble');
            if (parentBubble) parentBubble.remove();
          }
          currentAgentBubble = null;
          agentTextBuffer = '';
          return;
        }
      }
    }

    if (currentAgentBubble) {
      currentAgentBubble.textContent = finalText;
      formatAgentBubble(currentAgentBubble);
    }
    // Remember this completed text for cross-turn dedup (keep last 3)
    if (trimmed.length > 20) {
      _recentAgentTexts.push(trimmed);
      if (_recentAgentTexts.length > 3) _recentAgentTexts.shift();
    }
    currentAgentBubble = null;
    agentTextBuffer = '';
  } else {
    // Accumulate: detect accumulated vs delta vs duplicate restart
    if (agentTextBuffer && text.startsWith(agentTextBuffer)) {
      // Accumulated mode: new text is a superset of buffer
      agentTextBuffer = text;
    } else if (agentTextBuffer && agentTextBuffer.startsWith(text.trimStart())) {
      // Duplicate restart: agent resent the beginning — ignore it
      return;
    } else {
      agentTextBuffer += text;
    }
    if (currentAgentBubble) currentAgentBubble.textContent = agentTextBuffer;
    scr();
  }
}

// Format agent bubble text with rich formatting (line breaks, bold)
function formatAgentBubble(el) {
  let html = el.textContent
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); // escape

  // Line break before insight discovery phrases
  html = html.replace(/(\.)\s*(Oh,?\s+I did notice)/gi, '$1<br><br>$2');
  html = html.replace(/(\.)\s*(Oh,?\s+jag noterade)/gi, '$1<br><br>$2');
  html = html.replace(/(\.)\s*(Jag noterade)/gi, '$1<br><br>$2');

  // Bold monetary amounts (e.g. "14,000 kr", "14 000 kr", "2.8 million")
  html = html.replace(/(\d[\d\s,.]*\s*kr)\b/g, '<strong>$1</strong>');
  html = html.replace(/(\d[\d,.]*\s*million\s*(SEK|kr)?)/gi, '<strong>$1</strong>');

  // Bold "Mortgage" / "Bolån" (including when in quotes)
  html = html.replace(/['']Mortgage['']/g, '<strong>Mortgage</strong>');
  html = html.replace(/['']Bolån['']/g, '<strong>Bolån</strong>');
  html = html.replace(/(?<!')(?:&quot;|")Mortgage(?:&quot;|")/g, '<strong>Mortgage</strong>');
  html = html.replace(/(?<!')(?:&quot;|")Bolån(?:&quot;|")/g, '<strong>Bolån</strong>');
  // Also catch unquoted standalone mentions
  html = html.replace(/\bmarked as Mortgage\b/g, 'marked as <strong>Mortgage</strong>');
  html = html.replace(/\bmärkt som Bolån\b/g, 'märkt som <strong>Bolån</strong>');
  html = html.replace(/\bmarked (?:as )?['']?Mortgage['']?/gi, 'marked as <strong>Mortgage</strong>');

  // Green percentage chip (e.g. "3%", "2.9%", "8.7%")
  html = html.replace(/(\d[\d,.]*\s*%)/g, '<span style="display:inline-block;background:rgba(76,175,80,0.13);color:#2e7d32;font-weight:700;padding:1px 7px;border-radius:8px;font-size:0.92em;letter-spacing:0.01em">▲ $1</span>');

  // Only apply if something changed
  if (html !== el.textContent) {
    el.innerHTML = html;
  }
}

// User speech transcript → show as user bubble (dedup to prevent double rendering)
let _lastUserTranscript = '';
let _lastUserTranscriptTime = 0;
GeminiVoice.onUserTranscript = (text) => {
  if (!text || text.trim() === '') return;
  const now = Date.now();
  // Ignore duplicate transcript within 60 seconds (Live API can resend up to ~15s later)
  if (text === _lastUserTranscript && (now - _lastUserTranscriptTime) < 60000) return;
  _lastUserTranscript = text;
  _lastUserTranscriptTime = now;

  // First message after BankID (voice mode)?
  // Suppress text AND audio until financial_overview widget arrives
  if (pendingPrime) {
    console.log('%c[DEBUG] 🎤 VOICE: pendingPrime SET — suppressing text+audio for widget-first', 'color: orange; font-size: 14px; font-weight: bold;');
    _suppressAgentText = true;
    _waitingForFinancialWidget = true;
    _suppressedTextQueue = [];
    GeminiVoice.muteMode = 'buffer'; // BUFFER audio — replay after widget renders
    GeminiVoice.muted = true; // Mute audio — agent shouldn't speak before widget appears
    pendingPrime = ''; // System instruction already has name/language/step context
    // Safety: release after 15s if widget never arrives
    window._financialOverviewSafetyTimer = setTimeout(() => {
      if (_waitingForFinancialWidget) {
        console.log('[Live] Safety: releasing voice suppression (timeout)');
        _suppressAgentText = false;
        _waitingForFinancialWidget = false;
        _suppressedTextQueue = [];
        GeminiVoice.muted = false;
        rmT();
      }
    }, 15000);
  }

  // Clear any stale suppression — user is speaking, agent should respond normally
  if (!_avmInProgress && !_waitingForFinancialWidget) {
    _suppressAgentText = false;
    _suppressedTextQueue = [];
    _suppressWidgets = false;
    GeminiVoice.muted = false;
  }

  addB('user', text);
  addT(); // Show typing indicator while waiting for agent response
};

// Turn complete — finalize bubble, enable input, safety resets
GeminiVoice.onTurnComplete = () => {
  if (currentAgentBubble) {
    const completedText = agentTextBuffer.trim();

    // Cross-turn dedup: if this bubble matches a recent one, remove it
    let isDuplicate = false;
    if (completedText.length > 20) {
      const startChunk = completedText.substring(0, 50);
      for (const recent of _recentAgentTexts) {
        if (recent.startsWith(startChunk) || startChunk.startsWith(recent.substring(0, 50))) {
          console.log('[Live] Cross-turn dedup (turnComplete): removing duplicate bubble');
          const parentBubble = currentAgentBubble.closest('.chat-bubble');
          if (parentBubble) parentBubble.remove();
          isDuplicate = true;
          break;
        }
      }
    }

    if (!isDuplicate) {
      formatAgentBubble(currentAgentBubble);
      // Remember for future dedup
      if (completedText.length > 20) {
        _recentAgentTexts.push(completedText);
        if (_recentAgentTexts.length > 5) _recentAgentTexts.shift();
      }
    }

    currentAgentBubble = null;
    agentTextBuffer = '';
  }
  // Always clear suppress on turn complete (except during welcome, AVM, or financial widget wait)
  if (!_suppressWidgets && !_avmInProgress && !_waitingForFinancialWidget) {
    _suppressAgentText = false;
    _suppressedTextQueue = [];
  }
  rmT();
  enableInput();
};

// Widget received from tool callback — dedup + smart timing
const _renderedWidgets = new Set();

// Widgets that should render IMMEDIATELY (before/alongside agent speech)
const IMMEDIATE_WIDGETS = new Set(['financial_overview', 'bankid', 'bankid_verified', 'avm_valuation']);

GeminiVoice.onWidgetReceived = (payload) => {
  // Block widgets during static welcome flow
  if (_suppressWidgets) {
    console.log('[Live] Widget suppressed during welcome:', payload.widget_type);
    return;
  }
  const key = payload.widget_type + '_' + JSON.stringify(payload).length;
  if (_renderedWidgets.has(key)) return; // Already rendered
  _renderedWidgets.add(key);
  console.log('[Live] Widget:', payload.widget_type);
  rmT();

  if (IMMEDIATE_WIDGETS.has(payload.widget_type)) {
    console.log('[Live] AVM_DEBUG: IMMEDIATE path for', payload.widget_type);
    // Save pre-widget text before removing the bubble (financial_overview needs it)
    let _savedPreWidgetText = '';
    if (currentAgentBubble) {
      _savedPreWidgetText = agentTextBuffer || '';
      const parentBubble = currentAgentBubble.closest('.chat-bubble');
      if (parentBubble) {
        if (payload.widget_type === 'financial_overview' || agentTextBuffer.trim().length < 80) {
          parentBubble.remove();
        }
      }
      currentAgentBubble = null;
      agentTextBuffer = '';
    }
    // Attach saved text so renderWidget can use it
    payload._savedPreWidgetText = _savedPreWidgetText;
    renderWidget(payload);
  } else {
    // Queue — wait for agent text to finish first (AVM, rates, etc.)
    queueWidgetRender(payload);
  }
};

async function queueWidgetRender(payload) {
  // Wait for any active agent text bubble to finish streaming
  let waitCount = 0;
  while (currentAgentBubble && waitCount < 30) {
    await avmDelay(200);
    waitCount++;
  }
  // Brief pause so the user can absorb the text before the widget pops in
  if (waitCount > 0) await avmDelay(400);
  renderWidget(payload);
}


/* ═══════════════════════════════════════════════════════════
   Widget Dispatcher — routes tool payloads to render functions
   ═══════════════════════════════════════════════════════════ */

function renderWidget(payload) {
  const type = payload.widget_type;
  switch (type) {
    case 'bankid':
      addBankID();
      break;
    case 'bankid_verified':
      // BankID transitions to verified state (handled inside addBankID timeout)
      break;
    case 'financial_overview':
      console.log('%c[DEBUG] 🏦 financial_overview WIDGET received! Rendering widget FIRST', 'color: cyan; font-size: 14px; font-weight: bold;');
      // Clear safety timeout
      if (window._financialOverviewSafetyTimer) {
        clearTimeout(window._financialOverviewSafetyTimer);
        window._financialOverviewSafetyTimer = null;
      }
      // Remove ANY agent bubbles that leaked through before suppression
      if (currentAgentBubble) {
        const parentBubble = currentAgentBubble.closest('.chat-bubble');
        if (parentBubble) parentBubble.remove();
        currentAgentBubble = null;
        agentTextBuffer = '';
      }
      // Remove all pre-widget agent bubbles (empty or financial-keyword ones)
      {
        const allAgentBubbles = chatBody.querySelectorAll('.chat-bubble.agent');
        for (let i = allAgentBubbles.length - 1; i >= 0; i--) {
          const bub = allAgentBubbles[i];
          const txt = bub.querySelector('.bubble-content')?.textContent || '';
          if (txt.trim().length === 0 ||
              txt.includes('financial overview') || txt.includes('investments') ||
              txt.includes('finansiell') || txt.includes('investeringar') ||
              txt.includes('Mortgage') || txt.includes('Bolån') ||
              txt.includes('Here is') || txt.includes('Här är')) {
            bub.remove();
          }
        }
      }
      // Render widget + quick actions FIRST
      addFinancialOverview();
      addQuickActions();
      scr();
      // NOW release suppression — text+audio streams into new bubble BELOW widget
      _suppressAgentText = false;
      _waitingForFinancialWidget = false;
      _suppressedTextQueue = [];
      GeminiVoice.muted = false; // Unmute — agent can now speak the commentary
      // Brief typing indicator while agent prepares commentary
      addT();
      setTimeout(() => { rmT(); scr(); }, 1500);
      break;
    case 'proactive_insight':
      // Insight is now delivered as conversational text, not a widget.
      // If the tool is called anyway, just ignore the widget render.
      console.log('[Live] proactive_insight — skipped (text-only)');
      break;
    case 'avm_valuation':
      console.log('[Live] AVM_DEBUG: widget dispatched to runAVMThenShow, currentBubble:', !!currentAgentBubble, 'suppress:', _suppressAgentText);
      runAVMThenShow(payload);
      break;
    case 'rate_comparison':
      showRateComparison(payload);
      break;
    case 'loan_offer':
      renderOfferCard(payload);
      break;
    case 'addons':
      renderAddons();
      break;
    default:
      console.warn('[Live] Unknown widget_type:', type);
  }
  scr();
  // Delayed scroll to ensure widget is fully rendered
  setTimeout(() => scr(), 300);
}


/* ═══════════════════════════════════════════════════════════
   Welcome Flow — fully static through BankID verification
   Then hands off to Live API agent
   ═══════════════════════════════════════════════════════════ */

async function showWelcome() {
  await sl(800);
  addB('agent', t('welcome_hello'));
  await sl(500);
  addQR([
    { label: t('welcome_login'), value: 'login', primary: true },
    { label: t('welcome_explore'), value: 'explore' },
  ]);
}

function addQR(options, onSelect) {
  const container = document.createElement('div');
  container.className = 'qr-container';
  container.innerHTML = options.map((o, i) => `
    <button class="qr-btn${o.primary ? ' primary' : ''}" data-value="${o.value}" style="--qr-i:${i}">
      ${o.label}
    </button>
  `).join('');
  chatBody.appendChild(container);
  scr();

  container.querySelectorAll('.qr-btn').forEach(btn => {
    btn.onclick = () => {
      // Disable all buttons
      container.querySelectorAll('.qr-btn').forEach(b => { b.disabled = true; b.style.opacity = '0.5'; });
      btn.style.opacity = '1';
      btn.classList.add('selected');

      const value = btn.dataset.value;
      const label = btn.textContent.trim();
      addB('user', label);

      if (value === 'login') {
        runStaticBankIDFlow();
      } else {
        // For "explore" — just let the agent handle it
        if (voiceConnected) {
          addT();
          const langHint = currentLang === 'sv' ? 'Respond in Swedish.' : 'Respond in English.';
          GeminiVoice.sendText(`${langHint} I am not a customer yet. Tell me more about what you offer.`);
        }
        enableInput();
      }
    };
  });
}

async function runStaticBankIDFlow() {
  // Step 1: Pause briefly, then show BankID widget
  await sl(800);
  addBankID();

  // Step 2: Wait for auto-verification (2.5s built into addBankID) + extra pause
  await sl(4000);

  // Step 3: Show personalized welcome
  const welcomeMsg = currentLang === 'sv'
    ? 'Välkommen tillbaka, <strong>Erik</strong>! Vad kan jag hjälpa dig med idag?'
    : 'Welcome back, <strong>Erik</strong>! What can I help you with today?';
  addB('agent', welcomeMsg);
  enableInput();

  // Step 4: Store context to prepend on user's first message (avoids "Understood" response)
  const langInstruction = currentLang === 'sv'
    ? 'Du MÅSTE svara på SVENSKA i resten av konversationen.'
    : 'You MUST respond in ENGLISH for the rest of the conversation.';
  pendingPrime = `[SYSTEM CONTEXT — do NOT read this aloud] ${langInstruction} The customer Erik Wallström (personnummer 199003XX-XXXX) has verified identity via BankID. The customer's name is Erik — ALWAYS use Erik, never any other name. Step 1 (welcome + BankID) is already done. Continue from Step 2 onward when the user asks.`;

  // If hero bar had a message, send it now with the prime
  if (heroInitialMsg) {
    addB('user', heroInitialMsg);
    handleSend(heroInitialMsg);
    heroInitialMsg = '';
  }
}


/* ═══════════════════════════════════════════════════════════
   Text Input — sends to Live API
   ═══════════════════════════════════════════════════════════ */

function handleSend(textOverride){
  const text = textOverride || chatInput.value.trim();
  if(!text)return;
  chatInput.value='';
  if (!textOverride) addB('user', text);

  // Clear welcome flow suppression — real conversation starts now
  _suppressAgentText = false;
  _suppressedTextQueue = [];
  _suppressWidgets = false;
  GeminiVoice.muted = false;

  if (voiceConnected) {
    // Finalize current agent bubble if streaming — record for dedup before clearing
    if (currentAgentBubble) {
      const completedText = agentTextBuffer.trim();
      if (completedText.length > 20) {
        _recentAgentTexts.push(completedText);
        if (_recentAgentTexts.length > 5) _recentAgentTexts.shift();
      }
      formatAgentBubble(currentAgentBubble);
      currentAgentBubble = null;
      agentTextBuffer = '';
    }
    addT(); // Show typing indicator

    // Prepend stored context from BankID flow on first message
    let msgToSend = text;
    if (pendingPrime) {
      console.log('%c[DEBUG] 🚨 handleSend: pendingPrime SET — activating suppression', 'color: orange; font-size: 14px; font-weight: bold;');
      // Pre-suppress ALL agent text — financial_overview widget is coming
      // Text must NOT appear until the widget has rendered
      _suppressAgentText = true;
      _waitingForFinancialWidget = true;
      _suppressedTextQueue = [];
      // Safety: release suppression after 12s even if widget never arrives
      window._financialOverviewSafetyTimer = setTimeout(() => {
        if (_waitingForFinancialWidget) {
          console.log('[Live] Safety: releasing financial_overview suppression (timeout)');
          _suppressAgentText = false;
          _waitingForFinancialWidget = false;
          _suppressedTextQueue = [];
          rmT();
        }
      }, 12000);
      msgToSend = `${pendingPrime} The user says: "${text}"`;
      pendingPrime = '';
    }
    GeminiVoice.sendText(msgToSend);
  } else {
    console.warn('[Send] Not connected to Live API');
  }
}

if(chatInput)chatInput.onkeydown=e=>{if(e.key==='Enter')handleSend()};
if(chatSend)chatSend.onclick=()=>handleSend();


/* ═══════════════════════════════════════════════════════════
   Mic Button — toggles voice recording
   ═══════════════════════════════════════════════════════════ */

if (chatMic) {
  chatMic.onclick = async () => {
    if (!voiceConnected) return;

    if (GeminiVoice.isListening) {
      GeminiVoice.stopListening();
      chatMic.classList.remove('recording');
      chatMic.innerHTML = MIC_ICON;
    } else {
      try {
        await GeminiVoice.startListening();
        chatMic.classList.add('recording');
        chatMic.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`;
        // Finalize current agent bubble
        if (currentAgentBubble) {
          currentAgentBubble = null;
          agentTextBuffer = '';
        }
      } catch (err) {
        console.error('[Mic] Failed:', err);
      }
    }
  };
}


/* ═══════════════════════════════════════════════════════════
   Connect & Start — auto-connects to ADK Live API
   ═══════════════════════════════════════════════════════════ */

async function connectAndStart() {
  addT(); // Show typing indicator while connecting
  disableInput();

  // Fresh session each time (avoids stale history / wrong language)
  const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

  try {
    await GeminiVoice.connect(sessionId);
    // Connection ready callback handles the rest
  } catch (err) {
    console.error('[Live] Failed to connect:', err);
    rmT();
    addB('agent', currentLang === 'sv'
      ? 'Anslutningen misslyckades. Ladda om sidan och försök igen.'
      : 'Connection failed. Please reload the page and try again.');
    enableInput();
  }
}


/* ═══════════════════════════════════════════════════════════
   Debug Logger
   ═══════════════════════════════════════════════════════════ */
window._ttsLog = [];
const _debugEnabled = location.search.includes('debug');
if (_debugEnabled) {
  (function() {
    const _origLog = console.log, _origWarn = console.warn, _origErr = console.error;
    function capture(level, args) {
      const msg = Array.from(args).map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      if (msg.includes('[Live]') || msg.includes('[Voice]') || msg.includes('[GeminiVoice]')) {
        const entry = new Date().toISOString() + ' [' + level + '] ' + msg;
        window._ttsLog.push(entry);
        try { localStorage.setItem('live_debug_log', JSON.stringify(window._ttsLog)); } catch(e) {}
      }
    }
    console.log = function() { capture('LOG', arguments); _origLog.apply(console, arguments); };
    console.warn = function() { capture('WARN', arguments); _origWarn.apply(console, arguments); };
    console.error = function() { capture('ERR', arguments); _origErr.apply(console, arguments); };
  })();
}
document.addEventListener('keydown', function(e) {
  if (e.ctrlKey && e.shiftKey && e.key === 'L') {
    var logText = window._ttsLog.join('\n');
    navigator.clipboard.writeText(logText).then(function() { alert('Logs copied! (' + window._ttsLog.length + ' entries)'); });
  }
});


/* ═══════════════════════════════════════════════════════════
   SVG Icons & Chat Bubble Helpers
   ═══════════════════════════════════════════════════════════ */

const AVA=`<svg viewBox="0 0 24 24" fill="none"><path d="M3 21V7L12 2L21 7V21H15V14H9V21H3Z" stroke="white" stroke-width="2.5"/></svg>`;
const IC={
  shield:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L3 7v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V7l-9-5z"/></svg>`,
  check:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>`,
  chart:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 20h18M6 16v4M10 12v8M14 8v12M18 4v16"/></svg>`,
  doc:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>`,
  house:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12l9-9 9 9"/><path d="M5 10v10a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1V10"/></svg>`,
  tag:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1" fill="currentColor"/></svg>`,
  bank:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/></svg>`,
  pin:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
};


/* ═══════════════════════════════════════════════════════════
   Chat UI Components
   ═══════════════════════════════════════════════════════════ */

function addB(t_bubble,h){
  const d=document.createElement('div');
  d.className=`chat-bubble ${t_bubble}`;
  if(t_bubble==='agent'){
    d.innerHTML=`<div class="bubble-avatar">${AVA}</div><div class="bubble-wrap"><div class="bubble-label">BANKSY</div><div class="bubble-content">${h}</div><div class="bubble-time">${ts()}</div></div>`;
  } else {
    d.innerHTML=`<div class="bubble-label">${t('user_label')}</div><div class="bubble-content">${h}</div><div class="bubble-time" style="text-align:right">${ts()}</div>`}
  chatBody.appendChild(d);
  scr();
}

function addBHighlight(h){
  const d=document.createElement('div');
  d.className='chat-bubble agent highlight';
  d.innerHTML=`<div class="bubble-avatar">${AVA}</div><div class="bubble-wrap"><div class="bubble-label">BANKSY</div><div class="bubble-content">${h}</div><div class="bubble-time">${ts()}</div></div>`;
  chatBody.appendChild(d);
  scr();
}

function addT(){const d=document.createElement('div');d.className='chat-bubble agent';d.id='tB';d.innerHTML=`<div class="bubble-avatar">${AVA}</div><div class="bubble-wrap"><div class="bubble-label">BANKSY</div><div class="bubble-content"><div class="typing-dots"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div></div>`;chatBody.appendChild(d);scr()}
function rmT(){const t=$('#tB');if(t)t.remove()}

function addW(ic,svg,title,rows,hl='',hero=''){
  const d=document.createElement('div');
  d.className='widget-card';
  const hc=ic==='green'?'h-green':ic==='blue'?'h-blue':ic==='orange'?'h-orange':'h-dark';
  let b='';
  if(hero)b+=hero;
  b+=rows.map(r=>{
    let c='widget-row';
    if(r.e)c+=' emphasized';
    if(r.e==='green')c+=' emphasized green-bg';
    return`<div class="${c}"><span class="widget-row-label">${r.l}</span><span class="widget-row-value ${r.c||''}">${r.v}</span></div>`
  }).join('');
  if(hl)b+=`<div class="widget-highlight">${hl}</div>`;
  d.innerHTML=`<div class="widget-header ${hc}"><span class="widget-icon ${ic}">${svg}</span>${title}</div><div class="widget-body">${b}</div>`;
  chatBody.appendChild(d);
  scr();
}


/* ═══════════════════════════════════════════════════════════
   BankID Widget
   ═══════════════════════════════════════════════════════════ */

function addBankID() {
  const d = document.createElement('div');
  d.className = 'bankid-inline';
  d.innerHTML = `
    <div class="bankid-inline-body" id="bankid-inline-body">
      <div class="bankid-inline-qr">
        <img src="bankid_qr.png" class="bankid-qr-img" alt="BankID QR">
      </div>
      <div class="bankid-inline-info">
        <img src="bankid_logo.png" class="bankid-inline-logo" alt="BankID">
        <div class="bankid-inline-status">
          <div class="bankid-spinner-sm"></div>
          <span>${t('bankid_verifying')}</span>
        </div>
      </div>
    </div>`;
  chatBody.appendChild(d);
  scr();

  // Auto-verify after 2.5s (simulates BankID scan)
  setTimeout(() => {
    const body = document.getElementById('bankid-inline-body');
    if (body) {
      d.classList.add('verified');
      body.innerHTML = `
        <div class="bankid-inline-check">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="white" stroke-width="2.5"><path d="M9 12l2 2 4-4"/></svg>
        </div>
        <div class="bankid-inline-info">
          <div class="bankid-inline-name">${t('bankid_verified_name')}</div>
          <div class="bankid-inline-ssn">${t('bankid_verified_ssn')}</div>
        </div>`;
    }
  }, 2500);
}


/* ═══════════════════════════════════════════════════════════
   Financial Overview Widget (accounts + investments chart)
   ═══════════════════════════════════════════════════════════ */

function addFinancialOverview() {
  const d = document.createElement('div');
  d.className = 'widget-card';
  const chartId = 'inv-chart-' + Date.now();
  d.innerHTML = `
    <div class="widget-header h-blue">
      <span class="widget-icon blue">${IC.bank}</span>
      <span>${t('account_overview_title')}</span>
    </div>
    <div class="widget-body" style="padding:0">
      <div class="fin-section">
        <div class="fin-row">
          <div class="fin-row-left">
            <div class="fin-row-dot" style="background:var(--sb-blue,#4A90D9)"></div>
            <span class="fin-row-label">${t('account_checking')}</span>
          </div>
          <span class="fin-row-value">${t('account_checking_balance')}</span>
        </div>
        <div class="fin-row">
          <div class="fin-row-left">
            <div class="fin-row-dot" style="background:#6C5CE7"></div>
            <span class="fin-row-label">${t('account_savings')}</span>
          </div>
          <span class="fin-row-value">${t('account_savings_balance')}</span>
        </div>
      </div>
      <div class="fin-divider"></div>
      <div class="fin-chart-section">
        <div class="fin-chart-header">
          <div class="fin-chart-meta">
            <span class="fin-chart-value" id="${chartId}-value">${t('investment_isk_value')}</span>
            <span class="fin-chart-change green" id="${chartId}-change">${t('investment_isk_change')}</span>
          </div>
          <span class="fin-chart-subtitle">${t('investment_title')}</span>
        </div>
        <canvas id="${chartId}" width="400" height="130" style="width:100%;height:130px"></canvas>
        <div class="fin-chart-periods" id="${chartId}-periods">
          <button class="fin-period-btn active" data-period="1m">1M</button>
          <button class="fin-period-btn" data-period="3m">3M</button>
          <button class="fin-period-btn" data-period="ytd">YTD</button>
          <button class="fin-period-btn" data-period="1y">1Y</button>
          <button class="fin-period-btn" data-period="all">ALL</button>
        </div>
        <div class="fin-chart-funds">
          <div class="fin-chart-fund">
            <div class="fin-row-dot" style="background:var(--sb-green,#4CAF50)"></div>
            <span class="fin-chart-fund-name">${t('investment_fund')}</span>
            <span class="fin-chart-fund-val" id="${chartId}-f1-val">${t('investment_fund_value')}</span>
            <span class="fin-row-change green" id="${chartId}-f1-chg">${t('investment_fund_change')}</span>
          </div>
          <div class="fin-chart-fund">
            <div class="fin-row-dot" style="background:var(--sb-blue,#1558b0)"></div>
            <span class="fin-chart-fund-name">${t('investment_fund2')}</span>
            <span class="fin-chart-fund-val" id="${chartId}-f2-val">${t('investment_fund2_value')}</span>
            <span class="fin-row-change green" id="${chartId}-f2-chg">${t('investment_fund2_change')}</span>
          </div>
          <div class="fin-chart-fund">
            <div class="fin-row-dot" style="background:#6C5CE7"></div>
            <span class="fin-chart-fund-name">${t('investment_fund3')}</span>
            <span class="fin-chart-fund-val" id="${chartId}-f3-val">${t('investment_fund3_value')}</span>
            <span class="fin-row-change green" id="${chartId}-f3-chg">${t('investment_fund3_change')}</span>
          </div>
        </div>
      </div>
    </div>`;
  chatBody.appendChild(d);
  scr();

  // Chart data per period
  const chartData = {
    '1m':  [138,137,139,140,138,139,141,140,141,140,141,142,141,142,141,142,141,142,143,142,142,143,142,143,142,143,142,143,142,142],
    '3m':  [132,131,133,135,134,136,135,137,136,138,137,136,138,139,138,137,139,140,138,139,141,140,141,140,141,142,141,142,143,142],
    'ytd': [118,120,119,122,125,123,126,124,128,127,130,129,131,128,130,133,132,134,131,133,136,135,137,134,136,138,137,139,140,142],
    '1y':  [105,108,106,110,112,109,114,112,116,118,115,119,117,120,118,122,120,124,122,126,128,125,130,128,132,134,131,136,138,142],
    'all': [80,82,85,83,88,90,87,92,95,93,98,96,100,103,101,105,108,106,110,114,112,118,116,122,125,128,132,136,138,142]
  };
  const periodStats = {
    '1m':  { value: '142 800 kr', change: '+2,9%', f1v: '89 400 kr', f1c: '+1,8%', f2v: '34 200 kr', f2c: '+0,6%', f3v: '19 200 kr', f3c: '+3,1%' },
    '3m':  { value: '142 800 kr', change: '+8,2%', f1v: '89 400 kr', f1c: '+6,5%', f2v: '34 200 kr', f2c: '+3,2%', f3v: '19 200 kr', f3c: '+7,4%' },
    'ytd': { value: '142 800 kr', change: '+8,7%', f1v: '89 400 kr', f1c: '+12,4%', f2v: '34 200 kr', f2c: '+5,1%', f3v: '19 200 kr', f3c: '+9,8%' },
    '1y':  { value: '142 800 kr', change: '+12,4%', f1v: '89 400 kr', f1c: '+15,2%', f2v: '34 200 kr', f2c: '+7,8%', f3v: '19 200 kr', f3c: '+14,1%' },
    'all': { value: '142 800 kr', change: '+78,5%', f1v: '89 400 kr', f1c: '+62,3%', f2v: '34 200 kr', f2c: '+41,5%', f3v: '19 200 kr', f3c: '+89,7%' },
  };

  function drawChart(period) {
    const canvas = document.getElementById(chartId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = 120 * dpr;
    ctx.scale(dpr, dpr);
    const w = canvas.offsetWidth, h = 120;
    const pts = chartData[period] || chartData['ytd'];
    const min = Math.min(...pts) - 2, max = Math.max(...pts) + 2;
    const xStep = w / (pts.length - 1);
    ctx.clearRect(0, 0, w, h);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(76,175,80,0.15)');
    grad.addColorStop(1, 'rgba(76,175,80,0)');
    ctx.beginPath(); ctx.moveTo(0, h);
    pts.forEach((v, i) => ctx.lineTo(i * xStep, h - ((v - min) / (max - min)) * (h - 16)));
    ctx.lineTo(w, h); ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
    ctx.beginPath();
    pts.forEach((v, i) => { const x = i * xStep, y = h - ((v - min) / (max - min)) * (h - 16); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
    ctx.strokeStyle = '#4CAF50'; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
    const lastX = (pts.length - 1) * xStep, lastY = h - ((pts[pts.length - 1] - min) / (max - min)) * (h - 16);
    ctx.beginPath(); ctx.arc(lastX, lastY, 3.5, 0, Math.PI * 2); ctx.fillStyle = '#4CAF50'; ctx.fill();
    ctx.beginPath(); ctx.arc(lastX, lastY, 6, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(76,175,80,0.3)'; ctx.lineWidth = 2; ctx.stroke();
  }

  const periodsEl = document.getElementById(`${chartId}-periods`);
  if (periodsEl) {
    periodsEl.querySelectorAll('.fin-period-btn').forEach(btn => {
      btn.onclick = () => {
        periodsEl.querySelectorAll('.fin-period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const period = btn.dataset.period;
        drawChart(period);
        const stats = periodStats[period];
        if (stats) {
          const valEl = document.getElementById(`${chartId}-value`);
          const chgEl = document.getElementById(`${chartId}-change`);
          if (valEl) valEl.textContent = stats.value;
          if (chgEl) chgEl.textContent = stats.change;
          [['f1-val','f1-chg','f1v','f1c'],['f2-val','f2-chg','f2v','f2c'],['f3-val','f3-chg','f3v','f3c']].forEach(([vId, cId, vKey, cKey]) => {
            const v = document.getElementById(`${chartId}-${vId}`), c = document.getElementById(`${chartId}-${cId}`);
            if (v) v.textContent = stats[vKey];
            if (c) c.textContent = stats[cKey];
          });
        }
      };
    });
  }
  setTimeout(() => drawChart('1m'), 50);
}

function addQuickActions() {
  const actions = [
    { label: currentLang === 'sv' ? 'Betala' : 'Pay', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>', color: 'var(--sb-accent,#d45800)' },
    { label: currentLang === 'sv' ? 'Överföring' : 'Transfer', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17l-4-4 4-4"/><path d="M3 13h13M17 7l4 4-4 4"/><path d="M21 11H8"/></svg>', color: 'var(--sb-blue,#1558b0)' },
    { label: currentLang === 'sv' ? 'Kort' : 'Card', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>', color: 'var(--sb-green,#0d7a38)' },
    { label: currentLang === 'sv' ? 'Sparande' : 'Savings', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16"/><path d="M3 21h18"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>', color: '#6C5CE7' },
  ];
  const d = document.createElement('div');
  d.className = 'action-grid';
  d.innerHTML = actions.map((a, i) => `
    <button class="action-btn" style="--action-color:${a.color};--action-i:${i}">
      <div class="action-icon">${a.icon}</div>
      <span class="action-label">${a.label}</span>
    </button>
  `).join('');
  chatBody.appendChild(d);
  scr();
}


/* ═══════════════════════════════════════════════════════════
   Proactive Insight Widget (from tool payload)
   ═══════════════════════════════════════════════════════════ */

function addProactiveInsightFromPayload(payload) {
  const savings = (payload.annual_savings || 0).toLocaleString('sv-SE');
  const oldRate = payload.current_rate || 4.29;
  const newRate = payload.our_rate || 3.89;
  const bank = payload.current_bank || 'Swedbank';

  let insightText = t('insight_text')
    .replace('AMOUNT', savings)
    .replace('BANK', bank)
    .replace('OLDRATE', oldRate.toFixed(2).replace('.', ','))
    .replace('NEWRATE', newRate.toFixed(2).replace('.', ','));

  const yesLabel = t('insight_yes');
  const noLabel = t('insight_no');

  const d = document.createElement('div');
  d.className = 'proactive-insight';
  d.innerHTML = `<div class="proactive-insight-body"><div class="proactive-insight-icon">💡</div><div class="proactive-insight-content"><div class="proactive-insight-title">${t('insight_title')}</div><div class="proactive-insight-text">${insightText}</div><div class="proactive-insight-actions"><button class="proactive-btn primary" data-val="y">${yesLabel}</button><button class="proactive-btn" data-val="n">${noLabel}</button></div></div></div>`;
  chatBody.appendChild(d);
  scr();

  d.querySelectorAll('.proactive-btn').forEach(btn => {
    btn.onclick = () => {
      d.querySelectorAll('.proactive-btn').forEach(b => { b.disabled = true; b.style.opacity = '0.5'; });
      btn.style.opacity = '1';
      const userText = btn.textContent;
      addB('user', userText);
      // Send the response to the agent
      if (voiceConnected) {
        addT();
        GeminiVoice.sendText(userText);
      }
    };
  });
}


/* ═══════════════════════════════════════════════════════════
   AVM Loading Animation + Result
   ═══════════════════════════════════════════════════════════ */

function avmDelay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runAVMThenShow(payload) {
  const addr = payload.address || 'Unknown';
  const area = addr.includes(',') ? addr.split(',')[0].split(/\s+/).pop() : addr;
  const value = (payload.estimated_value_sek || 0).toLocaleString('sv-SE');
  const sqm = payload.living_area_sqm || 0;
  const rooms = payload.rooms || 0;

  console.log('[Live] AVM_DEBUG: Phase 1 start — suppressing all text');
  _avmInProgress = true;
  _suppressAgentText = true;
  _suppressedTextQueue = [];
  // NOTE: Do NOT mute audio here. The model's short acknowledgment
  // ("Thanks, let me run the valuation for you") audio chunks arrive
  // 200-800ms after the text. Muting would kill them before they play.
  // The model has already finished its turn, so no unwanted audio follows.

  // Kill any in-progress agent bubble (the model might have started speaking)
  if (currentAgentBubble) {
    const parentBubble = currentAgentBubble.closest('.chat-bubble');
    if (parentBubble) parentBubble.remove();
    currentAgentBubble = null;
    agentTextBuffer = '';
  }

  // Also remove the last completed agent bubble — the model often generates
  // pre-AVM text ("Thanks, let me run the valuation...") that leaks before
  // the widget arrives. Remove it since we show our own static announcement.
  const allBubbles = chatBody.querySelectorAll('.chat-bubble.agent');
  if (allBubbles.length > 0) {
    const lastBubble = allBubbles[allBubbles.length - 1];
    const bubbleText = lastBubble.querySelector('.bubble-content')?.textContent || '';
    // Only remove if it's short recent text (not the welcome/overview messages)
    if (bubbleText.length < 300) {
      lastBubble.remove();
    }
  }

  // ── Phase 2: Show announcement as static bubble (no sendText — mic blocks it) ──
  const announcement = currentLang === 'sv'
    ? `Tack för adressen. Jag kör nu en automatisk fastighetsvärdering för ${addr}. Ett ögonblick.`
    : `Thanks for the address. I will now run an automated property valuation for ${addr}. One moment.`;

  console.log('[Live] AVM_DEBUG: Phase 2 — rendering static announcement bubble');
  _suppressAgentText = true; // Keep suppressed — we handle everything
  addB('agent', announcement);
  scr();

  // Brief pause before loading animation starts
  await avmDelay(2000);

  // Re-suppress for loading phase
  _suppressAgentText = true;
  _suppressedTextQueue = [];
  currentAgentBubble = null;
  agentTextBuffer = '';

  console.log('[Live] AVM_DEBUG: Phase 3 — starting loading animation');
  const steps = currentLang === 'sv'
    ? [
        'Ansluter till Lantmäteriet...',
        `Hämtar fastighetsdata för ${area}...`,
        'Analyserar jämförbara försäljningar (12 mån)...',
        'Hämtar Booli prisstatistik...',
        'Beräknar marknadsvärde...',
      ]
    : [
        'Connecting to Lantmäteriet...',
        `Retrieving property data for ${area}...`,
        'Analyzing comparable sales (12 months)...',
        'Fetching Booli price statistics...',
        'Calculating market value...',
      ];

  const d = document.createElement('div');
  d.className = 'avm-card';
  d.innerHTML = `
    <div class="avm-card-header">
      <div class="avm-pulse-ring"></div>
      <span>${currentLang === 'sv' ? 'Automatisk Fastighetsvärdering' : 'Automated Property Valuation'}</span>
    </div>
    <div class="avm-steps" id="avm-steps"></div>
    <div class="avm-progress-bar"><div class="avm-progress-fill" id="avm-progress-fill"></div></div>`;
  chatBody.appendChild(d);
  scr();

  const stepsEl = document.getElementById('avm-steps');
  const progressFill = document.getElementById('avm-progress-fill');

  for (let i = 0; i < steps.length; i++) {
    const text = steps[i];
    const stepEl = document.createElement('div');
    stepEl.className = 'avm-step';
    stepEl.innerHTML = `<span class="avm-step-text">${text}</span><div class="avm-step-spinner"></div>`;
    stepsEl.appendChild(stepEl);
    scr();
    await avmDelay(900 + Math.random() * 600);
    stepEl.querySelector('.avm-step-spinner').innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--sb-green,#4CAF50)" stroke-width="2.5"><path d="M9 12l2 2 4-4"/></svg>';
    stepEl.classList.add('done');
    if (progressFill) progressFill.style.width = `${((i + 1) / steps.length) * 100}%`;
  }

  // Hold the completed state
  await avmDelay(1000);
  d.remove();

  console.log('[Live] AVM_DEBUG: Phase 4 — rendering AVM result card');
  renderAVMResult(payload);
  scr();
  await avmDelay(800);

  // ── Phase 5: Release suppression and discard all buffered text ──
  // We don't want any of the model's AVM text — we handle it ourselves
  _avmInProgress = false;
  _suppressAgentText = false;
  _suppressedTextQueue = [];
  currentAgentBubble = null;
  agentTextBuffer = '';
  // Unmute audio for the result commentary
  GeminiVoice.muted = false;
  // Set cooldown to prevent early AVM detection re-triggering on post-AVM text
  _avmCooldown = true;
  setTimeout(() => { _avmCooldown = false; }, 15000);

  console.log('[Live] AVM_DEBUG: Phase 5 — releasing suppression');
  const resultPrompt = currentLang === 'sv'
    ? `[SYSTEM — säg INTE detta högt] Den automatiska fastighetsvärderingen är klar. Resultat: uppskattat marknadsvärde ${value} kr för ${addr} (${sqm} m², ${rooms} rum). Säg ungefär: "Du kan se den senaste automatiska värderingen ovan. Stämmer detta överens med vad du hade förväntat dig, eller har du något nyare värderingsunderlag du vill ladda upp?"`
    : `[SYSTEM — do NOT read this aloud] The automated property valuation is complete. Result: estimated market value ${value} kr for ${addr} (${sqm} sqm, ${rooms} rooms). Say something like: "You can see the latest automated valuation above. Does this look in line with what you would expect, or do you have any more recent valuation documents you would like to upload?"`;

  if (voiceConnected) {
    addT();
    // Mic is already stopped (from onUserTranscript). sendText works fine without mic.
    // onTurnComplete will restart the mic after the agent responds.
    GeminiVoice.sendText(resultPrompt);
  }

  scr();
  setTimeout(() => scr(), 300);
}

// Inject AVM CSS
(function injectAVMStyles() {
  const s = document.createElement('style');
  s.textContent = `
.avm-card {
  max-width: 440px; width: 100%; margin: 12px auto;
  background: rgba(255,255,255,0.95); backdrop-filter: blur(12px);
  border: 1px solid rgba(0,0,0,0.06); border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 4px 24px rgba(0,0,0,.06), 0 1px 4px rgba(0,0,0,.03);
  animation: bubIn 0.4s ease forwards;
}
.avm-card-header {
  display: flex; align-items: center; gap: 12px;
  padding: 16px 20px;
  background: linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%);
  font-size: 14px; font-weight: 700; color: var(--sb-gray-900, #303035);
}
.avm-pulse-ring {
  width: 12px; height: 12px; border-radius: 50%;
  background: var(--sb-blue, #1558b0);
  box-shadow: 0 0 0 0 rgba(21,88,176,0.4);
  animation: avmPulse 1.5s ease-in-out infinite;
}
@keyframes avmPulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(21,88,176,0.4); }
  50% { box-shadow: 0 0 0 8px rgba(21,88,176,0); }
}
.avm-steps { padding: 12px 20px 8px; }
.avm-step {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 0; font-size: 13px; color: var(--sb-gray-500, #8a8f98);
  opacity: 0; animation: avmStepIn 0.3s ease forwards;
}
.avm-step.done { color: var(--sb-gray-700, #555); }
@keyframes avmStepIn { from { opacity:0; transform: translateX(-8px); } to { opacity:1; transform: translateX(0); } }
.avm-step-text { flex: 1; font-weight: 500; }
.avm-step-spinner {
  width: 16px; height: 16px; flex-shrink: 0;
  border: 2px solid rgba(0,0,0,0.08); border-top-color: var(--sb-blue, #1558b0);
  border-radius: 50%; animation: avm-spin 0.8s linear infinite;
}
.avm-step.done .avm-step-spinner { border: none; animation: none; }
@keyframes avm-spin { to { transform: rotate(360deg); } }
.avm-progress-bar {
  height: 3px; background: rgba(0,0,0,0.04); margin: 0 20px 16px;
  border-radius: 2px; overflow: hidden;
}
.avm-progress-fill {
  height: 100%; width: 0; border-radius: 2px;
  background: linear-gradient(90deg, var(--sb-blue, #1558b0), var(--sb-green, #4CAF50));
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}`;
  document.head.appendChild(s);
})();


/* ═══════════════════════════════════════════════════════════
   AVM Valuation Result (from tool payload)
   ═══════════════════════════════════════════════════════════ */

function renderAVMResult(payload) {
  const rawValue = payload.estimated_value_sek || 0;
  const lowValue = Math.round(rawValue * 0.95);
  const highValue = Math.round(rawValue * 1.05);
  const lowStr = lowValue.toLocaleString('sv-SE');
  const highStr = highValue.toLocaleString('sv-SE');
  const addr = payload.address || 'Unknown';
  const sqm = payload.living_area_sqm || 0;
  const fee = (payload.monthly_fee_sek || 0).toLocaleString('sv-SE');

  const titleLabel = currentLang === 'sv' ? 'Automatisk Värdering (AVM)' : 'Automated Valuation (AVM)';
  const areaInfoLabel = currentLang === 'sv' ? 'Område' : 'Area';
  const areaInfoValue = currentLang === 'sv' ? 'Kungsholmen, Stockholm' : 'Kungsholmen, Stockholm';
  const avgSizeLabel = currentLang === 'sv' ? 'Snitt boendeyta' : 'Avg. living area';
  const avgFeeLabel = currentLang === 'sv' ? 'Snitt månadsavgift' : 'Avg. monthly fee';
  const confLabel = currentLang === 'sv' ? 'Konfidens' : 'Confidence';
  const confValue = currentLang === 'sv' ? 'Hög (±5%)' : 'High (±5%)';
  const estLabel = currentLang === 'sv' ? 'Uppskattat marknadsvärde' : 'Estimated market value';

  addW('green', IC.house, titleLabel, [
    { l: areaInfoLabel, v: areaInfoValue },
    { l: avgSizeLabel, v: `${sqm} m²` },
    { l: avgFeeLabel, v: `${fee} kr/mån` },
    { l: confLabel, v: confValue, c: 'green' },
  ], '', `<div style="text-align:center;padding:20px 0 12px"><div style="font-size:26px;font-weight:800;color:var(--sb-black);font-family:'DM Sans',sans-serif;letter-spacing:-0.5px">${lowStr} – ${highStr} kr</div><div style="font-size:12px;color:var(--sb-gray-500);margin-top:4px">${estLabel}</div></div>`);
}


/* ═══════════════════════════════════════════════════════════
   Rate Comparison Widget
   ═══════════════════════════════════════════════════════════ */

const RATE_DATA = [
  { period: '3m', rate: 3.89, label_sv: '3 mån rörlig', label_en: '3 mo variable', recommended: true },
  { period: '1y', rate: 3.65, label_sv: '1 år bunden', label_en: '1 yr fixed' },
  { period: '3y', rate: 3.29, label_sv: '3 år bunden', label_en: '3 yr fixed' },
  { period: '5y', rate: 3.15, label_sv: '5 år bunden', label_en: '5 yr fixed' },
];

function showRateComparison(payload) {
  const rates = RATE_DATA.map(r => {
    if (r.recommended && window._offeredRate) {
      return { ...r, rate: window._offeredRate };
    }
    return r;
  });
  const recLabel = currentLang === 'sv' ? 'Rekommenderad' : 'Recommended';

  const container = document.createElement('div');
  container.className = 'rate-standalone-grid';
  container.innerHTML = rates.map((r, i) => {
    const rateStr = r.rate.toFixed(2).replace('.', ',');
    const durLabel = currentLang === 'sv' ? r.label_sv : r.label_en;
    return `<button class="rate-standalone-card${r.recommended ? ' ours' : ''}" data-period="${r.period}" data-rate="${r.rate}" style="--chip-i:${i}">
      ${r.recommended ? `<div class="rate-best-badge">${recLabel}</div>` : ''}
      <div class="rate-bank-name">${durLabel}</div>
      <div class="rate-bank-rate">${rateStr}%</div>
      <div class="rate-bank-dur">Swedish Bank</div>
    </button>`;
  }).join('');
  chatBody.appendChild(container);
  scr();

  container.querySelectorAll('.rate-standalone-card').forEach(card => {
    card.onclick = () => {
      container.querySelectorAll('.rate-standalone-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      const period = card.dataset.period;
      const rate = card.dataset.rate;
      const periodLabel = rates.find(r => r.period === period);
      const label = currentLang === 'sv' ? periodLabel.label_sv : periodLabel.label_en;
      const msg = currentLang === 'sv'
        ? `Jag väljer ${label} med ${parseFloat(rate).toFixed(2).replace('.', ',')}% ränta`
        : `I'll go with ${label} at ${parseFloat(rate).toFixed(2)}%`;
      addB('user', msg);
      if (voiceConnected) {
        addT();
        GeminiVoice.sendText(msg);
      }
    };
  });
}


/* ═══════════════════════════════════════════════════════════
   Loan Offer Card (from tool payload)
   ═══════════════════════════════════════════════════════════ */

function renderOfferCard(payload) {
  // Store offered rate so rate comparison cards can match
  if (payload.offered_rate) window._offeredRate = payload.offered_rate;
  const rate = (payload.offered_rate || 0).toFixed(2).replace('.', ',');
  const monthly = (payload.total_monthly || 0).toLocaleString('sv-SE');
  const loan = (payload.loan_amount || 0).toLocaleString('sv-SE');
  const ltv = payload.ltv_pct || 0;
  const savings = (payload.annual_savings || 0).toLocaleString('sv-SE');
  const currentBank = payload.current_bank || 'Current Bank';

  const offerCard = document.createElement('div');
  offerCard.className = 'offer-card';
  offerCard.innerHTML = `
    <div class="offer-card-header">
      <div class="offer-card-bank">Swedish Bank</div>
      <div class="offer-card-badge">${currentLang === 'sv' ? 'Ditt erbjudande' : 'Your offer'}</div>
    </div>
    <div class="offer-card-hero">
      <div class="offer-card-rate">${rate}<span class="unit">%</span></div>
      <div class="offer-card-subtitle">${currentLang === 'sv' ? '3 mån rörlig ränta' : '3 mo variable rate'}</div>
    </div>
    <div class="offer-card-divider"></div>
    <div class="offer-card-details">
      <div class="offer-detail-item">
        <div class="offer-detail-label">${currentLang === 'sv' ? 'Månadskostnad' : 'Monthly cost'}</div>
        <div class="offer-detail-value">${monthly} kr</div>
      </div>
      <div class="offer-detail-item">
        <div class="offer-detail-label">${currentLang === 'sv' ? 'Lånebelopp' : 'Loan amount'}</div>
        <div class="offer-detail-value">${loan} kr</div>
      </div>
      <div class="offer-detail-item">
        <div class="offer-detail-label">${currentLang === 'sv' ? 'Belåningsgrad' : 'LTV ratio'}</div>
        <div class="offer-detail-value">${ltv}%</div>
      </div>
      <div class="offer-detail-item">
        <div class="offer-detail-label">${currentLang === 'sv' ? 'Årlig besparing' : 'Annual savings'}</div>
        <div class="offer-detail-value">${savings} kr/${currentLang === 'sv' ? 'år' : 'yr'}</div>
      </div>
    </div>`;
  chatBody.appendChild(offerCard);
  scr();
}


/* ═══════════════════════════════════════════════════════════
   Add-ons Widget
   ═══════════════════════════════════════════════════════════ */

function renderAddons() {
  const addons = currentLang === 'sv' ? [
    { icon: '🏠', title: 'Hemförsäkring', desc: 'Fullständigt skydd för ditt hem', price: '199 kr/mån' },
    { icon: '💰', title: 'Bolåneskydd', desc: 'Täcker dina bolånebetalningar vid sjukdom', price: '149 kr/mån' },
    { icon: '📈', title: 'Autospar', desc: 'Spara automatiskt varje månad', price: 'Från 500 kr/mån' },
  ] : [
    { icon: '🏠', title: 'Home Insurance', desc: 'Complete coverage for your home', price: '199 kr/mo' },
    { icon: '💰', title: 'Mortgage Protection', desc: 'Covers mortgage payments during illness', price: '149 kr/mo' },
    { icon: '📈', title: 'Auto-Save', desc: 'Save automatically every month', price: 'From 500 kr/mo' },
  ];

  const d = document.createElement('div');
  d.className = 'action-grid';
  d.style.flexDirection = 'column';
  d.innerHTML = addons.map((a, i) => `
    <button class="action-btn" style="--action-color:var(--sb-green);--action-i:${i};flex-direction:row;justify-content:flex-start;gap:14px;padding:16px 20px;min-height:auto">
      <div style="font-size:24px;width:40px;text-align:center">${a.icon}</div>
      <div style="flex:1;text-align:left">
        <div style="font-weight:700;font-size:14px;color:var(--sb-black)">${a.title}</div>
        <div style="font-size:12px;color:var(--sb-gray-500);margin-top:2px">${a.desc}</div>
      </div>
      <div style="font-weight:700;font-size:13px;color:var(--sb-green);white-space:nowrap">${a.price}</div>
    </button>
  `).join('');
  chatBody.appendChild(d);
  scr();
}


/* ═══════════════════════════════════════════════════════════
   Injected CSS (AVM, rate cards, offer card, etc.)
   ═══════════════════════════════════════════════════════════ */

const injectedStyle = document.createElement('style');
injectedStyle.textContent = `
/* Rate comparison grid */
.rate-standalone-grid {
  display: flex; flex-wrap: wrap; gap: 10px; max-width: 440px; width: 100%; margin: 18px auto;
  padding: 12px 0 4px; justify-content: center;
}
.rate-standalone-card {
  flex: 1 1 calc(50% - 5px); min-width: 0; position: relative;
  padding: 24px 14px 18px; border-radius: 16px;
  background: rgba(255,255,255,0.95); backdrop-filter: blur(12px);
  border: 1.5px solid rgba(0,0,0,0.06);
  text-align: center; cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4,0,0.2,1);
  box-shadow: 0 4px 24px rgba(0,0,0,.06), 0 1px 4px rgba(0,0,0,.03);
  font-family: inherit;
  opacity: 0; animation: actionFadeIn 0.35s cubic-bezier(0.16,1,0.3,1) forwards;
  animation-delay: calc(var(--chip-i) * 60ms + 100ms);
}
.rate-standalone-card:hover { transform: translateY(-3px); box-shadow: 0 8px 32px rgba(0,0,0,.08), 0 2px 8px rgba(0,0,0,.04); }
.rate-standalone-card:active { transform: scale(0.97); }
.rate-standalone-card.ours { border-color: var(--sb-accent,#d45800); background: linear-gradient(180deg, rgba(212,88,0,0.04) 0%, rgba(255,255,255,0.98) 100%); }
.rate-standalone-card.selected { border-color: var(--sb-accent,#d45800); border-width: 2px; box-shadow: 0 4px 20px rgba(212,88,0,0.15), 0 2px 8px rgba(0,0,0,.04); }
.rate-best-badge { position: absolute; top: -10px; left: 0; right: 0; width: fit-content; margin: 0 auto; padding: 3px 10px; border-radius: 10px; background: var(--sb-accent,#d45800); color: white; font-size: 10px; font-weight: 800; letter-spacing: 0.3px; text-transform: uppercase; white-space: nowrap; }
.rate-standalone-card .rate-bank-name { font-size: 12.5px; font-weight: 700; color: var(--sb-gray-600,#666); margin-bottom: 6px; margin-top: 2px; }
.rate-standalone-card.ours .rate-bank-name { color: var(--sb-accent,#d45800); }
.rate-standalone-card .rate-bank-rate { font-size: 30px; font-weight: 800; color: var(--sb-black,#1b1b1f); letter-spacing: -0.5px; font-family: 'DM Sans',sans-serif; }
.rate-standalone-card.ours .rate-bank-rate { color: var(--sb-accent,#d45800); }
.rate-bank-dur { font-size: 11px; font-weight: 600; color: var(--sb-gray-400,#999); margin-top: 4px; text-transform: uppercase; letter-spacing: 0.3px; }
.rate-card-cta { margin-top: 14px; padding: 9px 0; border-radius: 10px; background: var(--sb-accent, #d45800); color: white; font-size: 12.5px; font-weight: 700; transition: all 0.15s; }
.rate-standalone-card:hover .rate-card-cta { background: var(--sb-accent-dark, #b84c00); }

/* Offer card */
.offer-card { max-width: 440px; width: 100%; margin: 20px auto; border-radius: 20px; overflow: hidden; background: linear-gradient(135deg, #0d7a38 0%, #065a28 100%); box-shadow: 0 8px 40px rgba(13,122,56,0.25), 0 2px 8px rgba(0,0,0,.08); color: white; opacity: 0; transform: translateY(8px); animation: bubIn 0.5s ease forwards; }
.offer-card-header { padding: 24px 24px 0; display: flex; align-items: center; justify-content: space-between; }
.offer-card-bank { font-size: 14px; font-weight: 700; opacity: 0.85; }
.offer-card-badge { padding: 4px 12px; border-radius: 12px; background: rgba(255,255,255,0.2); font-size: 11px; font-weight: 700; letter-spacing: 0.3px; text-transform: uppercase; }
.offer-card-hero { padding: 16px 24px 20px; text-align: center; }
.offer-card-rate { font-size: 52px; font-weight: 800; font-family: 'DM Sans',sans-serif; letter-spacing: -2px; line-height: 1; }
.offer-card-rate .unit { font-size: 24px; font-weight: 700; opacity: 0.7; letter-spacing: 0; }
.offer-card-subtitle { font-size: 13px; opacity: 0.7; margin-top: 4px; }
.offer-card-divider { height: 1px; background: rgba(255,255,255,0.15); margin: 0 24px; }
.offer-card-details { padding: 16px 24px 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.offer-detail-label { font-size: 11px; opacity: 0.6; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
.offer-detail-value { font-size: 15px; font-weight: 700; margin-top: 2px; }

/* Financial overview */
.fin-section { padding: 16px 20px; }
.fin-divider { height: 1px; background: rgba(0,0,0,0.05); margin: 0 20px; }
.fin-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; }
.fin-row-left { display: flex; align-items: center; gap: 12px; }
.fin-row-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.fin-row-label { font-size: 15px; color: var(--sb-gray-700, #555); font-weight: 500; }
.fin-row-value { font-size: 16px; font-weight: 800; color: var(--sb-black, #1a1a2e); font-family: 'DM Sans',sans-serif; }
.fin-row-change { font-size: 12px; font-weight: 600; }
.fin-row-change.green { color: var(--sb-green, #4CAF50); }
.fin-chart-section { padding: 16px 20px; }
.fin-chart-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.fin-chart-meta { display: flex; align-items: baseline; gap: 8px; }
.fin-chart-value { font-size: 22px; font-weight: 800; color: var(--sb-black,#1b1b1f); font-family: 'DM Sans',sans-serif; letter-spacing: -0.5px; }
.fin-chart-change { font-size: 14px; font-weight: 700; padding: 2px 8px; border-radius: 6px; }
.fin-chart-change.green { color: var(--sb-green,#4CAF50); background: rgba(76,175,80,0.08); }
.fin-chart-subtitle { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--sb-gray-500,#8a8f98); }
.fin-chart-periods { display: flex; gap: 4px; margin-top: 12px; justify-content: center; }
.fin-period-btn { background: none; border: 1px solid rgba(0,0,0,0.08); border-radius: 6px; padding: 4px 10px; font-size: 11px; font-weight: 600; color: var(--sb-gray-500,#8a8f98); cursor: pointer; transition: all 0.15s; font-family: inherit; }
.fin-period-btn:hover { background: rgba(0,0,0,0.03); color: var(--sb-gray-700,#555); }
.fin-period-btn.active { background: var(--sb-green,#4CAF50); color: white; border-color: var(--sb-green,#4CAF50); }
.fin-chart-funds { margin-top: 12px; border-top: 1px solid rgba(0,0,0,0.04); padding-top: 8px; }
.fin-chart-fund { display: flex; align-items: center; gap: 8px; padding: 6px 0; }
.fin-chart-fund-name { font-size: 13px; color: var(--sb-gray-600,#666); font-weight: 500; flex: 1; }
.fin-chart-fund-val { font-size: 13px; font-weight: 700; color: var(--sb-black,#1b1b1f); }

/* Quick action buttons */
.action-grid { display: flex; gap: 8px; max-width: 440px; width: 100%; margin: 18px auto; opacity: 0; transform: translateY(8px); animation: bubIn 0.4s ease forwards; }
.action-btn { flex: 1; min-height: 80px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 14px 4px 12px; background: rgba(255,255,255,0.95); backdrop-filter: blur(12px); border: 1px solid rgba(0,0,0,0.06); border-radius: 16px; cursor: pointer; transition: all 0.2s cubic-bezier(0.4,0,0.2,1); box-shadow: 0 4px 24px rgba(0,0,0,.06), 0 1px 4px rgba(0,0,0,.03); font-family: inherit; opacity: 0; animation: actionFadeIn 0.35s cubic-bezier(0.16,1,0.3,1) forwards; animation-delay: calc(var(--action-i) * 50ms + 150ms); }
.action-btn:hover { transform: translateY(-3px); box-shadow: 0 8px 32px rgba(0,0,0,.08), 0 2px 8px rgba(0,0,0,.04); border-color: var(--action-color); }
.action-btn:active { transform: scale(0.97); }
.action-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: color-mix(in srgb, var(--action-color) 10%, transparent); color: var(--action-color); transition: all 0.2s; }
.action-icon svg { width: 20px; height: 20px; }
.action-btn:hover .action-icon { background: var(--action-color); color: white; box-shadow: 0 4px 12px color-mix(in srgb, var(--action-color) 30%, transparent); }
.action-label { font-size: 12px; font-weight: 700; color: var(--sb-gray-700,#555); letter-spacing: 0.02em; }
.action-btn:hover .action-label { color: var(--action-color); }
@keyframes actionFadeIn { from { opacity:0; transform: translateY(12px) scale(0.92); } to { opacity:1; transform: translateY(0) scale(1); } }

/* Proactive insight */
.proactive-insight { max-width: 440px; width: 100%; margin: 16px auto; }
.proactive-insight-body { background: linear-gradient(135deg, rgba(212,88,0,0.06) 0%, rgba(255,255,255,0.98) 100%); border: 1.5px solid rgba(212,88,0,0.15); border-radius: 16px; padding: 20px; display: flex; gap: 14px; }
.proactive-insight-icon { font-size: 28px; flex-shrink: 0; }
.proactive-insight-content { flex: 1; }
.proactive-insight-title { font-size: 14px; font-weight: 800; color: var(--sb-accent,#d45800); margin-bottom: 6px; }
.proactive-insight-text { font-size: 13.5px; color: var(--sb-gray-700,#555); line-height: 1.5; }
.proactive-insight-actions { display: flex; gap: 8px; margin-top: 14px; }
.proactive-btn { padding: 10px 18px; border-radius: 10px; font-size: 13px; font-weight: 700; border: 1.5px solid rgba(0,0,0,0.1); background: white; cursor: pointer; transition: all 0.15s; font-family: inherit; }
.proactive-btn.primary { background: var(--sb-accent,#d45800); color: white; border-color: var(--sb-accent,#d45800); }
.proactive-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }

/* Quick reply buttons */
.qr-container { display: flex; gap: 8px; flex-wrap: wrap; max-width: 440px; width: 100%; margin: 2px 0 14px 48px; padding: 0; opacity: 0; animation: bubIn 0.4s ease forwards; }
.qr-btn { padding: 11px 20px; border-radius: 12px; font-size: 13.5px; font-weight: 700; border: 1.5px solid rgba(0,0,0,0.1); background: rgba(255,255,255,0.95); backdrop-filter: blur(8px); cursor: pointer; transition: all 0.2s cubic-bezier(0.4,0,0.2,1); font-family: inherit; opacity: 0; animation: actionFadeIn 0.35s cubic-bezier(0.16,1,0.3,1) forwards; animation-delay: calc(var(--qr-i) * 60ms + 100ms); color: var(--sb-gray-700,#444); }
.qr-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.08); border-color: var(--sb-accent,#d45800); color: var(--sb-accent,#d45800); }
.qr-btn:active { transform: scale(0.97); }
.qr-btn.primary { background: var(--sb-accent,#d45800); color: white; border-color: var(--sb-accent,#d45800); }
.qr-btn.primary:hover { background: var(--sb-accent-dark,#b84c00); box-shadow: 0 6px 20px rgba(212,88,0,0.2); transform: translateY(-2px); color: white; }
.qr-btn.selected { opacity: 1 !important; }
`;
document.head.appendChild(injectedStyle);
