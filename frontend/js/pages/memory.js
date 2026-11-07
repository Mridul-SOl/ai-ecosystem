import { api } from '../api.js';

export async function renderMemory(container) {
  container.innerHTML = `
    <div class="fade-in">
      <div class="page-header-row">
        <div>
          <h2 class="page-title">Semantic Vector Memory</h2>
          <p class="page-description">Persistent knowledge base and agent episodic memory indexed in ChromaDB.</p>
        </div>
        <div>
          <button class="btn btn-primary btn-sm" id="btn-show-add-memory">
            <i data-lucide="plus"></i> Index Knowledge
          </button>
        </div>
      </div>

      <!-- Add Knowledge Collapsible Panel -->
      <div id="add-memory-panel" style="display:none; background:var(--bg-card); border:1px solid var(--border-medium); border-radius:var(--radius-md); padding:20px; margin-bottom:20px;">
        <h3 style="font-size:14px; font-weight:600; margin-bottom:12px; color:var(--text-primary);">Index Document / Strategic Policy</h3>
        <form id="form-add-memory" style="display:flex; flex-direction:column; gap:12px;">
          <div class="form-row">
            <div class="form-group">
              <label>Agent / Department Scope</label>
              <select id="mem-agent-select">
                <option value="global">Company-Wide (Global Knowledge)</option>
                <option value="ceo">CEO Agent</option>
                <option value="marketing">Marketing Department</option>
                <option value="finance">Finance Department</option>
                <option value="operations">Operations Department</option>
                <option value="research">Research Department</option>
                <option value="security">Security Department</option>
                <option value="infrastructure">Infrastructure Department</option>
                <option value="hr">HR Department</option>
              </select>
            </div>
            <div class="form-group">
              <label>Category Tag</label>
              <input type="text" id="mem-cat-input" placeholder="e.g. brand_guidelines, compliance_policy, pricing_model" />
            </div>
          </div>
          <div class="form-group">
            <label>Knowledge Text / Document Content *</label>
            <textarea id="mem-content-input" rows="3" required placeholder="Paste corporate policy, benchmark criteria, or historical business decision..."></textarea>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:10px;">
            <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-add-memory">Cancel</button>
            <button type="submit" class="btn btn-primary btn-sm"><i data-lucide="save"></i> Save into Vector DB</button>
          </div>
        </form>
      </div>

      <!-- Search Bar -->
      <div style="background:var(--bg-card); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:16px; margin-bottom:24px;">
        <form id="form-memory-search" style="display:flex; gap:12px; align-items:center;">
          <div class="global-search-bar" style="flex:1;">
            <i data-lucide="search" class="search-icon"></i>
            <input type="text" id="memory-search-query" placeholder="Ask questions or search semantic memories (e.g. 'clothing brand budget recommendations')..." required />
          </div>
          <select id="memory-search-agent" class="btn btn-secondary btn-sm" style="height:38px;">
            <option value="all">All Agents</option>
            <option value="ceo">CEO</option>
            <option value="marketing">Marketing</option>
            <option value="finance">Finance</option>
            <option value="research">Research</option>
            <option value="operations">Operations</option>
            <option value="security">Security</option>
            <option value="infrastructure">Infrastructure</option>
            <option value="hr">HR</option>
          </select>
          <button type="submit" class="btn btn-primary btn-sm" style="height:38px;">
            <i data-lucide="search"></i> Search Vectors
          </button>
        </form>
      </div>

      <!-- Memory Results & Recent Feed -->
      <div class="workflow-card">
        <div class="workflow-card-header">
          <div class="workflow-title-wrap">
            <h3 id="memory-results-title">Recent Knowledge & Vector Memories</h3>
            <p class="workflow-objective-text" id="memory-results-subtitle">Latest indexed episodic records across all agents</p>
          </div>
        </div>
        <div id="memory-items-list" style="display:flex; flex-direction:column; gap:12px; margin-top:14px;">
          <div style="color:var(--text-muted); font-size:12px;">Loading vector memories...</div>
        </div>
      </div>
    </div>
  `;

  const addPanel = container.querySelector('#add-memory-panel');
  container.querySelector('#btn-show-add-memory')?.addEventListener('click', () => {
    addPanel.style.display = addPanel.style.display === 'none' ? 'block' : 'none';
  });
  container.querySelector('#btn-cancel-add-memory')?.addEventListener('click', () => {
    addPanel.style.display = 'none';
  });

  // Handle Add Memory
  container.querySelector('#form-add-memory')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = container.querySelector('#mem-content-input').value.trim();
    const agentId = container.querySelector('#mem-agent-select').value;
    const cat = container.querySelector('#mem-cat-input').value.trim() || 'general';

    try {
      await api.addMemory(content, agentId, cat);
      addPanel.style.display = 'none';
      container.querySelector('#mem-content-input').value = '';
      loadRecentMemories(container);
    } catch (err) {
      alert(`Failed to index memory: ${err.message}`);
    }
  });

  // Handle Search
  container.querySelector('#form-memory-search')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = container.querySelector('#memory-search-query').value.trim();
    const agentId = container.querySelector('#memory-search-agent').value;
    if (!query) return;

    const list = container.querySelector('#memory-items-list');
    list.innerHTML = `<div style="color:var(--text-muted); font-size:12px;">Searching vector embeddings...</div>`;

    try {
      const resp = await api.searchMemories(query, agentId === 'all' ? null : agentId);
      container.querySelector('#memory-results-title').textContent = `Semantic Matches for: "${query}"`;
      container.querySelector('#memory-results-subtitle').textContent = `Found ${resp.results.length} vector embeddings`;
      renderMemoryCards(list, resp.results);
    } catch (err) {
      list.innerHTML = `<div style="color:var(--error); font-size:12px;">Search failed: ${err.message}</div>`;
    }
  });

  await loadRecentMemories(container);
  if (window.lucide) window.lucide.createIcons();
}

async function loadRecentMemories(container) {
  const list = container.querySelector('#memory-items-list');
  if (!list) return;

  try {
    const data = await api.getRecentMemories();
    renderMemoryCards(list, data.memories || []);
  } catch (err) {
    list.innerHTML = `<div style="color:var(--error); font-size:12px;">Failed to load memories: ${err.message}</div>`;
  }
}

function renderMemoryCards(listContainer, items) {
  if (!items || items.length === 0) {
    listContainer.innerHTML = `<div style="color:var(--text-muted); font-size:12px; padding:20px; text-align:center;">No memory records found matching query.</div>`;
    return;
  }

  listContainer.innerHTML = items.map(m => {
    const text = m.text || m.document || '';
    const meta = m.metadata || {};
    const agentTag = meta.agent_id || meta.category || 'global';
    const timestamp = meta.timestamp ? new Date(meta.timestamp).toLocaleString() : 'Recent';
    const parsed = window.marked ? window.marked.parse(text) : text;

    return `
      <div style="background:var(--bg-elevated); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-size:11px;">
          <div style="display:flex; gap:8px; align-items:center;">
            <span style="background:rgba(99,102,241,0.15); color:var(--accent); padding:2px 8px; border-radius:4px; font-weight:600;">
              ${agentTag.toUpperCase()}
            </span>
            ${meta.category ? `<span style="color:var(--text-muted);">${meta.category}</span>` : ''}
          </div>
          <span style="color:var(--text-muted);">${timestamp}</span>
        </div>
        <div style="font-size:13px; color:var(--text-primary); line-height:1.5; max-height:160px; overflow-y:auto;">
          ${parsed}
        </div>
      </div>
    `;
  }).join('');
}
