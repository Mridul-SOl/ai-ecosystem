import { api } from '../api.js';

export async function renderChat(container) {
  container.innerHTML = `
    <div class="fade-in">
      <div class="chat-container">
        <!-- Chat Header -->
        <div class="chat-header">
          <div class="chat-partner">
            <div class="agent-avatar" style="background: linear-gradient(135deg, #6366f1, #a855f7); width:38px; height:38px;">
              <i data-lucide="crown" style="width:20px; height:20px;"></i>
            </div>
            <div>
              <div style="font-weight:600; font-size:14px; color:#fff;">Nova (CEO Orchestrator)</div>
              <div style="font-size:11px; color:var(--text-muted);">Natural Language Directive & Multi-Agent Dispatcher</div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
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
              <p>Welcome to <strong>AI ECOSYSTEM</strong>. I am <strong>Nova</strong>, your Chief Executive Officer agent.</p>
              <p style="margin-top:6px;">
                You can give me high-level corporate directives, business goals, or strategic inquiries.
                I will analyze the objective, coordinate with Research, Marketing, Finance, and Operations departments, and deliver an actionable consolidated strategy.
              </p>
            </div>
          </div>
        </div>

        <!-- Quick Prompts Chips -->
        <div style="padding: 8px 20px; background: rgba(0,0,0,0.15); border-top: 1px solid var(--border-subtle); display:flex; gap:8px; overflow-x:auto;">
          <span style="font-size:11px; color:var(--text-muted); align-self:center;">Quick Directives:</span>
          <button class="prompt-chip" data-directive="Create a marketing strategy for a new clothing brand with a budget of ₹50,000.">
            Clothing Brand (₹50k Budget)
          </button>
          <button class="prompt-chip" data-directive="Design an enterprise SaaS product launch roadmap with security compliance and cloud infrastructure specs.">
            SaaS Launch Plan
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
            placeholder="Instruct CEO Nova (e.g., 'Create a marketing strategy for a new clothing brand with a budget of ₹50,000.')..."
          ></textarea>
          <button class="btn btn-primary" id="btn-chat-send" style="height:44px; width:44px; padding:0;">
            <i data-lucide="send"></i>
          </button>
        </div>
      </div>
    </div>
  `;

  const chatContainer = container.querySelector('#chat-messages-container');
  const inputBox = container.querySelector('#chat-input-box');
  const sendBtn = container.querySelector('#btn-chat-send');
  const statusBadge = container.querySelector('#ceo-chat-status');

  async function handleSend() {
    const text = inputBox.value.trim();
    if (!text) return;

    inputBox.value = '';

    // Append user message
    const userMsg = document.createElement('div');
    userMsg.className = 'chat-message user';
    userMsg.innerHTML = `
      <div class="msg-avatar" style="background:#27272a;"><i data-lucide="user"></i></div>
      <div class="msg-bubble">${escapeHtml(text)}</div>
    `;
    chatContainer.appendChild(userMsg);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // Show thinking indicator
    statusBadge.textContent = 'Orchestrating...';
    statusBadge.className = 'agent-status-badge status-thinking';

    const thinkingMsg = document.createElement('div');
    thinkingMsg.className = 'chat-message assistant';
    thinkingMsg.innerHTML = `
      <div class="msg-avatar"><i data-lucide="crown"></i></div>
      <div class="msg-bubble" style="color:var(--text-muted); font-style:italic;">
        CEO Nova is analyzing objective and decomposing department tasks...
      </div>
    `;
    chatContainer.appendChild(thinkingMsg);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    if (window.lucide) window.lucide.createIcons({ root: chatContainer });

    try {
      const response = await api.chatCEO(text);
      thinkingMsg.remove();

      const parsedReply = window.marked ? window.marked.parse(response.reply) : response.reply;
      const botMsg = document.createElement('div');
      botMsg.className = 'chat-message assistant';
      botMsg.innerHTML = `
        <div class="msg-avatar"><i data-lucide="crown"></i></div>
        <div class="msg-bubble">
          ${parsedReply}
          ${response.workflow_id ? `
            <div style="margin-top:12px; padding:10px; background:rgba(99,102,241,0.1); border:1px solid rgba(99,102,241,0.25); border-radius:var(--radius-sm); display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:12px; color:#c7d2fe;">Workflow Active: <code>${response.workflow_id.slice(0, 8)}</code></span>
              <a href="#workflows" class="btn btn-primary btn-sm" style="text-decoration:none;">View Workflow DAG &rarr;</a>
            </div>
          ` : ''}
        </div>
      `;
      chatContainer.appendChild(botMsg);
      chatContainer.scrollTop = chatContainer.scrollHeight;

      statusBadge.textContent = 'Ready';
      statusBadge.className = 'agent-status-badge status-idle';

      if (window.lucide) window.lucide.createIcons({ root: chatContainer });

    } catch (err) {
      thinkingMsg.remove();
      const errMsg = document.createElement('div');
      errMsg.className = 'chat-message assistant';
      errMsg.innerHTML = `
        <div class="msg-avatar" style="background:var(--error);"><i data-lucide="alert-triangle"></i></div>
        <div class="msg-bubble" style="border-color:var(--error);">
          Failed to process directive: ${err.message}
        </div>
      `;
      chatContainer.appendChild(errMsg);
      statusBadge.textContent = 'Error';
      statusBadge.className = 'agent-status-badge status-error';
      if (window.lucide) window.lucide.createIcons({ root: chatContainer });
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
    chatContainer.innerHTML = '';
  });

  if (window.lucide) window.lucide.createIcons({ root: container });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
