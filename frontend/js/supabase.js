// Supabase Client & Authentication Service
// Credentials provided for AI ECOSYSTEM
export const SUPABASE_URL = 'https://ydrwdyerkikqxtdlmytc.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_wtRPHFAEgVlge9YXv8GbZA_OY_w6L5C';

let supabaseClient = null;

export function getSupabase() {
  if (supabaseClient) return supabaseClient;
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    });
    return supabaseClient;
  }
  return null;
}

export const authService = {
  client: null,

  init(onAuthChangeCallback) {
    this.client = getSupabase();
    if (!this.client) {
      console.warn('[Supabase] Waiting for Supabase CDN library to load...');
      setTimeout(() => this.init(onAuthChangeCallback), 300);
      return;
    }

    // Listen to Supabase auth state changes
    this.client.auth.onAuthStateChange(async (event, session) => {
      console.log(`[Supabase Auth] Event: ${event}`);
      if (session && session.user) {
        const user = await this.syncWithBackend(session);
        if (onAuthChangeCallback) onAuthChangeCallback(user, session);
      } else {
        localStorage.removeItem('access_token');
        localStorage.removeItem('current_user');
        if (onAuthChangeCallback) onAuthChangeCallback(null, null);
      }
    });

    // Check existing session
    this.checkInitialSession(onAuthChangeCallback);
  },

  async checkInitialSession(callback) {
    if (!this.client) return;
    try {
      const { data: { session } } = await this.client.auth.getSession();
      if (session && session.user) {
        const user = await this.syncWithBackend(session);
        if (callback) callback(user, session);
      }
    } catch (err) {
      console.error('[Supabase Auth] Session check error:', err);
    }
  },

  /**
   * Register with Username, Email, and Password.
   * "Confirming email should not be the option added" - User is instantly authorized.
   */
  async signUp(username, email, password) {
    const cleanUsername = (username || email.split('@')[0]).trim();
    const cleanEmail = email.trim().toLowerCase();

    const client = getSupabase();
    let supaUser = null;

    if (client) {
      try {
        const { data, error } = await client.auth.signUp({
          email: cleanEmail,
          password: password,
          options: {
            data: {
              username: cleanUsername,
              full_name: cleanUsername
            }
          }
        });

        if (error) {
          if (error.message && error.message.toLowerCase().includes('already registered')) {
            return await this.signIn(cleanEmail, password);
          }
          console.warn('[Supabase SignUp Warning]', error.message);
        } else if (data) {
          supaUser = data.user;
          if (data.session) {
            const user = await this.syncWithBackend(data.session, cleanUsername);
            return { user, session: data.session };
          }
        }
      } catch (supaErr) {
        console.warn('[Supabase SignUp Exception]', supaErr);
      }
    }

    // Direct synchronization with backend with password hash stored
    // Instant authorization without email confirmation barrier
    const syncRes = await fetch('/api/auth/supabase-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: supaUser?.id || `usr-${Date.now()}`,
        email: cleanEmail,
        username: cleanUsername,
        password: password,
        role: 'member'
      })
    });

    if (!syncRes.ok) {
      const errData = await syncRes.json().catch(() => ({}));
      throw new Error(errData.detail || 'Failed to create account. Please verify your details.');
    }

    const syncData = await syncRes.json();
    localStorage.setItem('access_token', syncData.access_token);
    localStorage.setItem('current_user', JSON.stringify(syncData.user));
    return { user: syncData.user, session: null };
  },

  /**
   * Sign In with Email or Username and Password
   */
  async signIn(emailOrUsername, password) {
    let email = emailOrUsername.trim().toLowerCase();
    const client = getSupabase();

    // 1. Try Supabase Auth if client loaded and is valid email
    if (client && email.includes('@')) {
      try {
        const { data, error } = await client.auth.signInWithPassword({
          email: email,
          password: password
        });

        if (!error && data?.session) {
          const user = await this.syncWithBackend(data.session);
          return { user, session: data.session };
        }

        if (error) {
          console.warn('[Supabase SignIn Info]', error.message);
        }
      } catch (e) {
        console.warn('[Supabase SignIn Exception]', e);
      }
    }

    // 2. Resilient Fallback: Authenticate directly against backend
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailOrUsername.trim(), password: password })
    });

    if (res.ok) {
      const localData = await res.json();
      localStorage.setItem('access_token', localData.access_token);
      localStorage.setItem('current_user', JSON.stringify(localData.user));
      return { user: localData.user, session: null };
    }

    // 3. If user signed up via Supabase but email unconfirmed, auto-confirm via sync
    const autoSyncRes = await fetch('/api/auth/supabase-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: `usr-${Date.now()}`,
        email: email.includes('@') ? email : `${email}@aiecosystem.internal`,
        username: email.split('@')[0],
        password: password,
        role: 'member'
      })
    });

    if (autoSyncRes.ok) {
      const syncData = await autoSyncRes.json();
      localStorage.setItem('access_token', syncData.access_token);
      localStorage.setItem('current_user', JSON.stringify(syncData.user));
      return { user: syncData.user, session: null };
    }

    throw new Error('Invalid email or password. Please verify credentials or create a new account.');
  },

  /**
   * Sign Out
   */
  async signOut() {
    const client = getSupabase();
    if (client) {
      try {
        await client.auth.signOut();
      } catch (e) {
        console.warn('Supabase sign out error:', e);
      }
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('current_user');
  },

  /**
   * Synchronize Supabase user into our SQLite database
   */
  async syncWithBackend(session, fallbackUsername = null) {
    if (!session || !session.user) return null;

    const u = session.user;
    const username = u.user_metadata?.username || u.user_metadata?.full_name || fallbackUsername || u.email.split('@')[0];

    try {
      const res = await fetch('/api/auth/supabase-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          id: u.id,
          email: u.email,
          username: username,
          role: 'member'
        })
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('access_token', session.access_token || data.access_token);
        localStorage.setItem('current_user', JSON.stringify(data.user));
        return data.user;
      }
    } catch (err) {
      console.warn('Backend user sync warning:', err);
    }

    // Fallback cached user representation
    const fallbackUser = {
      id: u.id,
      email: u.email,
      full_name: username,
      role: 'member'
    };
    localStorage.setItem('access_token', session.access_token);
    localStorage.setItem('current_user', JSON.stringify(fallbackUser));
    return fallbackUser;
  },

  getCurrentUser() {
    try {
      const raw = localStorage.getItem('current_user');
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  },

  isAuthenticated() {
    const token = localStorage.getItem('access_token');
    const user = this.getCurrentUser();
    return !!(token && user);
  }
};
