// WebSocket & Real-time Manager with Serverless Polling Fallback

class RealtimeClient {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectDelay = 10000;
    this.isPollingFallback = false;
    this.pollInterval = null;
  }

  connect() {
    // If running on Vercel (vercel.app domain), serverless functions don't support persistent WebSockets
    if (window.location.hostname.includes('vercel.app')) {
      console.log('[Realtime] Vercel environment detected; enabling serverless polling fallback.');
      this.startPollingFallback();
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host || 'localhost:8000';
    const wsUrl = `${protocol}//${host}/ws`;

    console.log(`[WS] Connecting to ${wsUrl}...`);
    this.updateStatusUI('connecting');

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log('[WS] Connected successfully.');
        this.reconnectAttempts = 0;
        this.updateStatusUI('connected');
        this.notify('ws_connected', {});
      };

      this.socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.handleEvent(payload);
        } catch (e) {
          console.warn('[WS] Failed to parse message:', event.data);
        }
      };

      this.socket.onclose = () => {
        console.warn('[WS] Disconnected.');
        if (this.reconnectAttempts >= 3) {
          console.log('[WS] Falling back to polling mode for serverless compatibility.');
          this.startPollingFallback();
        } else {
          this.updateStatusUI('disconnected');
          this.scheduleReconnect();
        }
      };

      this.socket.onerror = (err) => {
        console.warn('[WS] Socket error:', err);
      };
    } catch (err) {
      console.warn('[WS] Connection exception:', err);
      this.startPollingFallback();
    }
  }

  startPollingFallback() {
    if (this.isPollingFallback) return;
    this.isPollingFallback = true;
    this.updateStatusUI('connected');

    console.log('[Realtime] Polling engine activated (3.5s interval).');
    this.pollInterval = setInterval(async () => {
      try {
        const resp = await fetch('/api/analytics');
        if (resp.ok) {
          const data = await resp.json();
          this.notify('task_updated', data);
        }
      } catch (_) {
        // silent
      }
    }, 3500);
  }

  scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), this.maxReconnectDelay);
    setTimeout(() => this.connect(), delay);
  }

  updateStatusUI(status) {
    const dot = document.querySelector('.system-status-pill .status-dot');
    const text = document.getElementById('ws-status-text');
    if (!dot || !text) return;

    if (status === 'connected') {
      dot.className = 'status-dot online';
      text.textContent = this.isPollingFallback ? 'Live (Serverless)' : 'Live System';
    } else if (status === 'connecting') {
      dot.className = 'status-dot';
      dot.style.backgroundColor = 'var(--warning)';
      text.textContent = 'Connecting...';
    } else {
      dot.className = 'status-dot offline';
      text.textContent = 'Offline (Reconnecting)';
    }
  }

  handleEvent(payload) {
    const { type, data } = payload;
    if (this.listeners.has(type)) {
      this.listeners.get(type).forEach((cb) => cb(data));
    }
    if (this.listeners.has('*')) {
      this.listeners.get('*').forEach((cb) => cb(type, data));
    }

    if (type === 'approval_required' || (type === 'task_updated' && data?.requires_approval)) {
      this.showToast('Approval Required', 'A consequential task requires your explicit authorization.', 'warn');
    } else if (type === 'workflow_completed') {
      this.showToast('Workflow Finalized', 'CEO has consolidated the cross-department strategy.', 'success');
    } else if (type === 'agent_status_changed' && data.status === 'error') {
      this.showToast('Agent Error', `Agent ${data.agent_id} reported an operational error.`, 'error');
    }
  }

  subscribe(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(callback);
    return () => {
      const list = this.listeners.get(eventType);
      const idx = list.indexOf(callback);
      if (idx !== -1) list.splice(idx, 1);
    };
  }

  notify(eventType, data) {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).forEach((cb) => cb(data));
    }
  }

  showToast(title, message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'info';
    if (type === 'success') icon = 'check-circle';
    if (type === 'warn') icon = 'alert-triangle';
    if (type === 'error') icon = 'alert-octagon';

    toast.innerHTML = `
      <i data-lucide="${icon}" class="toast-icon"></i>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-msg">${message}</div>
      </div>
    `;

    container.appendChild(toast);
    if (window.lucide) window.lucide.createIcons({ root: toast });

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  }
}

export const realtime = new RealtimeClient();
