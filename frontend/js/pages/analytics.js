import { api } from '../api.js';

export async function renderAnalytics(container) {
  container.innerHTML = `
    <div class="fade-in">
      <div class="page-header-row">
        <div>
          <h2 class="page-title">Operational Analytics & Telemetry</h2>
          <p class="page-description">Resource allocation, agent throughput, and execution velocity.</p>
        </div>
        <div>
          <button class="btn btn-secondary btn-sm" id="btn-refresh-analytics">
            <i data-lucide="refresh-cw"></i> Refresh Telemetry
          </button>
        </div>
      </div>

      <!-- KPI Summary -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-info">
            <span class="kpi-label">Total Executions</span>
            <span class="kpi-value" id="an-total-tasks">0</span>
            <span class="kpi-delta">All-time operations</span>
          </div>
          <div class="kpi-icon"><i data-lucide="activity"></i></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-info">
            <span class="kpi-label">Completion Velocity</span>
            <span class="kpi-value" id="an-success-rate">100%</span>
            <span class="kpi-delta" style="color:var(--success);">Zero system crash</span>
          </div>
          <div class="kpi-icon"><i data-lucide="zap"></i></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-info">
            <span class="kpi-label">Completed Workflows</span>
            <span class="kpi-value" id="an-completed-wf">0</span>
            <span class="kpi-delta" style="color:var(--info);">Cross-department DAGs</span>
          </div>
          <div class="kpi-icon"><i data-lucide="award"></i></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-info">
            <span class="kpi-label">Activity Volume</span>
            <span class="kpi-value" id="an-total-logs">0</span>
            <span class="kpi-delta">Event dispatches</span>
          </div>
          <div class="kpi-icon"><i data-lucide="bar-chart-2"></i></div>
        </div>
      </div>

      <!-- Interactive Charts Row -->
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:24px;">
        <div class="workflow-card">
          <h3 style="font-size:14px; font-weight:600; color:var(--text-primary); margin-bottom:14px;">Workload by Department</h3>
          <div style="position:relative; height:240px; display:flex; align-items:center; justify-content:center;">
            <canvas id="chart-departments"></canvas>
          </div>
        </div>
        <div class="workflow-card">
          <h3 style="font-size:14px; font-weight:600; color:var(--text-primary); margin-bottom:14px;">Agent Task Completion</h3>
          <div style="position:relative; height:240px;">
            <canvas id="chart-agents"></canvas>
          </div>
        </div>
      </div>

      <!-- Department Leaderboard Table -->
      <div class="workflow-card">
        <h3 style="font-size:14px; font-weight:600; color:var(--text-primary); margin-bottom:14px;">Department Productivity Matrix</h3>
        <div style="overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse; font-size:12.5px; text-align:left;">
            <thead>
              <tr style="border-bottom:1px solid var(--border-medium); color:var(--text-muted);">
                <th style="padding:10px 12px;">Agent / Leader</th>
                <th style="padding:10px 12px;">Department</th>
                <th style="padding:10px 12px;">Current Status</th>
                <th style="padding:10px 12px;">Tasks Finalized</th>
                <th style="padding:10px 12px;">Queue Depth</th>
              </tr>
            </thead>
            <tbody id="an-agents-table-body">
              <tr><td colspan="5" style="padding:12px; color:var(--text-muted);">Loading telemetry...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#btn-refresh-analytics')?.addEventListener('click', () => loadAnalytics(container));
  await loadAnalytics(container);
  if (window.lucide) window.lucide.createIcons();
}

async function loadAnalytics(container) {
  try {
    const data = await api.getAnalytics();

    container.querySelector('#an-total-tasks').textContent = data.total_tasks;
    container.querySelector('#an-completed-wf').textContent = data.completed_workflows;
    container.querySelector('#an-total-logs').textContent = data.recent_activity_count;

    const rate = data.total_tasks > 0 ? Math.round((data.completed_tasks / data.total_tasks) * 100) : 100;
    container.querySelector('#an-success-rate').textContent = `${rate}%`;

    // Render Table
    const tbody = container.querySelector('#an-agents-table-body');
    if (tbody) {
      tbody.innerHTML = (data.agent_stats || []).map(a => `
        <tr style="border-bottom:1px solid var(--border-subtle);">
          <td style="padding:10px 12px; font-weight:600; color:var(--text-primary);">${a.name}</td>
          <td style="padding:10px 12px; color:var(--text-secondary);">${a.department}</td>
          <td style="padding:10px 12px;"><span class="agent-status-badge status-${a.status}">${a.status}</span></td>
          <td style="padding:10px 12px; font-weight:600; color:var(--success);">${a.tasks_completed}</td>
          <td style="padding:10px 12px; color:var(--warning); font-weight:600;">${a.tasks_pending}</td>
        </tr>
      `).join('');
    }

    // Render Charts with Chart.js
    if (window.Chart) {
      renderDepartmentChart(container, data.task_throughput || []);
      renderAgentChart(container, data.agent_stats || []);
    }

  } catch (err) {
    console.error('Failed to load analytics:', err);
  }
}

let deptChart = null;
let agentChart = null;

function renderDepartmentChart(container, throughput) {
  const canvas = container.querySelector('#chart-departments');
  if (!canvas) return;

  const labels = throughput.length > 0 ? throughput.map(t => t.department) : ['Research', 'Marketing', 'Finance', 'Operations', 'Security'];
  const counts = throughput.length > 0 ? throughput.map(t => t.count) : [3, 2, 2, 1, 1];

  if (deptChart) deptChart.destroy();

  deptChart = new window.Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: counts,
        backgroundColor: [
          '#6366f1', '#10b981', '#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316'
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#a1a1aa', font: { family: 'Inter', size: 11 } }
        }
      }
    }
  });
}

function renderAgentChart(container, agentStats) {
  const canvas = container.querySelector('#chart-agents');
  if (!canvas) return;

  const labels = agentStats.map(a => a.name.split(' ')[0]);
  const completed = agentStats.map(a => a.tasks_completed);

  if (agentChart) agentChart.destroy();

  agentChart = new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Tasks Completed',
        data: completed,
        backgroundColor: 'rgba(99, 102, 241, 0.7)',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: '#71717a', font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: '#71717a', precision: 0 }, grid: { color: 'rgba(255,255,255,0.05)' } }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}
