// ============================================================
// db.js — Frontend API Client
// ============================================================

const API = window.location.hostname === 'localhost'
  ? 'http://localhost:8888/api'
  : '/.netlify/functions';

// ---- Session cache di sessionStorage (bertahan selama tab terbuka) ----
const _SC = {
  get(key) { try { const d = sessionStorage.getItem('kp_cache_'+key); return d ? JSON.parse(d) : null; } catch { return null; } },
  set(key, val) { try { sessionStorage.setItem('kp_cache_'+key, JSON.stringify(val)); } catch {} },
  clear(key) { sessionStorage.removeItem('kp_cache_'+key); }
};

// ---- Session token helper ----
function getToken() {
  return sessionStorage.getItem('kp_token') || '';
}

function setToken(token) {
  sessionStorage.setItem('kp_token', token);
}

function clearToken() {
  sessionStorage.removeItem('kp_token');
  sessionStorage.removeItem('kp_user');
  sessionStorage.removeItem('kp_expires');
}

function getStoredUser() {
  try { return JSON.parse(sessionStorage.getItem('kp_user')); } catch { return null; }
}

function setStoredUser(user, expiresAt) {
  sessionStorage.setItem('kp_user', JSON.stringify(user));
  sessionStorage.setItem('kp_expires', expiresAt);
}

// ---- Core fetch wrapper ----
async function apiFetch(path, options = {}) {
  const token = getToken();
  // Convert /auth?action=login → /auth?action=login (keep as-is)
  // API base is now /.netlify/functions so path /auth → /.netlify/functions/auth
  const url = API + path;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'X-Session-Token': token } : {}),
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const json = await res.json().catch(() => ({ ok: false, error: 'Server error' }));

  if (res.status === 401) {
    clearToken();
    window.location.href = '/login.html';
    return null;
  }

  return json;
}

// ============================================================
//  AUTH
// ============================================================
const DB_AUTH = {
  async login(username, password) {
    const res = await apiFetch('/auth?action=login', {
      method: 'POST',
      body: { username, password }
    });
    if (!res) return { ok: false, reason: 'network' };
    if (!res.ok) return { ok: false, reason: res.error };
    setToken(res.data.token);
    setStoredUser(res.data.user, res.data.expiresAt);
    return { ok: true, user: res.data.user };
  },

  async logout() {
    await apiFetch('/auth?action=logout', { method: 'POST' });
    clearToken();
  },

  async me() {
    const res = await apiFetch('/auth?action=me');
    if (!res?.ok) return null;
    setStoredUser(res.data.user, res.data.expiresAt);
    return res.data.user;
  },

  async changePassword(oldPassword, newPassword) {
    const res = await apiFetch('/auth?action=change-password', {
      method: 'POST',
      body: { oldPassword, newPassword }
    });
    return res;
  },

  async getUsers() {
    const res = await apiFetch('/auth?action=users');
    return res?.data || [];
  },

  async addUser(username, password, displayName, role) {
    return apiFetch('/auth?action=add-user', {
      method: 'POST',
      body: { username, password, displayName, role }
    });
  },

  async deleteUser(id) {
    return apiFetch(`/auth?action=delete-user&id=${id}`, { method: 'DELETE' });
  },

  async getLogs() {
    const res = await apiFetch('/auth?action=logs');
    return res?.data || [];
  },

  getSessionUser() { return getStoredUser(); },
  getToken,
  isLoggedIn() { return !!getToken() && !!getStoredUser(); }
};

// ============================================================
//  CUSTOMERS
// ============================================================
const DB_CUSTOMERS = {
  async getAll() {
    const res = await apiFetch('/customers');
    return res?.data || [];
  },

  async getById(id) {
    const res = await apiFetch(`/customers?id=${id}`);
    return res?.data || null;
  },

  async create(customer) {
    return apiFetch('/customers', { method: 'POST', body: customer });
  },

  async update(id, customer) {
    return apiFetch(`/customers?id=${id}`, { method: 'PUT', body: customer });
  },

  async delete(id) {
    return apiFetch(`/customers?id=${id}`, { method: 'DELETE' });
  },

  async nextId() {
    const res = await apiFetch('/customers?action=next-id', { method: 'POST', body: {} });
    return res?.data?.id || 'N001';
  }
};

// ============================================================
//  PAYMENTS
// ============================================================
const DB_PAYMENTS = {
  async getAll() {
    const res = await apiFetch('/payments');
    return res?.data || [];
  },

  async getByCustomer(customerId) {
    const res = await apiFetch(`/payments?customerId=${customerId}`);
    return (res?.data || []).sort((a, b) => new Date(a.tgl) - new Date(b.tgl));
  },

  async create(payment) {
    return apiFetch('/payments', { method: 'POST', body: payment });
  },

  async update(id, payment) {
    return apiFetch(`/payments?id=${id}`, { method: 'PUT', body: payment });
  },

  async delete(id) {
    return apiFetch(`/payments?id=${id}`, { method: 'DELETE' });
  },

  async nextId() {
    const res = await apiFetch('/payments?action=next-id', { method: 'POST', body: {} });
    return res?.data?.id || 'P001';
  }
};

// ============================================================
//  PHOTOS
// ============================================================
const DB_PHOTOS = {
  // Returns { cust: 'data:...', item_0: 'data:...', ... }
  async getByCustomer(customerId) {
    const res = await apiFetch(`/photos?customerId=${customerId}`);
    return res?.data || {};
  },

  async saveAll(customerId, photosObj) {
    // photosObj = { cust: 'data:...', item_0: 'data:...', ... }
    return apiFetch('/photos?action=bulk', {
      method: 'POST',
      body: { customerId, photos: photosObj }
    });
  },

  async delete(customerId, photoType = null) {
    const params = `customerId=${customerId}${photoType ? '&type=' + photoType : ''}`;
    return apiFetch(`/photos?${params}`, { method: 'DELETE' });
  }
};

// ============================================================
//  WA LOGS
// ============================================================
const DB_WALOGS = {
  async getAll() {
    const res = await apiFetch('/walogs');
    return res?.data || [];
  },

  async add(entry) {
    return apiFetch('/walogs', { method: 'POST', body: entry });
  },

  async clearAll() {
    return apiFetch('/walogs', { method: 'DELETE' });
  }
};

// ============================================================
//  IN-MEMORY CACHE  — mengurangi API calls berulang
// ============================================================
const _cache = {
  customers: null,
  payments:  null,
  photos:    {},
  dirty:     { customers: true, payments: true }
};

const DB = {
  auth:      DB_AUTH,
  customers: DB_CUSTOMERS,
  payments:  DB_PAYMENTS,
  photos:    DB_PHOTOS,
  walogs:    DB_WALOGS,

  // Expose cache publicly
  _cache,

  // ---- cached getters ----
  async getCustomers(force = false) {
    if (!force && _cache.customers?.length) return _cache.customers;
    // Cek sessionStorage cache dulu
    if (!force) {
      const cached = _SC.get('customers');
      if (cached?.length) { _cache.customers = cached; return cached; }
    }
    console.log('[DB] Loading customers from Supabase...');
    _cache.customers = await DB_CUSTOMERS.getAll();
    _SC.set('customers', _cache.customers);
    console.log('[DB] Loaded', _cache.customers.length, 'customers');
    return _cache.customers || [];
  },

  async getPayments(force = false) {
    if (!force && _cache.payments?.length) return _cache.payments;
    // Cek sessionStorage cache dulu
    if (!force) {
      const cached = _SC.get('payments');
      if (cached?.length) { _cache.payments = cached; return cached; }
    }
    console.log('[DB] Loading payments from Supabase...');
    _cache.payments = await DB_PAYMENTS.getAll();
    _SC.set('payments', _cache.payments);
    console.log('[DB] Loaded', _cache.payments.length, 'payments');
    return _cache.payments || [];
  },

  invalidateCustomers() { _cache.customers = null; _SC.clear('customers'); },
  invalidatePayments()  { _cache.payments  = null; _SC.clear('payments');  },

  async getPhotos(customerId) {
    if (!_cache.photos[customerId]) {
      _cache.photos[customerId] = await DB_PHOTOS.getByCustomer(customerId);
    }
    return _cache.photos[customerId] || {};
  },

  invalidatePhotos(customerId) { delete _cache.photos[customerId]; }
};
