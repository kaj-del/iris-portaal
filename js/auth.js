function saveSession(token, remember) {
  if (remember) {
    localStorage.setItem('session_token', token);
  } else {
    sessionStorage.setItem('session_token', token);
  }
}

function clearSession() {
  sessionStorage.removeItem('session_token');
  localStorage.removeItem('session_token');
}

function getToken() {
  return sessionStorage.getItem('session_token') || localStorage.getItem('session_token');
}

async function requireAuth(requiredRole) {
  const token = getToken();
  if (!token) {
    window.location.href = '/index.html';
    return null;
  }
  try {
    const user = await api.auth.me();
    if (requiredRole && user.role !== requiredRole) {
      window.location.href = user.role === 'admin' ? '/dashboard-iris.html' : '/portaal.html';
      return null;
    }
    if (!user.onboarding_done && user.role === 'client') {
      window.location.href = '/onboarding.html';
      return null;
    }
    return user;
  } catch (e) {
    clearSession();
    window.location.href = '/index.html';
    return null;
  }
}

async function logout() {
  try { await api.auth.logout(); } catch (_) {}
  clearSession();
  window.location.href = '/index.html';
}

function renderNavUser(user) {
  const el = document.getElementById('nav-user');
  if (el) el.textContent = user.name;
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
}
