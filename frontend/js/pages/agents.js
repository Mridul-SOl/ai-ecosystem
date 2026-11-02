import { api } from '../api.js';

export async function renderAgents(container) {
  container.innerHTML = `
    <div class="fade-in">
      <div class="page-header-row">
        <div>
          <h2 class="page-title">Autonomous AI Agents</h2>
          <p class="page-description">The 8 specialized departments governing the AI ECOSYSTEM virtual enterprise.</p>
        </div>
        <div>
          <button class="btn btn-secondary btn-sm" id="btn-refresh-agents">
            <i data-lucide="refresh-cw"></i> Refresh Status
          </button>
        </div>
      </div>

      <!-- 8 Agents Grid -->
      <div class="agent-grid" id="full-agents-grid">
        <div style="color:var(--text-muted); font-size:13px;">Loading department agents...</div>
      </div>
    </div>
  `;

  container.querySelector('#btn-refresh-agents')?.addEventListener('click', () => loadAgents(container));
  await loadAgents(container);
  if (window.lucide) window.lucide.createIcons();
}

async function loadAgents(container) {
  try {
    const agents = await api.getAgents();
    const grid = container.querySelector('#full-agents-grid');
    if (!grid) return;

    grid.innerHTML = agents.map(a => `
      <div class="agent-card">
        <div class="agent-card-header">
          <div class="agent-avatar-wrap">
            <div class="agent-avatar"><i data-lucide="${getIconForAgent(a.id)}"></i></div>
            <div class="agent-title-info">
              <span class="agent-name">${a.name}</span>
              <span class="agent-dept">${a.department}</span>
            </div>
          </div>
          <span class="agent-status-badge status-${a.status}">${a.status}</span>
        </div>

        <div style="font-size:11px; font-weight:600; color:var(--accent); margin-bottom:6px;">
          ${a.role}
        </div>

        <p class="agent-description">${a.description}</p>

        <!-- Capabilities Pills -->
        <div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:14px;">
          ${(a.capabilities || []).slice(0, 3).map(cap => `
            <span style="font-size:10px; background:rgba(255,255,255,0.04); border:1px solid var(--border-subtle); border-radius:4px; padding:2px 6px; color:var(--text-secondary);">
              ${cap}
            </span>
          `).join('')}
        </div>

        <div class="agent-stats-row">
          <div class="stat-item"><span class="stat-label">Tasks Completed</span><span class="stat-value" style="color:var(--success);">${a.tasks_completed}</span></div>
          <div class="stat-item"><span class="stat-label">Pending</span><span class="stat-value" style="color:var(--warning);">${a.tasks_pending}</span></div>
          <div class="stat-item"><span class="stat-label">Status</span><span class="stat-value" style="font-size:11px;">${a.status.toUpperCase()}</span></div>
        </div>

        <div class="agent-actions-row">
          <button class="btn btn-primary btn-sm btn-open-agent-drawer" data-agent-id="${a.id}">
            <i data-lucide="message-square"></i> Direct Chat & Inspect
          </button>
        </div>
      </div>
    `).join('');

    // Bind drawer buttons
    grid.querySelectorAll('.btn-open-agent-drawer').forEach(b => {
      b.addEventListener('click', () => {
        const id = b.getAttribute('data-agent-id');
        window.openAgentDrawer && window.openAgentDrawer(id);
      });
    });

    if (window.lucide) window.lucide.createIcons({ root: grid });

  } catch (err) {
    console.error('Failed to load agents:', err);
  }
}

function getIconForAgent(id) {
  switch (id) {
    case 'ceo': return 'crown';
    case 'hr': return 'users';
    case 'marketing': return 'megaphone';
    case 'finance': return 'dollar-sign';
    case 'operations': return 'workflow';
    case 'research': return 'microscope';
    case 'security': return 'shield-check';
    case 'infrastructure': return 'server';
    default: return 'bot';
  }
}
