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
  project_id?: string
  theme?: string | null
  is_active?: boolean
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
    competitors?: Array<{
      name: string
      url: string | null
      rank: number | null
      is_target?: boolean
    }>
  }>
  [key: string]: unknown
}

export interface ProviderStats {
  sov: number
  mentions: number
  total: number
  failed?: number
  url_found?: number
  brand_found?: number
  latest_at?: string | null
}

export interface LatestResultsData {
  batch: {
    id: string
    status: "queued" | "running" | "completed" | "failed" | "cancelled"
    requested_model?: string | null
    total_jobs: number
    completed_jobs: number
    failed_jobs: number
    created_at: string
    completed_at?: string | null
  }
  overall: Record<string, number>
  provider_stats?: Record<string, ProviderStats>
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
  total_jobs?: number
  completed_jobs?: number
  failed_jobs?: number
  provider_stats?: Record<string, ProviderStats>
  chatgpt?: number
  claude?: number
  perplexity?: number
  gemini?: number
  [key: string]: unknown
}

export interface ScanResultLogEntry {
  id: string
  batch_id?: string | null
  project_id: string
  prompt_id: string
  prompt_text?: string | null
  model: string
  has_url: boolean
  has_brand: boolean
  rank?: number | null
  latency_ms?: number | null
  tokens_used?: number | null
  cost?: number | null
  error?: string | null
  scanned_at: string
  response_text?: string | null
  competitors?: Array<{
    name: string
    url: string | null
    rank: number | null
    is_target?: boolean
  }>
}

export interface PromptStatsValues {
  total: number
  successful: number
  failed: number
  mentions: number
  mention_rate: number
  url_found: number
  url_rate: number
  brand_found: number
  brand_rate: number
  average_rank?: number | null
  average_latency_ms?: number | null
  tokens_used: number
  cost: number
  first_scan_at?: string | null
  last_scan_at?: string | null
}

export interface PromptStatsData {
  prompt: {
    id: string
    text: string
    theme?: string | null
    is_active: boolean
    created_at?: string | null
  }
  overall: PromptStatsValues
  by_model: Array<PromptStatsValues & { model: string }>
  recent: Array<{
    id: string
    batch_id?: string | null
    model: string
    mentioned: boolean
    has_url: boolean
    has_brand: boolean
    rank?: number | null
    latency_ms?: number | null
    tokens_used?: number | null
    cost?: number | null
    error?: string | null
    scanned_at?: string | null
  }>
}

export interface CompetitorModelStats {
  model: string
  mentions: number
  prompt_count: number
  best_rank?: number | null
  average_rank?: number | null
  first_detected_at?: string | null
  last_detected_at?: string | null
}

export interface CompetitorSummary {
  key: string
  name: string
  urls: string[]
  mentions: number
  detection_rate: number
  share_of_competitor_mentions: number
  prompt_count: number
  model_count: number
  best_rank?: number | null
  average_rank?: number | null
  first_detected_at?: string | null
  last_detected_at?: string | null
  models: CompetitorModelStats[]
}

export interface CompetitorOccurrence {
  result_id: string
  batch_id?: string | null
  prompt_id: string
  prompt_text: string
  theme?: string | null
  model: string
  name: string
  url?: string | null
  rank?: number | null
  scanned_at?: string | null
  evidence: string
}

export interface CompetitorPage {
  scanned_responses: number
  total_competitors: number
  total_occurrences: number
  prompts_with_competitors: number
  models: string[]
  items: CompetitorSummary[]
  total: number
  limit: number
  offset: number
}

export interface CompetitorDetail extends CompetitorSummary {
  occurrences: CompetitorOccurrence[]
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
  client.post<PromptData[]>(`/projects/${projectId}/prompts`, { texts, theme }).then((r) => r.data)

export const deletePrompt = (projectId: string | number, promptId: string | number) =>
  client.delete<unknown>(`/projects/${projectId}/prompts/${promptId}`).then((r) => r.data)

export const updatePrompt = (
  projectId: string | number,
  promptId: string | number,
  data: { text?: string; theme?: string | null; is_active?: boolean },
) =>
  client.patch<PromptData>(`/projects/${projectId}/prompts/${promptId}`, data).then((r) => r.data)

// ── Scan ────────────────────────────────────────────────────────────
export const scanProject = (projectId: string | number, model?: string) => {
  return client.post<{ status: string; batch_id: string; enqueued: number }>(
    `/projects/${projectId}/scan`,
    { model: model || null },
    { params: model ? { model } : undefined },
  ).then((r) => r.data)
};

export const cancelScan = (projectId: string | number) =>
  client.post<{ status: string; cancelled: number }>(`/projects/${projectId}/cancel-scan`).then((r) => r.data);

// ── Results ─────────────────────────────────────────────────────────
export const getResults = (projectId: string | number, limit = 500, offset = 0) =>
  client.get<ScanResultLogEntry[]>(`/projects/${projectId}/results`, {
    params: { limit, offset },
  }).then((r) => r.data)

export const getPromptStats = (projectId: string | number, promptId: string | number) =>
  client.get<PromptStatsData>(`/projects/${projectId}/prompts/${promptId}/stats`).then((r) => r.data)

export const getProjectCompetitors = (
  projectId: string | number,
  params: { search?: string; sort?: "mentions" | "recent" | "rank" | "name"; limit?: number; offset?: number } = {},
) =>
  client.get<CompetitorPage>(`/projects/${projectId}/competitors`, { params }).then((r) => r.data)

export const getCompetitorDetail = (projectId: string | number, key: string) =>
  client.get<CompetitorDetail>(`/projects/${projectId}/competitors/detail`, { params: { key } }).then((r) => r.data)

export const getLatestResults = (projectId: string | number) =>
  client.get<LatestResultsData>(`/projects/${projectId}/results/latest`).then((r) => r.data)

export const getScanHistory = (projectId: string | number, limit = 1000) =>
  client.get<HistoryEntry[]>(`/projects/${projectId}/history`, { params: { limit } }).then((r) => r.data)

export const getScanStatus = (projectId: string | number, batchId?: string) => {
  const params = batchId ? `?batch_id=${batchId}` : ''
  return client.get<ScanStatusData>(`/projects/${projectId}/scan/status${params}`).then((r) => r.data)
}

export interface ScanStatusData {
  batch: {
    id: string
    status: string
    requested_model?: string | null
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
      tokens_used?: number | null
      cost?: number | null
      scanned_at?: string | null
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
  client.post<{ status: string; message: string; models?: OpenRouterModel[] }>("/settings/test-openrouter", { api_key: apiKey || undefined }).then((r) => r.data)

export const getAvailableModels = () =>
  client.get<{
    models: OpenRouterModel[]
    recommended: Record<string, OpenRouterModel>
    has_key: boolean
    assistant_model?: string | null
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
    enabled_models?: string[]
    overall: Record<string, number>
    provider_stats?: Record<string, ProviderStats>
    sov_avg?: number | null
    batch: { id: string; status: string; failed_jobs: number; scan_date: string } | null
  }>
  trend: Array<{ date: string; provider_stats?: Record<string, ProviderStats>; [key: string]: unknown }>
  alerts?: Array<{
    severity: "info" | "warning" | "critical"
    project_id: string
    project_name: string
    message: string
  }>
  top_competitors?: Array<{
    name: string
    url: string | null
    mentions: number
    average_rank: number | null
    projects: string[]
    models: string[]
  }>
}

export const getDashboardOverview = () =>
  client.get<DashboardOverview>("/dashboard/overview").then((response) => response.data)

export const rewritePrompt = (text: string) =>
  client.post<{ rewritten: string; model: string }>("/settings/rewrite-prompt", { text }).then((r) => r.data)

export const analyzeResponse = (responseText: string, promptText = "") =>
  client.post<{ analysis: string; model: string }>("/settings/analyze-response", {
    response_text: responseText,
    prompt_text: promptText,
  }).then((r) => r.data)

export interface AuditLogEntry {
  id: string
  organization_id: string
  user_id: string
  user_email?: string | null
  user_name?: string | null
  action: string
  resource_type: string
  resource_id?: string | null
  details?: Record<string, unknown> | null
  ip_address?: string | null
  created_at: string
}

export interface AuditLogPage {
  items: AuditLogEntry[]
  total: number
  limit: number
  offset: number
}

export const getAuditLogs = ({
  limit = 50,
  offset = 0,
  search = "",
}: {
  limit?: number
  offset?: number
  search?: string
} = {}) =>
  client.get<AuditLogPage>("/audit-logs", {
    params: { limit, offset, search: search.trim() || undefined },
  }).then((r) => r.data)

export type GeoAuditPriority = "critical" | "high" | "medium" | "low"

export interface GeoAuditFinding {
  priority: GeoAuditPriority
  category: string
  title: string
  evidence: string
  recommendation: string
}

export interface GeoAuditReport {
  audit_id?: string
  source_audit_id?: string | null
  saved_at?: string | null
  url: string
  final_url: string
  brand: string
  generated_at: string
  score: number
  priority_counts: Record<GeoAuditPriority, number>
  findings: GeoAuditFinding[]
  page: {
    status: number
    content_type?: string | null
    title: string
    description: string
    canonical: string
    language: string
    robots_meta: string
    word_count: number
    headings: Record<string, number>
    h1: string[]
    image_count: number
    images_without_alt: number
    json_ld_types: string[]
  }
  robots: {
    url: string
    status: number
    blocks_all: boolean
    bots: Record<string, "allowed" | "blocked">
    sitemaps: string[]
  }
  sitemap: { url: string; status: number; url_count: number }
  llms_txt: { url: string; status: number; present: boolean }
  ai_summary?: string | null
  ai_model?: string | null
  ai_warning?: string | null
  use_ai?: boolean
}

export const createGeoAudit = (data: { url: string; brand?: string; use_ai?: boolean }) =>
  client.post<GeoAuditReport>("/geo-audits", data).then((response) => response.data)

export interface GeoAuditHistoryItem {
  audit_id: string
  source_audit_id?: string | null
  requested_url: string
  final_url: string
  brand: string
  use_ai: boolean
  score: number
  ai_model?: string | null
  priority_counts: Record<GeoAuditPriority, number>
  created_at: string
}

export interface GeoAuditHistoryPage {
  items: GeoAuditHistoryItem[]
  total: number
  limit: number
  offset: number
}

export const getGeoAuditHistory = (limit = 20, offset = 0) =>
  client.get<GeoAuditHistoryPage>("/geo-audits", { params: { limit, offset } }).then((response) => response.data)

export const getGeoAudit = (auditId: string) =>
  client.get<GeoAuditReport>(`/geo-audits/${auditId}`).then((response) => response.data)

export const rerunGeoAudit = (auditId: string) =>
  client.post<GeoAuditReport>(`/geo-audits/${auditId}/rerun`).then((response) => response.data)

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
  getPromptStats,
  getProjectCompetitors,
  getCompetitorDetail,
  getLatestResults,
  getScanHistory,
  getScanStatus,
  getSettings,
  updateSettings,
  testOpenRouterKey,
  getAvailableModels,
  rewritePrompt,
  analyzeResponse,
  getAuditLogs,
  getDashboardOverview,
  createGeoAudit,
  getGeoAuditHistory,
  getGeoAudit,
  rerunGeoAudit,
}

export default api
