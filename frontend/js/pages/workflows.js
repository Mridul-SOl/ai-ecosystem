import { api } from '../api.js';

export async function renderWorkflows(container) {
  container.innerHTML = `
    <div class="fade-in">
      <div class="page-header-row">
        <div>
          <h2 class="page-title">Executive Multi-Agent Workflows</h2>
          <p class="page-description">End-to-end coordinated cross-department operations orchestrated by CEO Agent Vikram.</p>
        </div>
        <div style="display:flex; gap:10px;">
          <button class="btn btn-secondary btn-sm" id="btn-refresh-wf">
            <i data-lucide="refresh-cw"></i> Refresh
          </button>
          <button class="btn btn-primary btn-sm" id="btn-new-wf-page">
            <i data-lucide="plus"></i> Launch New Workflow
          </button>
        </div>
      </div>

      <div class="workflow-list" id="full-workflows-list">
        <div class="skeleton-card" style="height: 140px; margin-bottom: 16px;"></div>
        <div class="skeleton-card" style="height: 140px;"></div>
      </div>
    </div>
  `;

  container.querySelector('#btn-refresh-wf')?.addEventListener('click', () => loadWorkflows(container));
  container.querySelector('#btn-new-wf-page')?.addEventListener('click', () => {
    document.getElementById('modal-create-workflow')?.showModal();
  });

  await loadWorkflows(container);
  if (window.lucide) window.lucide.createIcons();
}

async function loadWorkflows(container) {
  try {
    const workflows = await api.getWorkflows();
    const list = container.querySelector('#full-workflows-list');
    if (!list) return;

    if (workflows.length === 0) {
      list.innerHTML = `
        <div style="background:var(--bg-card); border:1px dashed var(--border-medium); border-radius:var(--radius-lg); padding:40px; text-align:center;">
          <i data-lucide="git-merge" style="width:36px; height:36px; color:var(--text-muted); margin-bottom:12px;"></i>
          <h3 style="color:var(--text-primary); font-size:15px; margin-bottom:6px;">No Corporate Workflows Yet</h3>
          <p style="color:var(--text-secondary); font-size:13px; max-width:440px; margin:0 auto 16px auto;">
            Give CEO Agent Vikram a high-level corporate objective (e.g., launch a clothing brand with a ₹50,000 budget), and watch the system coordinate all 8 departments autonomously.
          </p>
          <button class="btn btn-primary" id="btn-empty-create-wf">
            <i data-lucide="plus"></i> Launch First Workflow
          </button>
        </div>
      `;
      list.querySelector('#btn-empty-create-wf')?.addEventListener('click', () => {
        document.getElementById('modal-create-workflow')?.showModal();
      });
      if (window.lucide) window.lucide.createIcons({ root: list });
      return;
    }

    list.innerHTML = workflows.map(wf => {
      const pct = wf.total_steps ? Math.round((wf.current_step / wf.total_steps) * 100) : 0;
      const tasks = wf.tasks || [];
      const parsedSynthesis = wf.final_result && window.marked ? window.marked.parse(wf.final_result) : wf.final_result;

      return `
        <div class="workflow-card" id="wf-card-${wf.id}">
          <div class="workflow-card-header">
            <div class="workflow-title-wrap">
              <div style="display:flex; align-items:center; gap:10px; margin-bottom:4px;">
                <span class="agent-status-badge status-${wf.status === 'Completed' ? 'idle' : 'busy'}">${wf.status}</span>
                <h3>${wf.title}</h3>
              </div>
              <p class="workflow-objective-text"><i data-lucide="target" style="width:13px; color:var(--accent);"></i> ${wf.objective}</p>
            </div>
            <div style="text-align:right; font-size:11px; color:var(--text-muted);">
              <div>Workflow ID: <code style="font-family:var(--font-mono);">${wf.id.slice(0, 8)}</code></div>
              <div>Initiated: ${new Date(wf.created_at).toLocaleString()}</div>
            </div>
          </div>

          <!-- Progress -->
          <div class="workflow-progress-bar">
            <div class="workflow-progress-fill" style="width:${pct}%;"></div>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-secondary); margin-bottom:16px;">
            <span>Milestones: <strong>${wf.current_step} of ${wf.total_steps}</strong> Completed</span>
            <span>Overall Progress: <strong>${pct}%</strong></span>
          </div>

          <!-- DAG Subtasks Timeline -->
          <h4 style="font-size:12px; font-weight:600; color:var(--text-muted); text-transform:uppercase; margin-bottom:8px;">
            Coordinated Department Tasks (${tasks.length})
          </h4>
          <div class="workflow-steps-timeline">
            ${tasks.map((t, idx) => `
              <div class="step-card">
                <div class="step-header">
                  <span style="font-weight:600; color:var(--accent);">Step ${idx + 1}</span>
                  <span class="agent-status-badge status-${t.status.toLowerCase()}">${t.status}</span>
                </div>
                <div class="step-title">${t.title}</div>
                <div style="font-size:11px; color:var(--text-muted); margin-bottom:6px;">Dept: ${t.department} (${t.assigned_agent_id.toUpperCase()})</div>
                <div style="font-size:11px; color:var(--text-secondary); line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
                  ${t.description}
                </div>
              </div>
            `).join('')}
          </div>

          <!-- CEO Consolidated Synthesis (If completed) -->
          ${wf.final_result ? `
            <div style="margin-top:20px; background:var(--bg-elevated); border:1px solid var(--border-medium); border-radius:var(--radius-md); padding:20px;">
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px; color:var(--accent);">
                <i data-lucide="crown" style="width:18px; height:18px;"></i>
                <h4 style="font-size:14px; font-weight:700; color:var(--text-primary);">CEO Executive Synthesis & Actionable Strategy</h4>
              </div>
              <div style="font-size:13px; line-height:1.6; color:var(--text-primary); max-height:360px; overflow-y:auto; padding-right:8px;">
                ${parsedSynthesis}
              </div>
            </div>
          ` : `
            <div style="margin-top:14px; font-size:12px; color:var(--text-muted); font-style:italic;">
              CEO Agent Vikram is coordinating departments and synthesizing the consolidated strategy...
            </div>
          `}
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons({ root: list });

  } catch (err) {
    console.error('Failed to load workflows:', err);
  }
}
