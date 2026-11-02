import { api } from '../api.js';

export async function renderOverview(container) {
  container.innerHTML = `
    <div class="fade-in">
      <div class="page-header-row">
        <div>
          <h2 class="page-title">Executive Overview</h2>
          <p class="page-description">Autonomous multi-agent enterprise operating system live telemetry.</p>
        </div>
        <div style="display:flex; gap:10px;">
          <button class="btn btn-secondary btn-sm" id="btn-ov-refresh">
            <i data-lucide="refresh-cw"></i> Refresh
          </button>
          <button class="btn btn-primary btn-sm" id="btn-ov-workflow">
            <i data-lucide="sparkles"></i> Launch Directive
          </button>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div class="kpi-grid" id="kpi-cards-wrap">
        <div class="kpi-card">
          <div class="kpi-info">
            <span class="kpi-label">Active Workflows</span>
            <span class="kpi-value" id="kpi-active-wf">0</span>
            <span class="kpi-delta">In-flight DAGs</span>
          </div>
          <div class="kpi-icon"><i data-lucide="git-merge"></i></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-info">
            <span class="kpi-label">Completed Tasks</span>
            <span class="kpi-value" id="kpi-completed-tasks">0</span>
            <span class="kpi-delta" style="color:var(--success)">+100% verified</span>
          </div>
          <div class="kpi-icon"><i data-lucide="check-circle-2"></i></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-info">
            <span class="kpi-label">Pending / Queued</span>
            <span class="kpi-value" id="kpi-pending-tasks">0</span>
            <span class="kpi-delta" style="color:var(--warning)">Awaiting turn</span>
          </div>
          <div class="kpi-icon"><i data-lucide="clock"></i></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-info">
            <span class="kpi-label">Operational Agents</span>
            <span class="kpi-value">8 / 8</span>
            <span class="kpi-delta" style="color:var(--info)">100% available</span>
          </div>
          <div class="kpi-icon"><i data-lucide="cpu"></i></div>
        </div>
      </div>

      <!-- Active Departments Grid -->
      <div style="margin-bottom: 24px;">
        <div class="page-header-row" style="margin-bottom: 14px;">
          <h3 style="font-size: 15px; font-weight: 600;">Department Agents</h3>
          <a href="#agents" style="color: var(--accent); font-size: 12px; text-decoration:none;">View All 8 Agents &rarr;</a>
        </div>
        <div class="agent-grid" id="ov-agents-grid">
          <!-- Injected dynamically -->
        </div>
      </div>

      <!-- Two-Column Feed: Recent Workflows & Live Activity -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div class="workflow-card">
          <div class="workflow-card-header">
            <div class="workflow-title-wrap">
              <h3>Latest Executive Workflows</h3>
              <p class="workflow-objective-text">Multi-agent coordinated operations</p>
            </div>
            <a href="#workflows" style="color: var(--accent); font-size: 12px; text-decoration: none;">View Workflows &rarr;</a>
          </div>
          <div id="ov-workflows-list" style="display:flex; flex-direction:column; gap:12px; margin-top:14px;">
            <div style="color:var(--text-muted); font-size:12px;">Loading recent workflows...</div>
          </div>
        </div>

        <div class="workflow-card">
          <div class="workflow-card-header">
            <div class="workflow-title-wrap">
              <h3>Live Activity Feed</h3>
              <p class="workflow-objective-text">Real-time inter-agent messaging and actions</p>
            </div>
            <a href="#logs" style="color: var(--accent); font-size: 12px; text-decoration: none;">All Logs &rarr;</a>
          </div>
          <div id="ov-activity-feed" style="display:flex; flex-direction:column; gap:8px; margin-top:14px; max-height: 280px; overflow-y:auto;">
            <div style="color:var(--text-muted); font-size:12px;">Connecting to telemetry stream...</div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Bind Buttons
  container.querySelector('#btn-ov-refresh')?.addEventListener('click', () => loadOverviewData(container));
  container.querySelector('#btn-ov-workflow')?.addEventListener('click', () => {
    document.getElementById('modal-create-workflow')?.showModal();
  });

  await loadOverviewData(container);
  if (window.lucide) window.lucide.createIcons();
}

async function loadOverviewData(container) {
  try {
    const [analytics, agents, workflows, logs] = await Promise.all([
      api.getAnalytics(),
      api.getAgents(),
      api.getWorkflows({ limit: 4 }),
      api.getLogs({ limit: 6 })
    ]);

    // Update KPI numbers
    const kpiActiveWf = container.querySelector('#kpi-active-wf');
    const kpiCompletedTasks = container.querySelector('#kpi-completed-tasks');
    const kpiPendingTasks = container.querySelector('#kpi-pending-tasks');
    if (kpiActiveWf) kpiActiveWf.textContent = analytics.active_workflows;
    if (kpiCompletedTasks) kpiCompletedTasks.textContent = analytics.completed_tasks;
    if (kpiPendingTasks) kpiPendingTasks.textContent = analytics.pending_tasks + analytics.awaiting_approval_tasks;

    // Render Agents (top 4 or all)
    const agentsGrid = container.querySelector('#ov-agents-grid');
    if (agentsGrid) {
      agentsGrid.innerHTML = agents.slice(0, 4).map(a => `
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
          <p class="agent-description">${a.description}</p>
          <div class="agent-stats-row">
            <div class="stat-item"><span class="stat-label">Tasks Done</span><span class="stat-value">${a.tasks_completed}</span></div>
            <div class="stat-item"><span class="stat-label">Pending</span><span class="stat-value">${a.tasks_pending}</span></div>
            <div class="stat-item"><span class="stat-label">Role</span><span class="stat-value" style="font-size:11px;">${a.role.split(' ')[0]}</span></div>
          </div>
          <button class="btn btn-secondary btn-sm btn-open-agent-drawer" data-agent-id="${a.id}">
            <i data-lucide="message-square"></i> Open Agent
          </button>
        </div>
      `).join('');
    }

    // Render Recent Workflows
    const wfList = container.querySelector('#ov-workflows-list');
    if (wfList) {
      if (workflows.length === 0) {
        wfList.innerHTML = `<div style="color:var(--text-muted); font-size:12px; padding:12px; text-align:center;">No workflows created yet. Launch your first corporate directive!</div>`;
      } else {
        wfList.innerHTML = workflows.map(wf => {
          const pct = wf.total_steps ? Math.round((wf.current_step / wf.total_steps) * 100) : 0;
          return `
            <div style="background:var(--bg-elevated); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:12px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <span style="font-weight:600; font-size:13px; color:#fff;">${wf.title}</span>
                <span class="agent-status-badge status-${wf.status === 'Completed' ? 'idle' : 'busy'}">${wf.status}</span>
              </div>
              <div style="font-size:11px; color:var(--text-secondary); margin-bottom:8px;">${wf.objective}</div>
              <div class="workflow-progress-bar" style="margin:6px 0;">
                <div class="workflow-progress-fill" style="width:${pct}%;"></div>
              </div>
              <div style="display:flex; justify-content:space-between; font-size:10px; color:var(--text-muted);">
                <span>Step ${wf.current_step} of ${wf.total_steps}</span>
                <span>${pct}% completed</span>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // Render Recent Logs
    const logList = container.querySelector('#ov-activity-feed');
    if (logList) {
      if (logs.length === 0) {
        logList.innerHTML = `<div style="color:var(--text-muted); font-size:12px; padding:12px; text-align:center;">No activity logged yet.</div>`;
      } else {
        logList.innerHTML = logs.map(l => `
          <div style="display:flex; gap:8px; align-items:flex-start; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.04); font-size:11.5px;">
            <span style="font-weight:600; color:var(--accent); font-family:var(--font-mono); font-size:10px;">[${l.level}]</span>
            <span style="color:var(--text-secondary); flex:1;">${l.message}</span>
            <span style="color:var(--text-muted); font-size:10px;">${new Date(l.created_at).toLocaleTimeString()}</span>
          </div>
        `).join('');
      }
    }

    // Bind drawer buttons
    container.querySelectorAll('.btn-open-agent-drawer').forEach(b => {
      b.addEventListener('click', () => {
        const id = b.getAttribute('data-agent-id');
        window.openAgentDrawer && window.openAgentDrawer(id);
      });
    });

    if (window.lucide) window.lucide.createIcons({ root: container });

  } catch (err) {
    console.error('Failed to load overview data:', err);
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
