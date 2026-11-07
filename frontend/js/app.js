// Main Application Entrypoint & Client Router

import { api } from './api.js';
import { realtime } from './websocket.js';
import { authService } from './supabase.js';

// Page modules
import { renderOverview } from './pages/overview.js';
import { renderAgents } from './pages/agents.js';
import { renderTasks } from './pages/tasks.js';
import { renderWorkflows } from './pages/workflows.js';
import { renderChat } from './pages/chat.js';
import { renderMemory } from './pages/memory.js';
import { renderLogs } from './pages/logs.js';
import { renderAnalytics } from './pages/analytics.js';
import { renderSettings } from './pages/settings.js';

const routes = {
  overview: { title: 'Executive Overview', render: renderOverview },
  agents: { title: 'AI Department Agents', render: renderAgents },
  tasks: { title: 'Task Manager', render: renderTasks },
  workflows: { title: 'Executive Workflows', render: renderWorkflows },
  chat: { title: 'CEO AI Chat', render: renderChat },
  memory: { title: 'Vector Memory & Knowledge', render: renderMemory },
  logs: { title: 'Activity Logs', render: renderLogs },
  analytics: { title: 'Analytics & Telemetry', render: renderAnalytics },
  settings: { title: 'System Settings', render: renderSettings }
};

let currentPage = 'overview';

// ==========================================
// Initialization
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[AI ECOSYSTEM] Initializing client application...');

  // 1. Connect WebSocket
  realtime.connect();

  // 2. Setup Route Listener
  window.addEventListener('hashchange', handleNavigation);

  // 3. Setup Modals, Auth, and Global UI Elements
  initAuthUI();
  initModals();
  initAgentDrawer();
  initGlobalSearch();

  // 4. Navigate to initial page
  handleNavigation();

  // 5. Update Navigation Badges
  refreshNavBadges();
  setInterval(refreshNavBadges, 8000);

  // 6. Subscribe to Real-Time Updates
  realtime.subscribe('task_updated', () => {
    refreshNavBadges();
    if (currentPage === 'tasks' || currentPage === 'overview' || currentPage === 'workflows') {
      reRenderCurrentPage();
    }
  });

  realtime.subscribe('workflow_created', () => {
    refreshNavBadges();
    if (currentPage === 'workflows' || currentPage === 'overview') {
      reRenderCurrentPage();
    }
  });

  realtime.subscribe('workflow_completed', () => {
    refreshNavBadges();
    if (currentPage === 'workflows' || currentPage === 'overview') {
      reRenderCurrentPage();
    }
  });
});

// ==========================================
// Navigation & Routing with Strict Auth Gate
// ==========================================
function handleNavigation() {
  const landingPortal = document.getElementById('landing-portal');
  const appLayout = document.getElementById('app');

  // Strict Authentication Gate:
  // No dashboard access is given to any user without logging in
  if (!authService.isAuthenticated()) {
    if (landingPortal) landingPortal.style.display = 'block';
    if (appLayout) appLayout.style.display = 'none';
    if (window.lucide && landingPortal) {
      window.lucide.createIcons({ root: landingPortal });
    }
    return;
  }

  // User is authenticated: Reveal dashboard and hide landing portal
  if (landingPortal) landingPortal.style.display = 'none';
  if (appLayout) appLayout.style.display = 'flex';

  const hash = window.location.hash.replace('#', '').trim() || 'overview';
  const route = routes[hash] || routes['overview'];
  currentPage = hash in routes ? hash : 'overview';

  // Update Topbar Title
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = route.title;

  // Update Active Sidebar Link
  document.querySelectorAll('.sidebar-nav .nav-item').forEach((item) => {
    if (item.getAttribute('data-page') === currentPage) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Render Page Content
  const container = document.getElementById('page-container');
  if (container) {
    container.innerHTML = '';
    route.render(container);
  }
}

function reRenderCurrentPage() {
  if (!authService.isAuthenticated()) return;
  const container = document.getElementById('page-container');
  if (container && routes[currentPage]) {
    routes[currentPage].render(container);
  }
}

async function refreshNavBadges() {
  try {
    const analytics = await api.getAnalytics();
    const pendingBadge = document.getElementById('pending-tasks-badge');
    const wfBadge = document.getElementById('active-workflows-badge');

    if (pendingBadge) {
      const pendingCount = (analytics.pending_tasks || 0) + (analytics.awaiting_approval_tasks || 0);
      pendingBadge.textContent = pendingCount;
    }
    if (wfBadge) {
      wfBadge.textContent = analytics.active_workflows || 0;
    }
  } catch (err) {
    // Silent background telemetry catch
  }
}

// ==========================================
// Modals & Action Controls
// ==========================================
function initModals() {
  // Quick Task
  const btnQuickTask = document.getElementById('btn-quick-task');
  const modalTask = document.getElementById('modal-create-task');
  const btnCloseTask = document.getElementById('btn-close-task-modal');
  const btnCancelTask = document.getElementById('btn-cancel-task-modal');
  const formTask = document.getElementById('form-create-task');

  btnQuickTask?.addEventListener('click', () => modalTask?.showModal());
  btnCloseTask?.addEventListener('click', () => modalTask?.close());
  btnCancelTask?.addEventListener('click', () => modalTask?.close());

  formTask?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      title: document.getElementById('task-title-input').value.trim(),
      description: document.getElementById('task-desc-input').value.trim(),
      assigned_agent_id: document.getElementById('task-agent-select').value,
      department: getDepartmentForAgent(document.getElementById('task-agent-select').value),
      priority: document.getElementById('task-priority-select').value,
      requires_approval: document.getElementById('task-approval-checkbox').checked
    };

    try {
      await api.createTask(payload);
      modalTask.close();
      formTask.reset();
      realtime.showToast('Task Created', `Task dispatched to ${payload.assigned_agent_id.toUpperCase()}`, 'success');
      reRenderCurrentPage();
    } catch (err) {
      alert(`Error creating task: ${err.message}`);
    }
  });

  // Quick Workflow
  const btnQuickWf = document.getElementById('btn-quick-workflow');
  const modalWf = document.getElementById('modal-create-workflow');
  const btnCloseWf = document.getElementById('btn-close-workflow-modal');
  const btnCancelWf = document.getElementById('btn-cancel-workflow-modal');
  const formWf = document.getElementById('form-create-workflow');

  btnQuickWf?.addEventListener('click', () => modalWf?.showModal());
  btnCloseWf?.addEventListener('click', () => modalWf?.close());
  btnCancelWf?.addEventListener('click', () => modalWf?.close());

  // Sample prompt chips in modal
  modalWf?.querySelectorAll('.prompt-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const textarea = document.getElementById('workflow-objective-input');
      if (textarea) textarea.value = chip.getAttribute('data-prompt');
    });
  });

  formWf?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const objective = document.getElementById('workflow-objective-input').value.trim();
    if (!objective) return;

    try {
      modalWf.close();
      formWf.reset();
      realtime.showToast('CEO Orchestrator Mobilized', 'Decomposing objective across department agents...', 'info');

      await api.createWorkflow(objective);
      window.location.hash = '#workflows';
    } catch (err) {
      alert(`Error launching workflow: ${err.message}`);
    }
  });

  // Refresh data button
  document.getElementById('btn-refresh-data')?.addEventListener('click', () => {
    reRenderCurrentPage();
    refreshNavBadges();
    realtime.showToast('System Refreshed', 'Latest data loaded from database.', 'info');
  });

  // Event feed button
  document.getElementById('btn-open-terminal')?.addEventListener('click', () => {
    window.location.hash = '#logs';
  });

  // Enterprise Legal Modals (Terms & Privacy)
  const modalTerms = document.getElementById('modal-terms');
  const modalPrivacy = document.getElementById('modal-privacy');

  document.getElementById('btn-terms-modal')?.addEventListener('click', (e) => {
    e.preventDefault();
    modalTerms?.showModal();
  });
  document.getElementById('btn-close-terms-modal')?.addEventListener('click', () => modalTerms?.close());
  document.getElementById('btn-close-terms-footer')?.addEventListener('click', () => modalTerms?.close());

  document.getElementById('btn-privacy-modal')?.addEventListener('click', (e) => {
    e.preventDefault();
    modalPrivacy?.showModal();
  });
  document.getElementById('btn-close-privacy-modal')?.addEventListener('click', () => modalPrivacy?.close());
  document.getElementById('btn-close-privacy-footer')?.addEventListener('click', () => modalPrivacy?.close());

  // Interactive Live Product Console Preview Tabs
  const previewTabs = document.querySelectorAll('#console-preview-tabs .console-tab-btn');
  previewTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      previewTabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.console-tab-panel').forEach(p => p.classList.remove('active'));
      
      tab.classList.add('active');
      const targetPanelId = tab.getAttribute('data-tab');
      document.getElementById(targetPanelId)?.classList.add('active');
    });
  });
}

function getDepartmentForAgent(id) {
  const map = {
    ceo: 'Executive Leadership',
    hr: 'Human Resources',
    marketing: 'Marketing & Growth',
    finance: 'Finance & Economics',
    operations: 'Business Operations',
    research: 'Market Intelligence & R&D',
    security: 'Information Security & Compliance',
    infrastructure: 'DevOps & Cloud Engineering'
  };
  return map[id] || 'Operations';
}

// ==========================================
// Agent Side Drawer (1-on-1 Direct Chat & Info)
// ==========================================
let activeDrawerAgentId = null;

function initAgentDrawer() {
  const drawer = document.getElementById('agent-drawer');
  const overlay = document.getElementById('agent-drawer-overlay');
  const closeBtn = document.getElementById('btn-close-drawer');
  const sendBtn = document.getElementById('btn-drawer-send');
  const chatInput = document.getElementById('drawer-chat-input');

  const closeDrawer = () => {
    drawer?.classList.remove('open');
    overlay?.classList.remove('active');
  };

  closeBtn?.addEventListener('click', closeDrawer);
  overlay?.addEventListener('click', closeDrawer);

  // Drawer Tabs
  drawer?.querySelectorAll('.drawer-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      drawer.querySelectorAll('.drawer-tab').forEach((t) => t.classList.remove('active'));
      drawer.querySelectorAll('.drawer-tab-content').forEach((c) => c.classList.remove('active'));

      tab.classList.add('active');
      const targetId = `drawer-tab-${tab.getAttribute('data-tab')}`;
      document.getElementById(targetId)?.classList.add('active');
    });
  });

  // Drawer Chat Send
  const handleDrawerSend = async () => {
    const text = chatInput?.value.trim();
    if (!text || !activeDrawerAgentId) return;

    chatInput.value = '';
    const messagesList = document.getElementById('drawer-messages-list');

    // Add User Message
    const userBubble = document.createElement('div');
    userBubble.style.cssText = 'background:var(--accent); color:#fff; padding:10px 14px; border-radius:var(--radius-sm); align-self:flex-end; max-width:85%; font-size:12.5px;';
    userBubble.textContent = text;
    messagesList?.appendChild(userBubble);
    messagesList.scrollTop = messagesList.scrollHeight;

    // Loading indicator
    const botBubble = document.createElement('div');
    botBubble.style.cssText = 'background:var(--bg-elevated); color:var(--text-muted); padding:10px 14px; border-radius:var(--radius-sm); align-self:flex-start; max-width:85%; font-size:12.5px; font-style:italic;';
    botBubble.textContent = 'Agent is thinking...';
    messagesList?.appendChild(botBubble);
    messagesList.scrollTop = messagesList.scrollHeight;

    try {
      const resp = await api.chatWithAgent(activeDrawerAgentId, text);
      const parsed = window.marked ? window.marked.parse(resp.reply) : resp.reply;
      botBubble.style.color = 'var(--text-primary)';
      botBubble.style.fontStyle = 'normal';
      botBubble.innerHTML = parsed;
      messagesList.scrollTop = messagesList.scrollHeight;
    } catch (err) {
      botBubble.style.color = 'var(--error)';
      botBubble.textContent = `Error: ${err.message}`;
    }
  };

  sendBtn?.addEventListener('click', handleDrawerSend);
  chatInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleDrawerSend();
    }
  });

  // Global helper exposed to pages
  window.openAgentDrawer = async (agentId) => {
    activeDrawerAgentId = agentId;
    drawer?.classList.add('open');
    overlay?.classList.add('active');

    try {
      const [agent, history] = await Promise.all([
        api.getAgent(agentId),
        api.getAgentHistory(agentId)
      ]);

      document.getElementById('drawer-agent-name').textContent = agent.name;
      document.getElementById('drawer-agent-role').textContent = `${agent.department} • ${agent.role}`;
      document.getElementById('drawer-agent-desc').textContent = agent.description;
      document.getElementById('drawer-agent-prompt').textContent = agent.system_prompt;

      const capsList = document.getElementById('drawer-agent-caps');
      if (capsList) {
        capsList.innerHTML = (agent.capabilities || []).map((c) => `<li style="margin-bottom:4px; font-size:12px; color:var(--text-secondary);">&bull; ${c}</li>`).join('');
      }

      // Populate history tab
      const tasksList = document.getElementById('drawer-tasks-history');
      if (tasksList) {
        tasksList.innerHTML = (history.tasks || []).map((t) => `
          <div style="background:var(--bg-elevated); border:1px solid var(--border-subtle); padding:10px; border-radius:var(--radius-sm); margin-bottom:8px;">
            <div style="font-weight:600; font-size:12px; color:var(--text-primary);">${t.title}</div>
            <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-muted); margin-top:4px;">
              <span>Status: <strong style="color:var(--text-primary);">${t.status}</strong></span>
              <span>Priority: ${t.priority}</span>
            </div>
          </div>
        `).join('') || '<div style="color:var(--text-muted); font-size:12px;">No tasks assigned yet.</div>';
      }

      // Set greeting in chat
      const messagesList = document.getElementById('drawer-messages-list');
      if (messagesList) {
        messagesList.innerHTML = `
          <div style="background:var(--bg-elevated); border:1px solid var(--border-subtle); color:var(--text-primary); padding:12px 14px; border-radius:var(--radius-sm); align-self:flex-start; max-width:90%; font-size:12.5px; line-height:1.5;">
            Hello. I am <strong>${agent.name}</strong>, responsible for <em>${agent.role}</em>. How can I assist you with ${agent.department} matters today?
          </div>
        `;
      }
    } catch (err) {
      console.error('Failed to open agent drawer:', err);
    }
  };
}

// ==========================================
// Global Search
// ==========================================
function initGlobalSearch() {
  const searchInput = document.getElementById('global-search-input');
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = searchInput.value.trim();
      if (q) {
        window.location.hash = '#memory';
        setTimeout(() => {
          const memInput = document.getElementById('memory-search-query');
          if (memInput) {
            memInput.value = q;
            document.getElementById('form-memory-search')?.dispatchEvent(new Event('submit'));
          }
        }, 200);
      }
    }
  });

  // Keyboard shortcut Cmd+K or Ctrl+K
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      searchInput?.focus();
    }
  });
}

// ==========================================
// Supabase Authentication UI Integration
// ==========================================
function initAuthUI() {
  const btnOpenAuth = document.getElementById('btn-open-auth');
  const modalAuth = document.getElementById('modal-auth');
  const btnCloseAuth = document.getElementById('btn-close-auth-modal');
  const btnCancelAuth = document.getElementById('btn-cancel-auth');
  const formAuth = document.getElementById('form-auth');
  const tabSignIn = document.getElementById('tab-auth-signin');
  const tabSignUp = document.getElementById('tab-auth-signup');
  const authTitle = document.getElementById('auth-modal-title');
  const btnAuthLabel = document.getElementById('btn-auth-label');
  const groupUsername = document.getElementById('group-auth-username');
  const authAlert = document.getElementById('auth-alert');
  const topbarUserPill = document.getElementById('topbar-user-pill');
  const topbarUserName = document.getElementById('topbar-user-name');
  const topbarUserAvatar = document.getElementById('topbar-user-avatar');
  const btnLogout = document.getElementById('btn-topbar-logout');
  const sidebarUserName = document.querySelector('.sidebar-footer .user-name');
  const sidebarUserAvatar = document.querySelector('.sidebar-footer .user-avatar span');

  let mode = 'signin'; // 'signin' | 'signup'
  let landingMode = 'signin';

  const landingPortal = document.getElementById('landing-portal');
  const appLayout = document.getElementById('app');

  function updateUIForUser(user) {
    if (user) {
      if (landingPortal) landingPortal.style.display = 'none';
      if (appLayout) appLayout.style.display = 'flex';
      if (btnOpenAuth) btnOpenAuth.style.display = 'none';
      if (topbarUserPill) topbarUserPill.style.display = 'flex';
      
      const displayName = user.full_name || (user.email ? user.email.split('@')[0] : 'Operator');
      const initials = displayName.slice(0, 2).toUpperCase();

      if (topbarUserName) topbarUserName.textContent = displayName;
      if (topbarUserAvatar) topbarUserAvatar.textContent = initials;
      if (sidebarUserName) sidebarUserName.textContent = displayName;
      if (sidebarUserAvatar) sidebarUserAvatar.textContent = initials;
      
      handleNavigation();
    } else {
      if (landingPortal) landingPortal.style.display = 'block';
      if (appLayout) appLayout.style.display = 'none';
      if (btnOpenAuth) btnOpenAuth.style.display = 'inline-flex';
      if (topbarUserPill) topbarUserPill.style.display = 'none';
      if (sidebarUserName) sidebarUserName.textContent = 'Guest Operator';
      if (sidebarUserAvatar) sidebarUserAvatar.textContent = 'GO';
      
      if (window.lucide && landingPortal) {
        window.lucide.createIcons({ root: landingPortal });
      }
    }
  }

  // Initialize Supabase auth service listener
  authService.init((user) => {
    updateUIForUser(user);
  });

  // Check cached user
  const initialUser = authService.getCurrentUser();
  updateUIForUser(initialUser);

  // Tab toggling for modal
  tabSignIn?.addEventListener('click', () => {
    mode = 'signin';
    tabSignIn.classList.add('active');
    tabSignUp.classList.remove('active');
    if (authTitle) authTitle.textContent = 'Sign In';
    if (btnAuthLabel) btnAuthLabel.textContent = 'Sign In';
    if (groupUsername) groupUsername.style.display = 'none';
    if (authAlert) authAlert.style.display = 'none';
  });

  tabSignUp?.addEventListener('click', () => {
    mode = 'signup';
    tabSignUp.classList.add('active');
    tabSignIn.classList.remove('active');
    if (authTitle) authTitle.textContent = 'Create Account';
    if (btnAuthLabel) btnAuthLabel.textContent = 'Create Account';
    if (groupUsername) groupUsername.style.display = 'flex';
    if (authAlert) authAlert.style.display = 'none';
  });

  btnOpenAuth?.addEventListener('click', () => {
    if (authAlert) authAlert.style.display = 'none';
    modalAuth?.showModal();
  });

  btnCloseAuth?.addEventListener('click', () => modalAuth?.close());
  btnCancelAuth?.addEventListener('click', () => modalAuth?.close());

  // Logout handler
  btnLogout?.addEventListener('click', async () => {
    await authService.signOut();
    updateUIForUser(null);
    realtime.showToast('Session Terminated', 'You have been successfully signed out.', 'info');
  });

  // Modal Auth Form Submit
  formAuth?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const username = document.getElementById('auth-username')?.value.trim();

    if (authAlert) authAlert.style.display = 'none';
    const submitBtn = document.getElementById('btn-submit-auth');
    if (submitBtn) submitBtn.disabled = true;

    try {
      let result;
      if (mode === 'signup') {
        result = await authService.signUp(username, email, password);
        realtime.showToast('Account Created', `Welcome to AI ECOSYSTEM, ${result.user?.full_name || username}!`, 'success');
      } else {
        result = await authService.signIn(email, password);
        realtime.showToast('Authorized', `Welcome back, ${result.user?.full_name || email}!`, 'success');
      }
      modalAuth?.close();
      formAuth.reset();
      updateUIForUser(result.user);
    } catch (err) {
      if (authAlert) {
        authAlert.style.display = 'block';
        authAlert.className = 'auth-alert error';
        authAlert.textContent = err.message || 'Authentication error. Please check credentials.';
      }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  // ==========================================
  // Landing Portal Auth Wiring & Modals
  // ==========================================
  function openAuthModal(targetMode = 'signin') {
    if (authAlert) authAlert.style.display = 'none';
    if (targetMode === 'signup') {
      tabSignUp?.click();
    } else {
      tabSignIn?.click();
    }
    modalAuth?.showModal();
  }

  // All Sign-In Buttons on Landing Page
  const signInButtonIds = [
    'landing-nav-signin-btn',
    'landing-hero-signin-btn',
    'landing-bottom-signin-btn',
    'landing-footer-signin-btn'
  ];
  signInButtonIds.forEach(id => {
    document.getElementById(id)?.addEventListener('click', (e) => {
      e.preventDefault();
      openAuthModal('signin');
    });
  });

  // All Sign-Up Buttons on Landing Page
  const signUpButtonIds = [
    'landing-nav-signup-btn',
    'landing-hero-signup-btn',
    'landing-bottom-signup-btn',
    'landing-footer-signup-btn'
  ];
  signUpButtonIds.forEach(id => {
    document.getElementById(id)?.addEventListener('click', (e) => {
      e.preventDefault();
      openAuthModal('signup');
    });
  });

  // One-Click Demo Login Handlers
  async function triggerDemoLogin() {
    try {
      realtime.showToast('Demo Access', 'Signing in as Executive Administrator...', 'info');
      const result = await authService.signIn('admin@aiecosystem.internal', 'admin123456');
      modalAuth?.close();
      updateUIForUser(result.user);
      realtime.showToast('Authorized', 'Welcome to AI ECOSYSTEM Executive Terminal!', 'success');
      window.location.hash = '#overview';
    } catch (err) {
      alert(`Demo login error: ${err.message}`);
    }
  }

  document.getElementById('landing-hero-demo-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    triggerDemoLogin();
  });

  document.getElementById('btn-modal-demo-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    triggerDemoLogin();
  });

  // Safe backdrop click closing (clicking dialog itself closes, clicking inside modal-card does not)
  document.querySelectorAll('dialog.modal-dialog').forEach(dialog => {
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        dialog.close();
      }
    });
  });

  // Smooth scroll for landing nav anchor links
  document.querySelectorAll('.landing-nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (href && href.startsWith('#landing-')) {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });
}
