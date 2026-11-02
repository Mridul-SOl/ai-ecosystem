import { api } from '../api.js';

export async function renderTasks(container) {
  container.innerHTML = `
    <div class="fade-in">
      <div class="page-header-row">
        <div>
          <h2 class="page-title">Task Management</h2>
          <p class="page-description">Real-time status tracking, execution history, and human-in-the-loop authorization.</p>
        </div>
        <div style="display:flex; gap:10px;">
          <select id="tasks-dept-filter" class="btn btn-secondary btn-sm" style="padding:4px 8px;">
            <option value="all">All Departments</option>
            <option value="Executive Leadership">Executive Leadership (CEO)</option>
            <option value="Research">Research & Intel</option>
            <option value="Marketing">Marketing & Growth</option>
            <option value="Finance">Finance & Budget</option>
            <option value="Operations">Operations & Supply Chain</option>
            <option value="Security">Security & Compliance</option>
            <option value="Infrastructure">Infrastructure & Cloud</option>
            <option value="HR">Human Resources</option>
          </select>
          <button class="btn btn-primary btn-sm" id="btn-create-task-page">
            <i data-lucide="plus"></i> Create Task
          </button>
        </div>
      </div>

      <!-- Kanban Columns -->
      <div class="kanban-board" id="kanban-board-container">
        <!-- 1. Pending -->
        <div class="kanban-column" data-col="Pending">
          <div class="kanban-header">
            <span class="kanban-title"><i data-lucide="clock" style="color:var(--text-muted); width:14px;"></i> Pending</span>
            <span class="kanban-count" id="count-pending">0</span>
          </div>
          <div class="kanban-cards-wrap" id="col-pending"></div>
        </div>

        <!-- 2. Running -->
        <div class="kanban-column" data-col="Running">
          <div class="kanban-header">
            <span class="kanban-title"><i data-lucide="play" style="color:var(--info); width:14px;"></i> Running</span>
            <span class="kanban-count" id="count-running">0</span>
          </div>
          <div class="kanban-cards-wrap" id="col-running"></div>
        </div>

        <!-- 3. Awaiting Approval -->
        <div class="kanban-column" data-col="Awaiting Approval" style="border-top: 2px solid var(--warning);">
          <div class="kanban-header">
            <span class="kanban-title"><i data-lucide="shield-alert" style="color:var(--warning); width:14px;"></i> Awaiting Approval</span>
            <span class="kanban-count" id="count-approval" style="background:var(--warning-bg); color:var(--warning);">0</span>
          </div>
          <div class="kanban-cards-wrap" id="col-approval"></div>
        </div>

        <!-- 4. Completed -->
        <div class="kanban-column" data-col="Completed">
          <div class="kanban-header">
            <span class="kanban-title"><i data-lucide="check-circle" style="color:var(--success); width:14px;"></i> Completed</span>
            <span class="kanban-count" id="count-completed">0</span>
          </div>
          <div class="kanban-cards-wrap" id="col-completed"></div>
        </div>

        <!-- 5. Failed / Cancelled -->
        <div class="kanban-column" data-col="Failed">
          <div class="kanban-header">
            <span class="kanban-title"><i data-lucide="alert-octagon" style="color:var(--error); width:14px;"></i> Failed / Cancelled</span>
            <span class="kanban-count" id="count-failed">0</span>
          </div>
          <div class="kanban-cards-wrap" id="col-failed"></div>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#btn-create-task-page')?.addEventListener('click', () => {
    document.getElementById('modal-create-task')?.showModal();
  });

  const deptFilter = container.querySelector('#tasks-dept-filter');
  deptFilter?.addEventListener('change', () => loadTasks(container, deptFilter.value));

  await loadTasks(container, 'all');
  if (window.lucide) window.lucide.createIcons();
}

async function loadTasks(container, department = 'all') {
  try {
    const tasks = await api.getTasks({ department: department === 'all' ? null : department });

    const colPending = container.querySelector('#col-pending');
    const colRunning = container.querySelector('#col-running');
    const colApproval = container.querySelector('#col-approval');
    const colCompleted = container.querySelector('#col-completed');
    const colFailed = container.querySelector('#col-failed');

    const counts = { pending: 0, running: 0, approval: 0, completed: 0, failed: 0 };
    const htmls = { pending: '', running: '', approval: '', completed: '', failed: '' };

    tasks.forEach(t => {
      const cardHtml = `
        <div class="task-card" data-task-id="${t.id}">
          <div class="task-card-top">
            <span class="priority-tag priority-${t.priority}">${t.priority}</span>
            <span class="task-agent-badge"><i data-lucide="bot" style="width:11px;"></i> ${t.assigned_agent_id.toUpperCase()}</span>
          </div>
          <div class="task-title">${t.title}</div>
          <div class="task-desc-preview">${t.description}</div>
          <div class="task-card-footer">
            <span>${t.department}</span>
            <span>${new Date(t.created_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</span>
          </div>
        </div>
      `;

      if (t.status === 'Pending' || t.status === 'Assigned') {
        htmls.pending += cardHtml;
        counts.pending++;
      } else if (t.status === 'Running') {
        htmls.running += cardHtml;
        counts.running++;
      } else if (t.status === 'Awaiting Approval') {
        htmls.approval += cardHtml;
        counts.approval++;
      } else if (t.status === 'Completed') {
        htmls.completed += cardHtml;
        counts.completed++;
      } else {
        htmls.failed += cardHtml;
        counts.failed++;
      }
    });

    if (colPending) colPending.innerHTML = htmls.pending || `<div style="color:var(--text-muted); font-size:11px; text-align:center; padding:16px;">No pending tasks</div>`;
    if (colRunning) colRunning.innerHTML = htmls.running || `<div style="color:var(--text-muted); font-size:11px; text-align:center; padding:16px;">No running tasks</div>`;
    if (colApproval) colApproval.innerHTML = htmls.approval || `<div style="color:var(--text-muted); font-size:11px; text-align:center; padding:16px;">No pending approvals</div>`;
    if (colCompleted) colCompleted.innerHTML = htmls.completed || `<div style="color:var(--text-muted); font-size:11px; text-align:center; padding:16px;">No completed tasks</div>`;
    if (colFailed) colFailed.innerHTML = htmls.failed || `<div style="color:var(--text-muted); font-size:11px; text-align:center; padding:16px;">No failed tasks</div>`;

    container.querySelector('#count-pending').textContent = counts.pending;
    container.querySelector('#count-running').textContent = counts.running;
    container.querySelector('#count-approval').textContent = counts.approval;
    container.querySelector('#count-completed').textContent = counts.completed;
    container.querySelector('#count-failed').textContent = counts.failed;

    // Bind card click to open task detail modal
    container.querySelectorAll('.task-card').forEach(card => {
      card.addEventListener('click', () => {
        const taskId = card.getAttribute('data-task-id');
        openTaskDetailModal(taskId);
      });
    });

    if (window.lucide) window.lucide.createIcons({ root: container });

  } catch (err) {
    console.error('Failed to load tasks:', err);
  }
}

async function openTaskDetailModal(taskId) {
  const modal = document.getElementById('modal-task-detail');
  const content = document.getElementById('task-detail-content');
  if (!modal || !content) return;

  content.innerHTML = `<div style="padding:24px; text-align:center; color:var(--text-muted);">Loading task details...</div>`;
  modal.showModal();

  try {
    const task = await api.getTask(taskId);
    const outputText = task.output_data?.result || task.output_data?.output || task.error_message || 'No output recorded.';
    const parsedOutput = window.marked ? window.marked.parse(outputText) : outputText;

    content.innerHTML = `
      <div class="modal-header">
        <div class="modal-title-wrap">
          <span class="priority-tag priority-${task.priority}">${task.priority}</span>
          <h3>${task.title}</h3>
        </div>
        <button class="icon-btn" id="btn-close-detail-modal"><i data-lucide="x"></i></button>
      </div>

      <div style="display:flex; gap:16px; margin-bottom:16px; font-size:12px; color:var(--text-secondary); padding-bottom:12px; border-bottom:1px solid var(--border-subtle);">
        <span><strong>Department:</strong> ${task.department}</span>
        <span><strong>Assigned Agent:</strong> ${task.assigned_agent_id.toUpperCase()}</span>
        <span><strong>Status:</strong> <span class="agent-status-badge status-${task.status.toLowerCase()}">${task.status}</span></span>
        <span><strong>Created:</strong> ${new Date(task.created_at).toLocaleString()}</span>
      </div>

      <div style="margin-bottom:16px;">
        <h4 style="font-size:12px; font-weight:600; color:var(--text-muted); margin-bottom:6px; text-transform:uppercase;">Task Instructions</h4>
        <div style="background:var(--bg-elevated); padding:12px; border-radius:var(--radius-sm); font-size:13px; line-height:1.5;">${task.description}</div>
      </div>

      <div style="margin-bottom:16px;">
        <h4 style="font-size:12px; font-weight:600; color:var(--text-muted); margin-bottom:6px; text-transform:uppercase;">Agent Output / Deliverable</h4>
        <div style="background:var(--bg-elevated); border:1px solid var(--border-subtle); padding:16px; border-radius:var(--radius-sm); max-height:260px; overflow-y:auto; font-size:13px; line-height:1.6;">
          ${parsedOutput}
        </div>
      </div>

      <!-- Execution History Timeline -->
      <div style="margin-bottom:20px;">
        <h4 style="font-size:12px; font-weight:600; color:var(--text-muted); margin-bottom:6px; text-transform:uppercase;">State Transition History</h4>
        <div style="display:flex; flex-direction:column; gap:6px; font-size:11px;">
          ${(task.history || []).map(h => `
            <div style="display:flex; gap:10px; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.03);">
              <span style="color:var(--text-muted);">${new Date(h.timestamp).toLocaleTimeString()}</span>
              <span style="color:var(--accent); font-weight:600;">${h.state_from} &rarr; ${h.state_to}</span>
              <span style="color:var(--text-secondary);">${h.notes || ''}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="modal-actions" style="border-top:1px solid var(--border-subtle); padding-top:16px;">
        ${task.status === 'Awaiting Approval' ? `
          <button class="btn btn-danger btn-sm" id="btn-reject-task-action">
            <i data-lucide="x-circle"></i> Reject Action
          </button>
          <button class="btn btn-success btn-sm" id="btn-approve-task-action">
            <i data-lucide="check-circle"></i> Authorize & Run Action
          </button>
        ` : ''}

        ${task.status === 'Failed' || task.status === 'Cancelled' ? `
          <button class="btn btn-primary btn-sm" id="btn-retry-task-action">
            <i data-lucide="rotate-cw"></i> Retry Task
          </button>
        ` : ''}

        ${task.status === 'Pending' || task.status === 'Running' ? `
          <button class="btn btn-secondary btn-sm" id="btn-cancel-task-action">
            <i data-lucide="slash"></i> Cancel Task
          </button>
        ` : ''}
        <button class="btn btn-secondary btn-sm" id="btn-close-detail-modal-action">Close</button>
      </div>
    `;

    // Action button listeners
    content.querySelector('#btn-close-detail-modal')?.addEventListener('click', () => modal.close());
    content.querySelector('#btn-close-detail-modal-action')?.addEventListener('click', () => modal.close());

    content.querySelector('#btn-approve-task-action')?.addEventListener('click', async () => {
      await api.approveTask(taskId);
      modal.close();
      loadTasks(document.querySelector('.page-content'));
    });

    content.querySelector('#btn-reject-task-action')?.addEventListener('click', async () => {
      await api.rejectTask(taskId);
      modal.close();
      loadTasks(document.querySelector('.page-content'));
    });

    content.querySelector('#btn-retry-task-action')?.addEventListener('click', async () => {
      await api.retryTask(taskId);
      modal.close();
      loadTasks(document.querySelector('.page-content'));
    });

    content.querySelector('#btn-cancel-task-action')?.addEventListener('click', async () => {
      await api.cancelTask(taskId);
      modal.close();
      loadTasks(document.querySelector('.page-content'));
    });

    if (window.lucide) window.lucide.createIcons({ root: content });

  } catch (err) {
    content.innerHTML = `<div style="color:var(--error); padding:20px;">Failed to load task details: ${err.message}</div>`;
  }
}
