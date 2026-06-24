import { useState, useEffect, useCallback } from "react"
import {
  getProjects,
  getProject,
  getPrompts,
  getLatestResults,
  getScanHistory,
  type ProjectData,
  type PromptData,
  type LatestResultsData,
  type HistoryEntry,
} from "../lib/api"

// Re-export pour compatibilité pages existantes
export { api } from "../lib/api"

// ── useProjects ────────────────────────────────────────────────
export function useProjects() {
  const [data, setData] = useState<ProjectData[] | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getProjects()
      setData(result)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { data, loading, refresh } as const
}

// ── useProject ─────────────────────────────────────────────────
export function useProject(id: string | number | undefined) {
  const [data, setData] = useState<ProjectData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id == null) return
    setLoading(true)
    getProject(id)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [id])

  return { data, loading } as const
}

// ── usePrompts ─────────────────────────────────────────────────
export function usePrompts(projectId: string | number | undefined) {
  const [data, setData] = useState<PromptData[] | null>(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (projectId == null) return
    setLoading(true)
    try {
      const result = await getPrompts(projectId)
      setData(result)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, refetch } as const
}

// ── useLatestResults ───────────────────────────────────────────
export function useLatestResults(projectId: string | number | undefined) {
  const [data, setData] = useState<LatestResultsData | null>(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (projectId == null) return
    setLoading(true)
    try {
      const result = await getLatestResults(projectId)
      setData(result)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, refetch } as const
}

// ── useHistory ─────────────────────────────────────────────────
export function useHistory(projectId: string | number | undefined) {
  const [data, setData] = useState<HistoryEntry[] | null>(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (projectId == null) return
    setLoading(true)
    try {
      const result = await getScanHistory(projectId)
      setData(result)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, refetch } as const
}
