import { api } from '../api.js';

export async function renderLogs(container) {
  container.innerHTML = `
    <div class="fade-in">
      <div class="page-header-row">
        <div>
          <h2 class="page-title">Activity Logs & Audit Trail</h2>
          <p class="page-description">Real-time telemetry and forensic operational audit stream.</p>
        </div>
        <div style="display:flex; gap:10px;">
          <select id="logs-level-filter" class="btn btn-secondary btn-sm" style="padding:4px 8px;">
            <option value="all">All Levels</option>
            <option value="INFO">INFO</option>
            <option value="ACTION">ACTION</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="WARN">WARN</option>
            <option value="ERROR">ERROR</option>
          </select>
          <button class="btn btn-secondary btn-sm" id="btn-refresh-logs">
            <i data-lucide="refresh-cw"></i> Refresh
          </button>
        </div>
      </div>

      <!-- Terminal Card -->
      <div style="background:var(--bg-card); border:1px solid var(--border-medium); border-radius:var(--radius-md); overflow:hidden;">
        <div style="padding:12px 18px; background:rgba(0,0,0,0.3); border-bottom:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#ef4444;"></span>
            <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#f59e0b;"></span>
            <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#10b981;"></span>
            <span style="margin-left:8px; font-family:var(--font-mono); font-size:12px; color:var(--text-muted);">ai-ecosystem.log &mdash; stream: active</span>
          </div>
          <span style="font-size:11px; color:var(--text-muted);" id="logs-count-text">0 entries</span>
        </div>

        <div id="logs-terminal-feed" style="font-family:var(--font-mono); font-size:12px; padding:16px; max-height:calc(100vh - 280px); overflow-y:auto; display:flex; flex-direction:column; gap:6px;">
          <div style="color:var(--text-muted);">Loading logs...</div>
        </div>
      </div>
    </div>
  `;

  const levelFilter = container.querySelector('#logs-level-filter');
  levelFilter?.addEventListener('change', () => loadLogs(container, levelFilter.value));
  container.querySelector('#btn-refresh-logs')?.addEventListener('click', () => loadLogs(container, levelFilter.value));

  await loadLogs(container, 'all');
  if (window.lucide) window.lucide.createIcons();
}

async function loadLogs(container, level = 'all') {
  try {
    const logs = await api.getLogs({ level: level === 'all' ? null : level, limit: 120 });
    const feed = container.querySelector('#logs-terminal-feed');
    const countText = container.querySelector('#logs-count-text');
    if (!feed) return;

    countText.textContent = `${logs.length} entries`;

    if (logs.length === 0) {
      feed.innerHTML = `<div style="color:var(--text-muted); text-align:center; padding:20px;">No logs found.</div>`;
      return;
    }

    feed.innerHTML = logs.map(l => {
      let color = 'var(--text-secondary)';
      if (l.level === 'SUCCESS') color = 'var(--success)';
      if (l.level === 'WARN') color = 'var(--warning)';
      if (l.level === 'ERROR') color = 'var(--error)';
      if (l.level === 'ACTION') color = '#c084fc';

      const agentPart = l.agent_id ? `<span style="color:var(--accent); font-weight:600;">[${l.agent_id.toUpperCase()}]</span>` : '';
      const time = new Date(l.created_at).toLocaleTimeString();

      return `
        <div style="display:flex; gap:10px; line-height:1.5; padding:3px 0; border-bottom:1px solid rgba(255,255,255,0.02);">
          <span style="color:var(--text-muted); min-width:70px;">${time}</span>
          <span style="color:${color}; font-weight:600; min-width:65px;">${l.level}</span>
          ${agentPart}
          <span style="color:var(--text-primary); flex:1;">${l.message}</span>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Failed to load logs:', err);
  }
}
