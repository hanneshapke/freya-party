import { API_BASE_URL } from "./env";

class ApiError extends Error {
  constructor(status, body) {
    super(body?.detail || `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function request(path, { method = "GET", body, headers = {}, signal } = {}) {
  const opts = { method, headers: { ...headers }, signal };
  if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${API_BASE_URL}${path}`, opts);
  if (res.status === 204) return null;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json);
  return json;
}

// --- host (Clerk JWT) -------------------------------------------------------

export function hostApi(getToken) {
  const call = async (path, opts = {}) => {
    const token = await getToken();
    return request(path, {
      ...opts,
      headers: { ...(opts.headers || {}), Authorization: `Bearer ${token}` },
    });
  };
  return {
    me: () => call("/api/me"),
    listParties: () => call("/api/parties"),
    createParty: (payload) => call("/api/parties", { method: "POST", body: payload }),
    getParty: (id) => call(`/api/parties/${id}`),
    updateParty: (id, payload) =>
      call(`/api/parties/${id}`, { method: "PATCH", body: payload }),
    archiveParty: (id) => call(`/api/parties/${id}`, { method: "DELETE" }),
    replaceQuests: (id, quests) =>
      call(`/api/parties/${id}/quests`, { method: "PUT", body: quests }),
    listSubmissions: (id) => call(`/api/parties/${id}/submissions`),
    checkout: () => call("/api/billing/checkout", { method: "POST" }),
    portal: () => call("/api/billing/portal", { method: "POST" }),
  };
}

// --- public (guest session token) ------------------------------------------

export function guestApi(joinCode, sessionToken) {
  const base = `/api/public/parties/${encodeURIComponent(joinCode)}`;
  const authHeaders = sessionToken ? { "X-Guest-Token": sessionToken } : {};
  return {
    join: (payload) => request(`${base}/join`, { method: "POST", body: payload }),
    getState: () => request(base, { headers: authHeaders }),
    uploadUrl: (payload) =>
      request(`${base}/upload-url`, { method: "POST", body: payload, headers: authHeaders }),
    submit: (payload) =>
      request(`${base}/submissions`, { method: "POST", body: payload, headers: authHeaders }),
  };
}

// Upload a File to R2 via the presigned PUT URL returned by uploadUrl().
// Headers signed at issue time (e.g. Content-Type) must match exactly.
export async function uploadToPresigned(presigned, file) {
  const headers = { ...(presigned.headers || {}) };
  if (!headers["Content-Type"]) headers["Content-Type"] = file.type || "application/octet-stream";
  const res = await fetch(presigned.url, {
    method: "PUT",
    headers,
    body: file,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return presigned.key;
}

export { ApiError };
