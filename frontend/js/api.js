// API Client for AI ECOSYSTEM Backend

const API_BASE = ''; // relative path for same-origin serving

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('access_token') || null;
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('access_token', token);
    } else {
      localStorage.removeItem('access_token');
    }
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const activeToken = localStorage.getItem('access_token') || this.token;
    if (activeToken) {
      headers['Authorization'] = `Bearer ${activeToken}`;
    }

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, config);
      if (!response.ok) {
        let errDetail = 'Request failed';
        try {
          const errData = await response.json();
          errDetail = errData.detail || errData.message || JSON.stringify(errData);
        } catch (_) {
          errDetail = response.statusText;
        }
        throw new Error(errDetail);
      }
      return await response.json();
    } catch (err) {
      console.error(`API Error on ${endpoint}:`, err);
      throw err;
    }
  }

  // Auth
  async login(email, password) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    this.setToken(data.access_token);
    return data;
  }

  async getMe() {
    return await this.request('/api/auth/me');
  }

  // Agents
  async getAgents() {
    return await this.request('/api/agents');
  }

  async getAgent(id) {
    return await this.request(`/api/agents/${id}`);
  }

  async getAgentHistory(id) {
    return await this.request(`/api/agents/${id}/history`);
  }

  async chatWithAgent(id, message) {
    return await this.request(`/api/agents/${id}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message })
    });
  }

  // Tasks
  async getTasks(params = {}) {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.department) query.append('department', params.department);
    if (params.agent_id) query.append('agent_id', params.agent_id);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return await this.request(`/api/tasks${qs}`);
  }

  async getTask(id) {
    return await this.request(`/api/tasks/${id}`);
  }

  async createTask(taskData) {
    return await this.request('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData)
    });
  }

  async retryTask(id) {
    return await this.request(`/api/tasks/${id}/retry`, { method: 'POST' });
  }

  async cancelTask(id) {
    return await this.request(`/api/tasks/${id}/cancel`, { method: 'POST' });
  }

  async approveTask(id) {
    return await this.request(`/api/tasks/${id}/approve`, { method: 'POST' });
  }

  async rejectTask(id) {
    return await this.request(`/api/tasks/${id}/reject`, { method: 'POST' });
  }

  // Workflows
  async getWorkflows(params = {}) {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return await this.request(`/api/workflows${qs}`);
  }

  async getWorkflow(id) {
    return await this.request(`/api/workflows/${id}`);
  }

  async createWorkflow(objective, title = null) {
    return await this.request('/api/workflows', {
      method: 'POST',
      body: JSON.stringify({ objective, title })
    });
  }

  // AI Chat
  async chatCEO(message) {
    return await this.request('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message })
    });
  }

  // Memory
  async getRecentMemories() {
    return await this.request('/api/memory/recent');
  }

  async searchMemories(query, agentId = null) {
    return await this.request('/api/memory/search', {
      method: 'POST',
      body: JSON.stringify({ query, agent_id: agentId })
    });
  }

  async addMemory(content, agentId = 'global', category = 'manual') {
    return await this.request('/api/memory', {
      method: 'POST',
      body: JSON.stringify({ content, agent_id: agentId, category })
    });
  }

  // Activity Logs
  async getLogs(params = {}) {
    const query = new URLSearchParams();
    if (params.level) query.append('level', params.level);
    if (params.agent_id) query.append('agent_id', params.agent_id);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return await this.request(`/api/logs${qs}`);
  }

  // Analytics
  async getAnalytics() {
    return await this.request('/api/analytics');
  }

  // Settings
  async getSettings() {
    return await this.request('/api/settings');
  }

  async updateSettings(settings) {
    return await this.request('/api/settings', {
      method: 'POST',
      body: JSON.stringify({ settings })
    });
  }

  async testLLM() {
    return await this.request('/api/settings/test-llm', { method: 'POST' });
  }
}

export const api = new ApiClient();
