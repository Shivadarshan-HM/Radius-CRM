const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const TOKEN_KEY = "radius_crm_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = "GET", body, auth = true, form = false } = {}) {
  const headers = {};
  if (!form) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? (form ? body : JSON.stringify(body)) : undefined,
  });

  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new Event("radius-crm-unauthorized"));
    throw new ApiError("Session expired. Please log in again.", 401);
  }

  if (res.status === 204) return null;

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    /* no body */
  }

  if (!res.ok) {
    const message = (data && (data.detail || data.message)) || `Request failed (${res.status})`;
    throw new ApiError(typeof message === "string" ? message : JSON.stringify(message), res.status);
  }
  return data;
}

/* ---------- Auth ---------- */
export async function bootstrapStatus() {
  return request("/auth/bootstrap-status", { auth: false });
}

export async function login(email, password) {
  const form = new URLSearchParams();
  form.set("username", email);
  form.set("password", password);
  const data = await request("/auth/login", { method: "POST", body: form, form: true, auth: false });
  setToken(data.access_token);
  return data;
}

export async function register(email, password) {
  const data = await request("/auth/register", { method: "POST", body: { email, password }, auth: false });
  return data;
}

export async function fetchMe() {
  return request("/auth/me");
}

/* ---------- Generic CRUD factory ---------- */
function crud(resource) {
  return {
    list: () => request(`/${resource}`),
    create: (payload) => request(`/${resource}`, { method: "POST", body: payload }),
    update: (id, payload) => request(`/${resource}/${id}`, { method: "PATCH", body: payload }),
    remove: (id) => request(`/${resource}/${id}`, { method: "DELETE" }),
  };
}

export const clientsApi = crud("clients");
export const leadsApi = crud("leads");
export const projectsApi = crud("projects");
export const invoicesApi = crud("invoices");
export const contractsApi = crud("contracts");

export async function fetchAnalytics() {
  return request("/analytics/summary");
}

/* ---------- Automation ---------- */
export const automationApi = {
  getSettings: () => request("/automation/settings"),
  updateSettings: (payload) => request("/automation/settings", { method: "PATCH", body: payload }),
  getLogs: () => request("/automation/logs?limit=50"),
};

export const getLeadWhatsAppLink = (id) => request(`/automation/leads/${id}/whatsapp-link`);
export const getInvoiceWhatsAppLink = (id) => request(`/automation/invoices/${id}/whatsapp-link`);

/** Raw URL for blob-fetch pattern (needs auth header added manually) */
export const invoicePdfUrl = (id) => `${BASE_URL}/automation/invoices/${id}/pdf`;
export const contractPdfUrl = (id) => `${BASE_URL}/automation/contracts/${id}/pdf`;

/**
 * Download a PDF by fetching with auth header, converting to a blob,
 * and triggering an <a download> click in the browser.
 */
export async function downloadPdf(url, filename) {
  const token = getToken();
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new ApiError(`PDF download failed (${res.status})`, res.status);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

export { ApiError };
