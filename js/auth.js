/* auth.js — EcoLens Authentication Module
   Signup / Signin / Signout with Supabase Auth (email confirmation)
   Injects auth button into nav, renders modal popup
   ============================================================ */

const { SUPABASE_URL, SUPABASE_KEY } = window.EcoLensApiKeys || {};
const authDb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let authModalEl = null;
let passwordRecoveryPending = false;

// ── Session ─────────────────────────────────────────────────
async function initSession() {
  const { data: { session } } = await authDb.auth.getSession();
  currentUser = session?.user ?? null;

  // Kiểm tra password recovery (từ URL hash hoặc event đã miss)
  if (passwordRecoveryPending || (window.location.hash && window.location.hash.includes('type=recovery'))) {
    showResetPasswordModal();
    passwordRecoveryPending = false;
  }

  renderAuthUI();
}

function showResetPasswordModal() {
  if (!authModalEl) buildAuthModal();
  const tabs = authModalEl.querySelector('#auth-tabs');
  const heading = authModalEl.querySelector('#auth-reset-heading');
  if (tabs) tabs.style.display = 'none';
  if (heading) heading.style.display = 'block';
  authModalEl.querySelectorAll('.auth-form').forEach(f => f.style.display = 'none');
  const form = authModalEl.querySelector('#auth-reset-form');
  if (form) form.style.display = 'block';
  authModalEl.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

// ── Event helpers ────────────────────────────────────────────
function dispatchAuthEvent(type, user) {
  window.dispatchEvent(new CustomEvent('ecolens-auth-change', {
    detail: { type, user }
  }));
}

// ── Auth actions ─────────────────────────────────────────────
function getBaseUrl() {
  let path = window.location.pathname;
  if (path.endsWith('.html')) path = path.substring(0, path.lastIndexOf('/') + 1);
  if (!path.endsWith('/')) path += '/';
  return window.location.origin + path;
}

async function handleSignup(email, password) {
  const { data, error } = await authDb.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: getBaseUrl() }
  });
  if (error) throw error;
  return data;
}

async function handleSignin(email, password) {
  const { data, error } = await authDb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  currentUser = data.user;
  dispatchAuthEvent('signin', currentUser);
  closeAuthModal();
  renderAuthUI();
}

async function handleSignout() {
  await authDb.auth.signOut();
  currentUser = null;
  dispatchAuthEvent('signout', null);
  renderAuthUI();
}

async function handleResetPassword(email) {
  const { error } = await authDb.auth.resetPasswordForEmail(email, {
    redirectTo: getBaseUrl()
  });
  if (error) throw error;
}

// ── Expose for other modules ─────────────────────────────────
window.EcoLensAuth = {
  getSession: () => authDb.auth.getSession(),
  getUser: () => currentUser,
  getDb: () => authDb,
  signOut: handleSignout,
};

// ── Render auth button in nav ───────────────────────────────
function renderAuthUI() {
  const navLinks = document.getElementById('nav-links');
  const ecoNavLinks = document.querySelector('.eco-nav-links');
  const mobileNav = document.querySelector('.mobile-nav');
  const ecoMobileNav = document.querySelector('.eco-mm-nav');

  if (currentUser) {
    const email = currentUser.email || 'User';
    const btnHtml = `<div style="display:inline-flex;align-items:center;gap:4px;">
      <button class="nav-link auth-btn" onclick="EcoLensAuth.signOut()" style="opacity:1;display:inline-flex;align-items:center;gap:6px;" title="Sign out">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        ${email}
      </button>
    </div>`;

    if (navLinks) {
      let existing = navLinks.querySelector('.auth-btn');
      if (existing) existing.remove();
      let existingApi = navLinks.querySelector('.api-keys-nav-link');
      if (existingApi) existingApi.remove();
      navLinks.insertAdjacentHTML('beforeend', btnHtml);
    }
    if (ecoNavLinks) {
      let existing = ecoNavLinks.querySelector('.auth-btn');
      if (existing) existing.remove();
      let existingApi = ecoNavLinks.querySelector('.api-keys-nav-link');
      if (existingApi) existingApi.remove();
      ecoNavLinks.insertAdjacentHTML('beforeend', btnHtml.replace('nav-link', 'eco-nav-link'));
    }

    const mobileBtnHtml = `<div style="display:flex;flex-direction:column;gap:6px;margin-top:1rem;border-top:1px solid rgba(255,255,255,.1);padding-top:1rem;">
      <button onclick="EcoLensAuth.signOut()" style="font-size:1.2rem;opacity:.6;text-align:left;background:none;border:none;color:#fff;cursor:pointer;">
        Sign out — ${email}
      </button>
    </div>`;

    if (mobileNav) {
      let existing = mobileNav.querySelector('.auth-mobile-btn');
      if (existing) existing.remove();
      let existingApi = mobileNav.querySelector('.api-keys-mobile-link');
      if (existingApi) existingApi.remove();
      mobileNav.insertAdjacentHTML('beforeend', `<div class="auth-mobile-btn">${mobileBtnHtml}</div>`);
    }
    if (ecoMobileNav) {
      let existing = ecoMobileNav.querySelector('.auth-mobile-btn');
      if (existing) existing.remove();
      let existingApi = ecoMobileNav.querySelector('.api-keys-mobile-link');
      if (existingApi) existingApi.remove();
      ecoMobileNav.insertAdjacentHTML('beforeend', `<div class="auth-mobile-btn">${mobileBtnHtml}</div>`);
    }
  } else {
    const btnHtml = `<button class="nav-link auth-btn" onclick="openAuthModal()" style="opacity:.7;display:inline-flex;align-items:center;gap:6px;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
      Sign In
    </button>`;

    if (navLinks) {
      let existing = navLinks.querySelector('.auth-btn');
      if (existing) existing.remove();
      let existingApi = navLinks.querySelector('.api-keys-nav-link');
      if (existingApi) existingApi.remove();
      navLinks.insertAdjacentHTML('beforeend', btnHtml);
    }
    if (ecoNavLinks) {
      let existing = ecoNavLinks.querySelector('.auth-btn');
      if (existing) existing.remove();
      let existingApi = ecoNavLinks.querySelector('.api-keys-nav-link');
      if (existingApi) existingApi.remove();
      ecoNavLinks.insertAdjacentHTML('beforeend', btnHtml.replace('nav-link', 'eco-nav-link'));
    }

    if (mobileNav) {
      let existing = mobileNav.querySelector('.auth-mobile-btn');
      if (existing) existing.remove();
      let existingApi = mobileNav.querySelector('.api-keys-mobile-link');
      if (existingApi) existingApi.remove();
      mobileNav.insertAdjacentHTML('beforeend', `<button class="auth-mobile-btn" onclick="openAuthModal()" style="font-size:1.2rem;opacity:.6;text-align:left;background:none;border:none;color:#fff;cursor:pointer;border-top:1px solid rgba(255,255,255,.1);padding-top:1rem;margin-top:1rem;">Sign In</button>`);
    }
    if (ecoMobileNav) {
      let existing = ecoMobileNav.querySelector('.auth-mobile-btn');
      if (existing) existing.remove();
      let existingApi = ecoMobileNav.querySelector('.api-keys-mobile-link');
      if (existingApi) existingApi.remove();
      ecoMobileNav.insertAdjacentHTML('beforeend', `<button class="auth-mobile-btn" onclick="openAuthModal()" style="font-size:1.2rem;opacity:.6;text-align:left;background:none;border:none;color:#fff;cursor:pointer;border-top:1px solid rgba(255,255,255,.1);padding-top:1rem;margin-top:1rem;">Sign In</button>`);
    }
  }
}

// ── Auth Modal ───────────────────────────────────────────────
function buildAuthModal() {
  const overlay = document.createElement('div');
  overlay.className = 'auth-overlay';
  overlay.id = 'auth-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.75);backdrop-filter:blur(6px);display:none;align-items:center;justify-content:center;';

  overlay.innerHTML = `
    <div class="auth-modal" style="background:#111;border:1px solid rgba(52,211,153,.25);border-radius:20px;padding:2.5rem;width:100%;max-width:420px;position:relative;box-shadow:0 0 60px rgba(0,0,0,.8);">
      <button onclick="closeAuthModal()" style="position:absolute;top:1rem;right:1rem;background:none;border:none;color:rgba(255,255,255,.4);cursor:pointer;font-size:1.5rem;line-height:1;">&times;</button>

      <div id="auth-tabs" style="display:flex;gap:1rem;margin-bottom:2rem;">
        <button class="auth-tab active" data-tab="signin" style="flex:1;padding:.75rem;background:rgba(52,211,153,.15);border:1px solid rgba(52,211,153,.4);border-radius:10px;color:#34d399;font-size:11px;text-transform:uppercase;letter-spacing:.2em;font-weight:700;cursor:pointer;">Sign In</button>
        <button class="auth-tab" data-tab="signup" style="flex:1;padding:.75rem;background:transparent;border:1px solid rgba(255,255,255,.1);border-radius:10px;color:rgba(255,255,255,.5);font-size:11px;text-transform:uppercase;letter-spacing:.2em;font-weight:700;cursor:pointer;">Register</button>
      </div>
      <h3 id="auth-reset-heading" style="display:none;font-family:var(--font-sans);font-size:1.1rem;font-weight:600;margin-bottom:1.5rem;color:#fff;text-align:center;">Reset Password</h3>

      <!-- Sign In Form -->
      <form class="auth-form" id="auth-signin-form" onsubmit="return false;">
        <div style="margin-bottom:1.25rem;">
          <label style="font-size:10px;text-transform:uppercase;letter-spacing:.15em;color:rgba(255,255,255,.4);display:block;margin-bottom:.5rem;">Email</label>
          <input type="email" class="auth-input" placeholder="you@example.com" required style="width:100%;padding:.85rem 1rem;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#fff;font-size:14px;outline:none;transition:border-color .2s;">
        </div>
        <div style="margin-bottom:0.75rem;">
          <label style="font-size:10px;text-transform:uppercase;letter-spacing:.15em;color:rgba(255,255,255,.4);display:block;margin-bottom:.5rem;">Password</label>
          <input type="password" class="auth-input" placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;" required style="width:100%;padding:.85rem 1rem;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#fff;font-size:14px;outline:none;transition:border-color .2s;">
        </div>
        <div style="text-align:right;margin-bottom:1.5rem;">
          <button type="button" class="auth-forgot-btn" style="background:none;border:none;color:rgba(52,211,153,.7);font-size:11px;cursor:pointer;letter-spacing:.05em;transition:color .2s;">Forgot password?</button>
        </div>
        <button type="submit" class="auth-submit" style="width:100%;padding:1rem;background:#059669;border:none;border-radius:12px;color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:.2em;font-weight:700;cursor:pointer;transition:background .2s;">Sign In</button>
        <div class="auth-error" style="color:#f87171;font-size:12px;margin-top:.75rem;display:none;"></div>
      </form>

      <!-- Forgot Password Form -->
      <form class="auth-form" id="auth-forgot-form" style="display:none;" onsubmit="return false;">
        <div style="margin-bottom:0.5rem;">
          <label style="font-size:10px;text-transform:uppercase;letter-spacing:.15em;color:rgba(255,255,255,.4);display:block;margin-bottom:.5rem;">Email</label>
          <input type="email" class="auth-input" placeholder="you@example.com" required style="width:100%;padding:.85rem 1rem;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#fff;font-size:14px;outline:none;transition:border-color .2s;">
        </div>
        <div style="margin-bottom:1.5rem;font-size:11px;color:rgba(255,255,255,.35);line-height:1.5;">
          Enter your email and we'll send you a link to reset your password.
        </div>
        <button type="submit" class="auth-submit" style="width:100%;padding:1rem;background:#059669;border:none;border-radius:12px;color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:.2em;font-weight:700;cursor:pointer;transition:background .2s;">Send Reset Link</button>
        <div class="auth-error" style="color:#f87171;font-size:12px;margin-top:.75rem;display:none;"></div>
        <div class="auth-success" style="color:#34d399;font-size:12px;margin-top:.75rem;display:none;"></div>
        <button type="button" class="auth-back-btn" style="background:none;border:none;color:rgba(255,255,255,.4);font-size:10px;cursor:pointer;margin-top:1rem;display:block;width:100%;text-align:center;text-transform:uppercase;letter-spacing:.15em;">&larr; Back to Sign In</button>
      </form>

      <!-- Reset Password Form (hiện sau khi click link trong email) -->
      <form class="auth-form" id="auth-reset-form" style="display:none;" onsubmit="return false;">
        <div style="margin-bottom:0.5rem;">
          <label style="font-size:10px;text-transform:uppercase;letter-spacing:.15em;color:rgba(255,255,255,.4);display:block;margin-bottom:.5rem;">New Password</label>
          <input type="password" class="auth-input" placeholder="Min. 6 characters" required minlength="6" style="width:100%;padding:.85rem 1rem;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#fff;font-size:14px;outline:none;transition:border-color .2s;">
        </div>
        <div style="margin-bottom:1.5rem;">
          <label style="font-size:10px;text-transform:uppercase;letter-spacing:.15em;color:rgba(255,255,255,.4);display:block;margin-bottom:.5rem;">Confirm New Password</label>
          <input type="password" class="auth-input" placeholder="Repeat password" required minlength="6" style="width:100%;padding:.85rem 1rem;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#fff;font-size:14px;outline:none;transition:border-color .2s;">
        </div>
        <button type="submit" class="auth-submit" style="width:100%;padding:1rem;background:#059669;border:none;border-radius:12px;color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:.2em;font-weight:700;cursor:pointer;transition:background .2s;">Update Password</button>
        <div class="auth-error" style="color:#f87171;font-size:12px;margin-top:.75rem;display:none;"></div>
        <div class="auth-success" style="color:#34d399;font-size:12px;margin-top:.75rem;display:none;"></div>
      </form>

      <!-- Sign Up Form -->
      <form class="auth-form" id="auth-signup-form" style="display:none;" onsubmit="return false;">
        <div style="margin-bottom:1.25rem;">
          <label style="font-size:10px;text-transform:uppercase;letter-spacing:.15em;color:rgba(255,255,255,.4);display:block;margin-bottom:.5rem;">Email</label>
          <input type="email" class="auth-input" placeholder="you@example.com" required style="width:100%;padding:.85rem 1rem;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#fff;font-size:14px;outline:none;transition:border-color .2s;">
        </div>
        <div style="margin-bottom:1.25rem;">
          <label style="font-size:10px;text-transform:uppercase;letter-spacing:.15em;color:rgba(255,255,255,.4);display:block;margin-bottom:.5rem;">Password</label>
          <input type="password" class="auth-input" placeholder="Min. 6 characters" required minlength="6" style="width:100%;padding:.85rem 1rem;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#fff;font-size:14px;outline:none;transition:border-color .2s;">
        </div>
        <div style="margin-bottom:1.5rem;">
          <label style="font-size:10px;text-transform:uppercase;letter-spacing:.15em;color:rgba(255,255,255,.4);display:block;margin-bottom:.5rem;">Confirm Password</label>
          <input type="password" class="auth-input" placeholder="Repeat password" required minlength="6" style="width:100%;padding:.85rem 1rem;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#fff;font-size:14px;outline:none;transition:border-color .2s;">
        </div>
        <button type="submit" class="auth-submit" style="width:100%;padding:1rem;background:#059669;border:none;border-radius:12px;color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:.2em;font-weight:700;cursor:pointer;transition:background .2s;">Create Account</button>
        <div class="auth-error" style="color:#f87171;font-size:12px;margin-top:.75rem;display:none;"></div>
        <div class="auth-success" style="color:#34d399;font-size:12px;margin-top:.75rem;display:none;"></div>
      </form>

      <div class="auth-divider" style="margin-top:1.5rem;padding-top:1.5rem;border-top:1px solid rgba(255,255,255,.06);text-align:center;font-size:10px;color:rgba(255,255,255,.25);">
        A confirmation email will be sent to verify your account.
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  authModalEl = overlay;

  // Tab switching
  overlay.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      overlay.querySelectorAll('.auth-tab').forEach(t => {
        t.style.background = 'transparent';
        t.style.borderColor = 'rgba(255,255,255,.1)';
        t.style.color = 'rgba(255,255,255,.5)';
      });
      tab.style.background = 'rgba(52,211,153,.15)';
      tab.style.borderColor = 'rgba(52,211,153,.4)';
      tab.style.color = '#34d399';

      const show = tab.dataset.tab;
      overlay.querySelectorAll('.auth-form').forEach(f => f.style.display = 'none');
      overlay.querySelector('#auth-' + show + '-form').style.display = 'block';
      overlay.querySelectorAll('.auth-error').forEach(e => e.style.display = 'none');
      overlay.querySelectorAll('.auth-success').forEach(e => e.style.display = 'none');
    });
  });

  // Sign In submit
  overlay.querySelector('#auth-signin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const email = form.querySelector('input[type="email"]').value.trim();
    const password = form.querySelector('input[type="password"]').value;
    const errEl = form.querySelector('.auth-error');

    errEl.style.display = 'none';
    const btn = form.querySelector('.auth-submit');
    btn.textContent = 'Signing in…';
    btn.disabled = true;

    try {
      await handleSignin(email, password);
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
      btn.textContent = 'Sign In';
      btn.disabled = false;
    }
  });

  // Sign Up submit
  overlay.querySelector('#auth-signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const email = form.querySelector('input[type="email"]').value.trim();
    const password = form.querySelectorAll('input[type="password"]')[0].value;
    const confirm = form.querySelectorAll('input[type="password"]')[1].value;
    const errEl = form.querySelector('.auth-error');
    const successEl = form.querySelector('.auth-success');

    errEl.style.display = 'none';
    successEl.style.display = 'none';

    if (password !== confirm) {
      errEl.textContent = 'Passwords do not match';
      errEl.style.display = 'block';
      return;
    }

    const btn = form.querySelector('.auth-submit');
    btn.textContent = 'Creating account…';
    btn.disabled = true;

    try {
      const data = await handleSignup(email, password);

      if (data?.user?.identities?.length === 0) {
        errEl.textContent = 'An account with this email already exists.';
        errEl.style.display = 'block';
      } else {
        successEl.textContent = 'Account created! Check your email for a confirmation link.';
        successEl.style.display = 'block';
        form.querySelector('input[type="email"]').value = '';
        form.querySelectorAll('input[type="password"]').forEach(i => i.value = '');
      }
      btn.textContent = 'Create Account';
      btn.disabled = false;
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
      btn.textContent = 'Create Account';
      btn.disabled = false;
    }
  });

  // Forgot password — show forgot form
  overlay.querySelector('.auth-forgot-btn').addEventListener('click', () => {
    overlay.querySelectorAll('.auth-form').forEach(f => f.style.display = 'none');
    overlay.querySelectorAll('.auth-error').forEach(e => e.style.display = 'none');
    overlay.querySelectorAll('.auth-success').forEach(e => e.style.display = 'none');
    overlay.querySelector('#auth-forgot-form').style.display = 'block';
  });

  // Forgot password — back to sign in
  overlay.querySelector('.auth-back-btn').addEventListener('click', () => {
    overlay.querySelectorAll('.auth-form').forEach(f => f.style.display = 'none');
    overlay.querySelectorAll('.auth-error').forEach(e => e.style.display = 'none');
    overlay.querySelectorAll('.auth-success').forEach(e => e.style.display = 'none');
    overlay.querySelector('#auth-signin-form').style.display = 'block';
  });

  // Forgot password submit
  overlay.querySelector('#auth-forgot-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const email = form.querySelector('input[type="email"]').value.trim();
    const errEl = form.querySelector('.auth-error');
    const successEl = form.querySelector('.auth-success');

    errEl.style.display = 'none';
    successEl.style.display = 'none';

    const btn = form.querySelector('.auth-submit');
    btn.textContent = 'Sending…';
    btn.disabled = true;

    try {
      await handleResetPassword(email);
      successEl.textContent = 'Reset link sent! Check your email.';
      successEl.style.display = 'block';
      form.querySelector('input[type="email"]').value = '';
      btn.textContent = 'Send Reset Link';
      btn.disabled = false;
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
      btn.textContent = 'Send Reset Link';
      btn.disabled = false;
    }
  });

  // Reset password submit
  overlay.querySelector('#auth-reset-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const pw = form.querySelectorAll('input[type="password"]')[0].value;
    const confirm = form.querySelectorAll('input[type="password"]')[1].value;
    const errEl = form.querySelector('.auth-error');
    const successEl = form.querySelector('.auth-success');

    errEl.style.display = 'none';
    successEl.style.display = 'none';

    if (pw !== confirm) {
      errEl.textContent = 'Passwords do not match';
      errEl.style.display = 'block';
      return;
    }

    const btn = form.querySelector('.auth-submit');
    btn.textContent = 'Updating…';
    btn.disabled = true;

    try {
      const { error } = await authDb.auth.updateUser({ password: pw });
      if (error) throw error;
      successEl.textContent = 'Password updated! Redirecting…';
      successEl.style.display = 'block';
      btn.textContent = 'Done';
      setTimeout(() => {
        closeAuthModal();
        authDb.auth.signOut();
      }, 2000);
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
      btn.textContent = 'Update Password';
      btn.disabled = false;
    }
  });

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeAuthModal();
  });
}

function openAuthModal() {
  if (!authModalEl) buildAuthModal();
  // Reset UI về trạng thái mặc định (hiện tabs, ẩn reset heading)
  const tabs = authModalEl.querySelector('#auth-tabs');
  const heading = authModalEl.querySelector('#auth-reset-heading');
  if (tabs) tabs.style.display = 'flex';
  if (heading) heading.style.display = 'none';
  authModalEl.querySelectorAll('.auth-form').forEach(f => f.style.display = 'none');
  authModalEl.querySelector('#auth-signin-form').style.display = 'block';
  authModalEl.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeAuthModal() {
  if (authModalEl) {
    authModalEl.style.display = 'none';
    document.body.style.overflow = '';
  }
}
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;

// ── Listen for auth state changes ────────────────────────────
authDb.auth.onAuthStateChange((event, session) => {
  currentUser = session?.user ?? null;

  if (event === 'PASSWORD_RECOVERY') {
    passwordRecoveryPending = true;
  }

  renderAuthUI();
  dispatchAuthEvent(event, currentUser);
});

// ══════════════════════════════════════════════════════════════
// API KEY MANAGER
// ══════════════════════════════════════════════════════════════

const BACKEND = window.EcoLensApiKeys?.BACKEND_URL || 'http://localhost:3000';

async function apiFetch(url, options) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function getToken() {
  const { data: { session } } = await authDb.auth.getSession();
  return session?.access_token || null;
}

async function loadApiKeys() {
  const container = document.getElementById('apikey-items');
  const errorEl = document.getElementById('apikey-error');
  if (!container) return;
  container.innerHTML = '<div style="font-size:12px;color:rgba(255,255,255,.35);text-align:center;padding:1rem;font-family:var(--eco-globe-font,\'Rajdhani\',sans-serif);">Loading…</div>';
  errorEl.style.display = 'none';
  try {
    const token = await getToken();
    if (!token) throw new Error('Not authenticated');
    const data = await apiFetch(`${BACKEND}/api/v1/keys`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!data.keys || data.keys.length === 0) {
      container.innerHTML = '<div style="font-size:12px;color:rgba(255,255,255,.35);text-align:center;padding:1rem;font-family:var(--eco-globe-font,\'Rajdhani\',sans-serif);">No API keys yet. Generate one above.</div>';
      return;
    }
    container.innerHTML = data.keys.map(k => {
      const date = new Date(k.created_at).toLocaleDateString();
      const last = k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never';
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:.75rem 1rem;background:rgba(0,0,0,.3);border:1px solid ${k.is_active ? 'rgba(52,211,153,.15)' : 'rgba(244,67,54,.2)'};border-radius:10px;">
        <div style="display:flex;flex-direction:column;gap:2px;">
          <div style="font-size:13px;font-weight:600;color:#fff;font-family:var(--eco-globe-font,'Rajdhani',sans-serif);">${k.name || 'Untitled'} <span style="font-size:11px;color:rgba(255,255,255,.35);font-family:monospace;">${k.key_prefix}</span></div>
          <div style="font-size:10px;color:rgba(255,255,255,.35);font-family:var(--eco-globe-font,'Rajdhani',sans-serif);">Created: ${date} · Last used: ${last}</div>
        </div>
        ${k.is_active ? `<button onclick="revokeApiKey('${k.id}')" style="padding:.4rem .8rem;background:rgba(244,67,54,.15);border:1px solid rgba(244,67,54,.3);border-radius:6px;color:#f87171;font-size:10px;text-transform:uppercase;cursor:pointer;font-family:var(--eco-globe-font,'Rajdhani',sans-serif);">Revoke</button>` : '<span style="font-size:10px;color:#f87171;font-family:var(--eco-globe-font,\'Rajdhani\',sans-serif);text-transform:uppercase;">Revoked</span>'}
      </div>`;
    }).join('');
  } catch (err) {
    container.innerHTML = '';
    errorEl.textContent = 'Failed to load keys: ' + err.message;
    errorEl.style.display = 'block';
  }
}

async function generateApiKey() {
  const btn = document.getElementById('apikey-generate-btn');
  const nameInput = document.getElementById('apikey-name-input');
  const resultEl = document.getElementById('apikey-result');
  const valueEl = document.getElementById('apikey-value');
  const errorEl = document.getElementById('apikey-error');
  errorEl.style.display = 'none';
  btn.textContent = 'Generating…';
  btn.disabled = true;
  try {
    const token = await getToken();
    if (!token) throw new Error('Not authenticated');
    const data = await apiFetch(`${BACKEND}/api/v1/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ name: nameInput?.value || '' })
    });
    valueEl.value = data.key;
    resultEl.style.display = 'block';
    nameInput.value = '';
    loadApiKeys();
  } catch (err) {
    errorEl.textContent = 'Failed to generate key: ' + err.message;
    errorEl.style.display = 'block';
  } finally {
    btn.textContent = 'Generate';
    btn.disabled = false;
  }
}

async function revokeApiKey(id) {
  if (!confirm('Revoke this API key? This cannot be undone.')) return;
  const errorEl = document.getElementById('apikey-error');
  errorEl.style.display = 'none';
  try {
    const token = await getToken();
    if (!token) throw new Error('Not authenticated');
    await apiFetch(`${BACKEND}/api/v1/keys/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ id })
    });
    loadApiKeys();
  } catch (err) {
    errorEl.textContent = 'Failed to revoke key: ' + err.message;
    errorEl.style.display = 'block';
  }
}

function copyApiKey() {
  const el = document.getElementById('apikey-value');
  if (!el) return;
  el.select();
  navigator.clipboard.writeText(el.value).catch(() => {});
}

// ── Expose API key functions globally ──────────────────────
window.generateApiKey = generateApiKey;
window.revokeApiKey = revokeApiKey;
window.copyApiKey = copyApiKey;

// ══════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  initSession();
});
