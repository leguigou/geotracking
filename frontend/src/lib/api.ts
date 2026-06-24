import axios from "axios"

const client = axios.create({
  baseURL: "https://geotrack.deloffre.fr/api",
  headers: { "Content-Type": "application/json" },
})

// ── Intercepteur : ajouter le token JWT ──────────────────────────
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token")
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Intercepteur : 401 → rediriger vers login ────────────────────
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("access_token")
      localStorage.removeItem("refresh_token")
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login"
      }
    }
    return Promise.reject(error)
  },
)

// ── Types ───────────────────────────────────────────────────────────
export interface ProjectData {
  id: string
  name: string
  target_url: string
  url?: string
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
  [key: string]: unknown
}

export interface LatestResultsData {
  overall?: Record<string, number>
  prompts?: LlmResult[]
  scan_date?: string
  [key: string]: unknown
}

export interface HistoryEntry {
  scan_date: string
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

// ── Projects ────────────────────────────────────────────────────────
export const getProjects = () =>
  client.get<ProjectData[]>("/projects").then((r) => r.data)

export const createProject = (data: Record<string, unknown>) =>
  client.post<{ id: string; [key: string]: unknown }>("/projects", data).then((r) => r.data)

export const getProject = (id: string | number) =>
  client.get<ProjectData>(`/projects/${id}`).then((r) => r.data)

export const updateProject = (id: string | number, data: Record<string, unknown>) =>
  client.put<unknown>(`/projects/${id}`, data).then((r) => r.data)

export const deleteProject = (id: string | number) =>
  client.delete<unknown>(`/projects/${id}`).then((r) => r.data)

// ── Prompts ─────────────────────────────────────────────────────────
export const getPrompts = (projectId: string | number) =>
  client.get<PromptData[]>(`/projects/${projectId}/prompts`).then((r) => r.data)

export const createPrompts = (projectId: string | number, texts: string[]) =>
  client.post<unknown[]>(`/projects/${projectId}/prompts`, { texts }).then((r) => r.data)

export const deletePrompt = (projectId: string | number, promptId: string | number) =>
  client.delete<unknown>(`/projects/${projectId}/prompts/${promptId}`).then((r) => r.data)

// ── Scan ────────────────────────────────────────────────────────────
export const scanProject = (projectId: string | number) =>
  client.post<unknown>(`/projects/${projectId}/scan`).then((r) => r.data)

// ── Results ─────────────────────────────────────────────────────────
export const getResults = (projectId: string | number) =>
  client.get<HistoryEntry[]>(`/projects/${projectId}/results`).then((r) => r.data)

export const getLatestResults = (projectId: string | number) =>
  client.get<LatestResultsData>(`/projects/${projectId}/results/latest`).then((r) => r.data)

// ── Settings ────────────────────────────────────────────────────────
export const getSettings = () =>
  client.get<Record<string, unknown>>("/settings").then((r) => r.data)

export const updateSettings = (settings: Record<string, unknown>) =>
  client.put<Record<string, unknown>>("/settings", settings).then((r) => r.data)

// ── Named export groupé pour compatibilité avec les pages existantes ─
export const api = {
  login,
  register,
  me,
  getProjects,
  createProject,
  getProject,
  updateProject,
  deleteProject,
  getPrompts,
  createPrompts,
  deletePrompt,
  scanProject,
  getResults,
  getLatestResults,
  getSettings,
  updateSettings,
}

export default api
