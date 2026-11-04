import { api } from '../api.js';

const TECH_FUNNY_QUOTES = [
  "Consulting the AI shadow board of directors...",
  "Translating corporate buzzwords into measurable EBITDA...",
  "Defragmenting neural synaptic pathways on Groq LPU...",
  "Negotiating with the algorithm for lower churn rates...",
  "Calculating cross-departmental synergy coefficients to the 12th decimal...",
  "Drafting a 40-page memo that could have been a 3-word email...",
  "Optimizing corporate vibe metrics for maximum enterprise valuation...",
  "Briefing Athena (Research) & Chloe (Marketing) in the war room...",
  "Allocating speculative cloud budgets before Finance notices...",
  "Calibrating organizational karma and cross-functional alignment...",
  "Overclocking LPUs to synthesize executive wisdom...",
  "Checking if our quarterly targets are physically possible...",
  "Simulating 10,000 corporate acquisitions in parallel...",
  "Aligning departmental OKRs with quantum computational reality..."
];

export async function renderChat(container) {
  let isChatActive = false;

  container.innerHTML = `
    <div class="fade-in chat-workspace-wrap">
      <div class="chat-container resting" id="main-chat-container">
        
        <!-- Chat Header -->
        <div class="chat-header">
          <div class="chat-partner">
            <div class="agent-avatar" style="background: linear-gradient(135deg, #4f46e5, #7c3aed); width:40px; height:40px; color:#fff;">
              <i data-lucide="crown" style="width:20px; height:20px;"></i>
            </div>
            <div>
              <div style="font-weight:700; font-size:14.5px; color:var(--text-primary);">Nova (CEO Orchestrator)</div>
              <div style="font-size:11.5px; color:var(--text-muted);">Autonomous Business Operating System & Multi-Agent Dispatcher</div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="agent-status-badge status-idle" id="ceo-chat-status">Ready</span>
            <button class="icon-btn" id="btn-clear-chat" title="Clear Chat History">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>

        <!-- Chat Messages Area -->
        <div class="chat-messages" id="chat-messages-container">
          <div class="chat-message assistant">
            <div class="msg-avatar"><i data-lucide="crown"></i></div>
            <div class="msg-bubble">
              <p style="font-size:14.5px; font-weight:600; margin-bottom:4px;">Welcome to AI ECOSYSTEM Executive Terminal.</p>
              <p>I am <strong>Nova</strong>, your Chief Executive Officer orchestrator. Instruct me on any corporate objective, market opportunity, or strategic directive.</p>
              <p style="margin-top:8px; font-size:13px; color:var(--text-secondary);">
                When you initiate a directive, I will break it down into specialized departmental tasks across 
                <strong>Athena (Research)</strong>, <strong>Chloe (Marketing)</strong>, <strong>Sterling (Finance)</strong>, and <strong>Atlas (Operations)</strong>, 
                and synthesize a consolidated decision report.
              </p>
            </div>
          </div>
        </div>

        <!-- Quick Prompts Chips -->
        <div class="prompt-chips-bar" id="chat-prompt-chips">
          <span style="font-size:11.5px; font-weight:600; color:var(--text-muted); align-self:center; text-transform:uppercase; letter-spacing:0.5px;">Directives:</span>
          <button class="prompt-chip" data-directive="Create a marketing strategy for a new clothing brand with a budget of ₹50,000.">
            Clothing Brand (₹50k Budget)
          </button>
          <button class="prompt-chip" data-directive="Design an enterprise SaaS product launch roadmap with security compliance and cloud infrastructure specs.">
            Enterprise SaaS Launch
          </button>
          <button class="prompt-chip" data-directive="Audit our operational supply chain fulfillment bottlenecks and recommend KPI targets.">
            Supply Chain Audit
          </button>
        </div>

        <!-- Chat Input Bar -->
        <div class="chat-input-bar">
          <textarea
            class="chat-textarea"
            id="chat-input-box"
            rows="1"
            placeholder="Instruct CEO Nova (e.g., 'Formulate a growth strategy for a B2B SaaS startup...')"
          ></textarea>
          <button class="btn btn-primary" id="btn-chat-send" style="height:48px; width:48px; padding:0; border-radius:var(--radius-md);">
            <i data-lucide="send"></i>
          </button>
        </div>

      </div>
    </div>
  `;

  const mainContainer = container.querySelector('#main-chat-container');
  const chatMessages = container.querySelector('#chat-messages-container');
  const inputBox = container.querySelector('#chat-input-box');
  const sendBtn = container.querySelector('#btn-chat-send');
  const statusBadge = container.querySelector('#ceo-chat-status');

  // Trigger smooth expansion when chat is initiated
  function expandChat() {
    if (!isChatActive) {
      isChatActive = true;
      mainContainer.classList.remove('resting');
      mainContainer.classList.add('expanded');
    }
  }

  // Handle Input Auto-Grow and Auto-Expand on focus
  inputBox?.addEventListener('focus', () => {
    expandChat();
  });

  inputBox?.addEventListener('input', () => {
    inputBox.style.height = 'auto';
    inputBox.style.height = Math.min(inputBox.scrollHeight, 140) + 'px';
  });

  async function handleSend() {
    const text = inputBox.value.trim();
    if (!text) return;

    expandChat();
    inputBox.value = '';
    inputBox.style.height = '48px';

    // 1. Append User Message
    const userMsg = document.createElement('div');
    userMsg.className = 'chat-message user';
    userMsg.innerHTML = `
      <div class="msg-avatar"><i data-lucide="user"></i></div>
      <div class="msg-bubble">${escapeHtml(text)}</div>
    `;
    chatMessages.appendChild(userMsg);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // 2. High-Tech Telemetry HUD & Cycling Funny Quotes
    statusBadge.textContent = 'Orchestrating...';
    statusBadge.className = 'agent-status-badge status-thinking';

    const telemetryMsg = document.createElement('div');
    telemetryMsg.className = 'chat-message assistant';
    
    let quoteIndex = 0;
    let startTime = Date.now();

    telemetryMsg.innerHTML = `
      <div class="msg-avatar"><i data-lucide="crown"></i></div>
      <div class="msg-bubble" style="width: 100%; max-width: 600px; padding: 0; background: transparent; border: none; box-shadow: none;">
        <div class="telemetry-hud">
          <div class="telemetry-header">
            <div class="telemetry-status-group">
              <span class="telemetry-radar-beacon"></span>
              <span>[GROQ LPU // 120B NEURAL ENGINE // INFERRING]</span>
            </div>
            <span class="telemetry-timer" id="hud-timer">Elapsed: 0.0s</span>
          </div>

          <div class="telemetry-quote-wrap fade-in" id="hud-quote">
            "${TECH_FUNNY_QUOTES[0]}"
          </div>

          <div class="telemetry-progressbar"></div>
        </div>
      </div>
    `;
    chatMessages.appendChild(telemetryMsg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    if (window.lucide) window.lucide.createIcons({ root: telemetryMsg });

    // Live Stopwatch timer
    const timerInterval = setInterval(() => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const timerEl = telemetryMsg.querySelector('#hud-timer');
      if (timerEl) timerEl.textContent = `Elapsed: ${elapsed}s`;
    }, 100);

    // Funny / Tech Quote Rotator
    const quoteEl = telemetryMsg.querySelector('#hud-quote');
    const quoteInterval = setInterval(() => {
      if (!quoteEl) return;
      quoteEl.classList.remove('fade-in');
      quoteEl.classList.add('fade-out');

      setTimeout(() => {
        quoteIndex = (quoteIndex + 1) % TECH_FUNNY_QUOTES.length;
        quoteEl.textContent = `"${TECH_FUNNY_QUOTES[quoteIndex]}"`;
        quoteEl.classList.remove('fade-out');
        quoteEl.classList.add('fade-in');
      }, 300);
    }, 2200);

    try {
      const response = await api.chatCEO(text);

      clearInterval(timerInterval);
      clearInterval(quoteInterval);
      telemetryMsg.remove();

      const parsedReply = window.marked ? window.marked.parse(response.reply) : response.reply;
      const botMsg = document.createElement('div');
      botMsg.className = 'chat-message assistant';
      botMsg.innerHTML = `
        <div class="msg-avatar"><i data-lucide="crown"></i></div>
        <div class="msg-bubble">
          ${parsedReply}
          ${response.workflow_id ? `
            <div style="margin-top:16px; padding:12px 16px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:var(--radius-sm); display:flex; justify-content:space-between; align-items:center;">
              <div style="display:flex; align-items:center; gap:8px;">
                <i data-lucide="check-circle" style="width:16px; height:16px; color:#16a34a;"></i>
                <span style="font-size:12.5px; font-weight:600; color:#166534;">Workflow Dispatched: <code>${response.workflow_id.slice(0, 8)}</code></span>
              </div>
              <a href="#workflows" class="btn btn-primary btn-xs" style="text-decoration:none;">View Workflow DAG &rarr;</a>
            </div>
          ` : ''}
        </div>
      `;
      chatMessages.appendChild(botMsg);
      chatMessages.scrollTop = chatMessages.scrollHeight;

      statusBadge.textContent = 'Ready';
      statusBadge.className = 'agent-status-badge status-idle';

      if (window.lucide) window.lucide.createIcons({ root: chatMessages });

    } catch (err) {
      clearInterval(timerInterval);
      clearInterval(quoteInterval);
      telemetryMsg.remove();

      const errMsg = document.createElement('div');
      errMsg.className = 'chat-message assistant';
      errMsg.innerHTML = `
        <div class="msg-avatar" style="background:var(--error); color:#fff;"><i data-lucide="alert-triangle"></i></div>
        <div class="msg-bubble" style="border-color:var(--error); background:#fef2f2; color:#991b1b;">
          <strong>Directive Interrupted:</strong> ${err.message}
        </div>
      `;
      chatMessages.appendChild(errMsg);
      statusBadge.textContent = 'Error';
      statusBadge.className = 'agent-status-badge status-error';
      if (window.lucide) window.lucide.createIcons({ root: chatMessages });
    }
  }

  sendBtn?.addEventListener('click', handleSend);
  inputBox?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // Prompt chips
  container.querySelectorAll('.prompt-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      inputBox.value = chip.getAttribute('data-directive');
      handleSend();
    });
  });

  // Clear chat
  container.querySelector('#btn-clear-chat')?.addEventListener('click', () => {
    chatMessages.innerHTML = `
      <div class="chat-message assistant">
        <div class="msg-avatar"><i data-lucide="crown"></i></div>
        <div class="msg-bubble">
          <p>Chat session reset. Ready for your next executive directive.</p>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons({ root: chatMessages });
  });

  if (window.lucide) window.lucide.createIcons({ root: container });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
