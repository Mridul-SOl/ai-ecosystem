import { api } from '../api.js';

export async function renderSettings(container) {
  container.innerHTML = `
    <div class="fade-in">
      <div class="page-header-row">
        <div>
          <h2 class="page-title">System Settings & Integrations</h2>
          <p class="page-description">Configure AI inference providers, external credentials, and security approval policies.</p>
        </div>
        <div>
          <button class="btn btn-secondary btn-sm" id="btn-test-llm">
            <i data-lucide="activity"></i> Test AI Connection
          </button>
        </div>
      </div>

      <!-- Test Diagnostic Output Box -->
      <div id="llm-test-result" style="display:none; padding:14px; border-radius:var(--radius-sm); margin-bottom:20px; font-size:12.5px;"></div>

      <form id="form-settings" style="display:flex; flex-direction:column; gap:20px;">
        
        <!-- Section 1: AI Provider -->
        <div class="workflow-card">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:14px; color:var(--accent);">
            <i data-lucide="zap" style="width:18px; height:18px; color:#f59e0b;"></i>
            <h3 style="font-size:15px; font-weight:600; color:var(--text-primary);">AI Inference Engine (Groq / OpenAI / Ollama)</h3>
          </div>
          <div class="form-row" style="margin-bottom:14px;">
            <div class="form-group">
              <label>Default LLM Provider *</label>
              <select id="set-llm-provider">
                <option value="groq" selected>Groq Cloud (Ultra-Fast Llama-3.3-70B, Mixtral) [Recommended]</option>
                <option value="openai">OpenAI API (GPT-4o, GPT-4o-mini)</option>
                <option value="ollama">Ollama (Local Private Models: Llama3, Mistral)</option>
                <option value="heuristic">Autonomous Heuristic Engine (Offline / Zero-Key Fallback)</option>
              </select>
            </div>
            <div class="form-group">
              <label>Groq Model</label>
              <input type="text" id="set-groq-model" placeholder="llama-3.3-70b-versatile" value="llama-3.3-70b-versatile" />
              <span class="form-hint">e.g. <code>llama-3.3-70b-versatile</code>, <code>llama-3.1-8b-instant</code></span>
            </div>
          </div>
          <div class="form-row" style="margin-bottom:14px;">
            <div class="form-group">
              <label>Groq API Key *</label>
              <input type="password" id="set-groq-key" placeholder="gsk_..." />
              <span class="form-hint">Stored securely on backend; never exposed to client browser.</span>
            </div>
            <div class="form-group">
              <label>OpenAI Model (Alternative)</label>
              <input type="text" id="set-openai-model" placeholder="gpt-4o-mini" value="gpt-4o-mini" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>OpenAI API Key (Alternative)</label>
              <input type="password" id="set-openai-key" placeholder="sk-..." />
            </div>
            <div class="form-group">
              <label>Ollama Base URL</label>
              <input type="text" id="set-ollama-url" placeholder="http://localhost:11434" value="http://localhost:11434" />
            </div>
          </div>
        </div>

        <!-- Section 2: Security & Consequential Action Gating -->
        <div class="workflow-card">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:14px; color:var(--warning);">
            <i data-lucide="shield-alert" style="width:18px; height:18px;"></i>
            <h3 style="font-size:15px; font-weight:600; color:var(--text-primary);">Human-In-The-Loop Security Policies</h3>
          </div>
          <div style="display:flex; flex-direction:column; gap:12px;">
            <label class="checkbox-label" style="display:flex; align-items:center; gap:10px; cursor:pointer;">
              <input type="checkbox" id="set-appr-email" checked />
              <span style="color:var(--text-primary); font-size:13px;">Require explicit user approval before dispatching SMTP emails</span>
            </label>
            <label class="checkbox-label" style="display:flex; align-items:center; gap:10px; cursor:pointer;">
              <input type="checkbox" id="set-appr-github" checked />
              <span style="color:var(--text-primary); font-size:13px;">Require explicit user approval before creating/modifying GitHub issues or code</span>
            </label>
          </div>
        </div>

        <!-- Section 3: External Integrations -->
        <div class="workflow-card">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:14px; color:var(--info);">
            <i data-lucide="layers" style="width:18px; height:18px;"></i>
            <h3 style="font-size:15px; font-weight:600; color:var(--text-primary);">External Services (PyGithub & SMTP)</h3>
          </div>
          <div class="form-group" style="margin-bottom:14px;">
            <label>GitHub Personal Access Token</label>
            <input type="password" id="set-github-token" placeholder="ghp_..." />
            <span class="form-hint">Leave blank to use mock repository service during development.</span>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>SMTP Host</label>
              <input type="text" id="set-smtp-host" placeholder="smtp.gmail.com" />
            </div>
            <div class="form-group">
              <label>SMTP Port</label>
              <input type="number" id="set-smtp-port" placeholder="587" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>SMTP Username / Email</label>
              <input type="text" id="set-smtp-user" placeholder="you@company.com" />
            </div>
            <div class="form-group">
              <label>SMTP App Password</label>
              <input type="password" id="set-smtp-pass" placeholder="••••••••••••" />
            </div>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end;">
          <button type="submit" class="btn btn-primary" id="btn-save-settings">
            <i data-lucide="save"></i> Save Configuration
          </button>
        </div>
      </form>
    </div>
  `;

  const testBtn = container.querySelector('#btn-test-llm');
  const testBox = container.querySelector('#llm-test-result');

  testBtn?.addEventListener('click', async () => {
    testBox.style.display = 'block';
    testBox.style.background = 'rgba(99,102,241,0.1)';
    testBox.style.border = '1px solid var(--accent)';
    testBox.style.color = '#c7d2fe';
    testBox.innerHTML = `Pinging active AI inference provider...`;

    try {
      const res = await api.testLLM();
      if (res.status === 'online') {
        testBox.style.background = 'var(--success-bg)';
        testBox.style.border = '1px solid var(--success)';
        testBox.style.color = 'var(--success)';
        testBox.innerHTML = `<strong>Diagnostic Passed:</strong> Provider <code>${res.provider}</code> responded: "${res.response}"`;
      } else {
        testBox.style.background = 'var(--error-bg)';
        testBox.style.border = '1px solid var(--error)';
        testBox.style.color = 'var(--error)';
        testBox.innerHTML = `<strong>Diagnostic Failed:</strong> ${res.error}`;
      }
    } catch (err) {
      testBox.style.background = 'var(--error-bg)';
      testBox.style.border = '1px solid var(--error)';
      testBox.style.color = 'var(--error)';
      testBox.innerHTML = `<strong>Error:</strong> ${err.message}`;
    }
  });

  // Handle Form Submit
  container.querySelector('#form-settings')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const settingsPayload = {
      llm_provider: container.querySelector('#set-llm-provider').value,
      groq_api_key: container.querySelector('#set-groq-key').value.trim(),
      groq_model: container.querySelector('#set-groq-model').value.trim(),
      openai_model: container.querySelector('#set-openai-model').value.trim(),
      openai_api_key: container.querySelector('#set-openai-key').value.trim(),
      ollama_base_url: container.querySelector('#set-ollama-url').value.trim(),
      require_approval_email: container.querySelector('#set-appr-email').checked ? 'true' : 'false',
      require_approval_github: container.querySelector('#set-appr-github').checked ? 'true' : 'false',
      github_token: container.querySelector('#set-github-token').value.trim(),
      smtp_host: container.querySelector('#set-smtp-host').value.trim(),
      smtp_port: container.querySelector('#set-smtp-port').value.trim(),
      smtp_user: container.querySelector('#set-smtp-user').value.trim(),
      smtp_password: container.querySelector('#set-smtp-pass').value.trim()
    };

    try {
      await api.updateSettings(settingsPayload);
      alert('Settings saved successfully!');
    } catch (err) {
      alert(`Failed to save settings: ${err.message}`);
    }
  });

  await loadSettings(container);
  if (window.lucide) window.lucide.createIcons();
}

async function loadSettings(container) {
  try {
    const data = await api.getSettings();
    const stored = data.stored || {};
    const runtime = data.runtime || {};

    if (stored.llm_provider || runtime.default_provider) {
      container.querySelector('#set-llm-provider').value = stored.llm_provider || runtime.default_provider;
    }
    if (stored.groq_model || runtime.groq_model) {
      container.querySelector('#set-groq-model').value = stored.groq_model || runtime.groq_model;
    }
    if (stored.groq_api_key) container.querySelector('#set-groq-key').value = stored.groq_api_key;
    if (stored.openai_model) container.querySelector('#set-openai-model').value = stored.openai_model;
    if (stored.openai_api_key) container.querySelector('#set-openai-key').value = stored.openai_api_key;
    if (stored.ollama_base_url || runtime.ollama_base_url) {
      container.querySelector('#set-ollama-url').value = stored.ollama_base_url || runtime.ollama_base_url;
    }
    if (stored.github_token) container.querySelector('#set-github-token').value = stored.github_token;
    if (stored.smtp_host) container.querySelector('#set-smtp-host').value = stored.smtp_host;
    if (stored.smtp_port) container.querySelector('#set-smtp-port').value = stored.smtp_port;
    if (stored.smtp_user) container.querySelector('#set-smtp-user').value = stored.smtp_user;

    container.querySelector('#set-appr-email').checked = stored.require_approval_email !== 'false';
    container.querySelector('#set-appr-github').checked = stored.require_approval_github !== 'false';

  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}
