import axios from "axios"

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  headers: { "Content-Type": "application/json" },
  withCredentials: true, // envoie les cookies HTTP-only
})

// ── Intercepteur : ajouter le token JWT ──────────────────────────
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token")
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Intercepteur : 401 → refresh automatique via cookie ──────────
let isRefreshing = false
let pendingRequests: Array<{
  resolve: (token: string) => void
  reject: (err: unknown) => void
}> = []

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Si ce n'est pas un 401 ou que la requête est déjà un retry, on rejette
    if (error.response?.status !== 401 || originalRequest._retry) {
      if (originalRequest.url?.includes("/auth/")) {
        return Promise.reject(error)
      }
      return Promise.reject(error)
    }

    // Éviter les appels refresh concurrents
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingRequests.push({ resolve, reject })
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`
        return client(originalRequest)
      })
    }

    isRefreshing = true
    originalRequest._retry = true

    try {
      // Le refresh_token est envoyé automatiquement via le cookie HTTP-only
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL || "/api"}/auth/refresh`,
        {},
        { withCredentials: true },
      )
      const { access_token } = res.data
      localStorage.setItem("access_token", access_token)

      // Rejouer les requêtes en attente
      pendingRequests.forEach((p) => p.resolve(access_token))
      pendingRequests = []

      originalRequest.headers.Authorization = `Bearer ${access_token}`
      return client(originalRequest)
    } catch {
      // Refresh échoué → déconnexion
      localStorage.removeItem("access_token")
      pendingRequests.forEach((p) => p.reject(error))
      pendingRequests = []
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login"
      }
      return Promise.reject(error)
    } finally {
      isRefreshing = false
    }
  },
)

// ── Types ───────────────────────────────────────────────────────────
export interface ProjectData {
  id: string
  name: string
  target_url: string
  url?: string
  description?: string | null
  brand_names?: string[]
  enabled_models?: string[]
  frequency?: string
  is_active?: boolean
  last_scheduled_scan_at?: string | null
  [key: string]: unknown
}

export interface PromptData {
  id: string | number
  text: string
  created_at: string
  [key: string]: unknown
}

export interface LlmResult {
  prompt_id: string | number
  prompt_text: string
  chatgpt?: number | boolean
  claude?: number | boolean
  perplexity?: number | boolean
  gemini?: number | boolean
  grok?: number | boolean
  deepseek?: number | boolean
  theme?: string | null
  models?: Record<string, {
    model: string
    mentioned: boolean
    has_url: boolean
    has_brand: boolean
    rank?: number | null
    error?: string | null
  }>
  [key: string]: unknown
}

export interface LatestResultsData {
  batch: {
    id: string
    status: "queued" | "running" | "completed" | "failed" | "cancelled"
    total_jobs: number
    completed_jobs: number
    failed_jobs: number
    created_at: string
    completed_at?: string | null
  }
  overall: Record<string, number>
  prompts: LlmResult[]
  scan_date: string
  results: Array<Record<string, unknown>>
  sov: {
    total_scans: number
    url_found: number
    brand_found: number
    sov_url: number
    sov_brand: number
    average_rank?: number | null
  }
  [key: string]: unknown
}

export interface HistoryEntry {
  batch_id: string
  scan_date: string
  status?: string
  chatgpt?: number
  claude?: number
  perplexity?: number
  gemini?: number
  [key: string]: unknown
}

// ── Auth ───────────────────────────────────────────────────────────
export const login = (email: string, password: string) =>
  client.post<{ access_token: string; refresh_token: string }>("/auth/login", { email, password }).then((r) => r.data)

export const register = (
  email: string,
  password: string,
  full_name: string,
  organization_name: string,
) =>
  client.post<{ access_token: string; refresh_token: string }>("/auth/register", {
    email,
    password,
    full_name,
    organization_name,
  }).then((r) => r.data)

export const me = () =>
  client.get<{ id: string; email: string; full_name: string }>("/auth/me").then((r) => r.data)

export const updateProfile = (data: { full_name?: string; email?: string; current_password?: string; new_password?: string }) =>
  client.patch<{ id: string; email: string; full_name: string }>("/auth/me", data).then((r) => r.data)

// ── Projects ────────────────────────────────────────────────────────
export const getProjects = () =>
  client.get<ProjectData[]>("/projects").then((r) => r.data)

export const createProject = (data: Record<string, unknown>) =>
  client.post<{ id: string; [key: string]: unknown }>("/projects", data).then((r) => r.data)

export const getProject = (id: string | number) =>
  client.get<ProjectData>(`/projects/${id}`).then((r) => r.data)

export const updateProject = (id: string | number, data: Record<string, unknown>) =>
  client.patch<unknown>(`/projects/${id}`, data).then((r) => r.data)

export const deleteProject = (id: string | number) =>
  client.delete<unknown>(`/projects/${id}`).then((r) => r.data)

// ── Prompts ─────────────────────────────────────────────────────────
export const getPrompts = (projectId: string | number) =>
  client.get<PromptData[]>(`/projects/${projectId}/prompts`).then((r) => r.data)

export const createPrompts = (projectId: string | number, texts: string[], theme?: string) =>
  client.post<unknown[]>(`/projects/${projectId}/prompts`, { texts, theme }).then((r) => r.data)

export const deletePrompt = (projectId: string | number, promptId: string | number) =>
  client.delete<unknown>(`/projects/${projectId}/prompts/${promptId}`).then((r) => r.data)

export const updatePrompt = (projectId: string | number, promptId: string | number, data: Record<string, unknown>) =>
  client.patch<unknown>(`/projects/${projectId}/prompts/${promptId}`, data).then((r) => r.data)

// ── Scan ────────────────────────────────────────────────────────────
export const scanProject = (projectId: string | number, model?: string) => {
  return client.post<{ status: string; batch_id: string; enqueued: number }>(
    `/projects/${projectId}/scan`,
    { model: model || null },
  ).then((r) => r.data)
};

export const cancelScan = (projectId: string | number) =>
  client.post<{ status: string; cancelled: number }>(`/projects/${projectId}/cancel-scan`).then((r) => r.data);

// ── Results ─────────────────────────────────────────────────────────
export const getResults = (projectId: string | number) =>
  client.get<HistoryEntry[]>(`/projects/${projectId}/results`).then((r) => r.data)

export const getLatestResults = (projectId: string | number) =>
  client.get<LatestResultsData>(`/projects/${projectId}/results/latest`).then((r) => r.data)

export const getScanHistory = (projectId: string | number) =>
  client.get<HistoryEntry[]>(`/projects/${projectId}/history`).then((r) => r.data)

export const getScanStatus = (projectId: string | number) =>
  client.get<ScanStatusData>(`/projects/${projectId}/scan/status`).then((r) => r.data)

export interface ScanStatusData {
  batch: {
    id: string
    status: string
    total_jobs: number
    completed_jobs: number
    failed_jobs: number
    created_at: string
    completed_at: string | null
  } | null
  matrix: Array<{
    prompt_id: string
    prompt_text: string
    theme: string | null
    models: Record<string, {
      status: string
      has_url: boolean
      has_brand: boolean
      rank: number | null
      error: string | null
      latency_ms: number | null
      response_snippet: string | null
      competitors: Array<{
        name: string
        url: string | null
        rank: number | null
        is_target: boolean
      }>
    }>
  }>
  prompts: Array<{ id: string; text: string; theme: string | null }>
  models: string[]
}

// ── Settings ────────────────────────────────────────────────────────
export const getSettings = () =>
  client.get<Record<string, unknown>>("/settings").then((r) => r.data)

export const updateSettings = (settings: Record<string, unknown>) =>
  client.put<Record<string, unknown>>("/settings", settings).then((r) => r.data)

export const testOpenRouterKey = (apiKey?: string) =>
  client.post<{ status: string; message: string; models?: string[] }>("/settings/test-openrouter", { api_key: apiKey || undefined }).then((r) => r.data)

export const getAvailableModels = () =>
  client.get<{
    models: OpenRouterModel[]
    recommended: Record<string, OpenRouterModel>
    has_key: boolean
    message: string
  }>("/settings/available-models").then((r) => r.data)

export interface OpenRouterModel {
  id: string
  name: string
  provider: string
  pricing: Record<string, unknown>
  context_length?: number | null
  supported_parameters?: string[]
}

export interface DashboardOverview {
  totals: {
    projects: number
    active_projects: number
    prompts: number
    average_sov: number
    failed_jobs: number
  }
  projects: Array<{
    id: string
    name: string
    is_active: boolean
    prompt_count: number
    overall: Record<string, number>
    batch: { id: string; status: string; failed_jobs: number; scan_date: string } | null
  }>
  trend: Array<{ date: string; [key: string]: string | number }>
}

export const getDashboardOverview = () =>
  client.get<DashboardOverview>("/dashboard/overview").then((response) => response.data)

export const rewritePrompt = (text: string, model: string) =>
  client.post<{ rewritten: string }>("/settings/rewrite-prompt", { text, model }).then((r) => r.data)

export const getAuditLogs = () =>
  client.get<Record<string, unknown>[]>("/audit-logs").then((r) => r.data)

// ── Named export groupé pour compatibilité avec les pages existantes ─
export const api = {
  login,
  register,
  me,
  updateProfile,
  getProjects,
  createProject,
  getProject,
  updateProject,
  deleteProject,
  getPrompts,
  createPrompts,
  deletePrompt,
  updatePrompt,
  scanProject,
  cancelScan,
  getResults,
  getLatestResults,
  getScanHistory,
  getScanStatus,
  getSettings,
  updateSettings,
  testOpenRouterKey,
  getAvailableModels,
  rewritePrompt,
  getAuditLogs,
  getDashboardOverview,
}

export default api
