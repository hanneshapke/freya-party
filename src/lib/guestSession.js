const key = (joinCode) => `guest_session:${joinCode.toLowerCase()}`;

export function loadGuestSession(joinCode) {
  try {
    const raw = localStorage.getItem(key(joinCode));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveGuestSession(joinCode, data) {
  localStorage.setItem(key(joinCode), JSON.stringify(data));
}

export function clearGuestSession(joinCode) {
  localStorage.removeItem(key(joinCode));
}
