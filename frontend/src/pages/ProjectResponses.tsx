import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

// ── Types ────────────────────────────────────────────────────────

interface BatchDisplay {
  scanned_at: string
  label: string
  status: string
  /** modelId → sovUrl */
  models: Record<string, number>
  totalResults: number
}

// ── Helpers ───────────────────────────────────────────────────────

const MODEL_COLORS: Record<string, string> = {
  'openai/gpt-4o-mini': 'from-emerald-500 to-emerald-600',
  'openai/gpt-4o': 'from-emerald-600 to-emerald-700',
  'anthropic/claude-3-sonnet': 'from-violet-500 to-violet-600',
  'perplexity/llama-3-sonar': 'from-amber-500 to-amber-600',
  'google/gemini-1.5-pro': 'from-red-500 to-red-600',
}

function modelColor(m: string) {
  return MODEL_COLORS[m] || 'from-blue-500 to-blue-600'
}

function modelInitial(m: string) {
  const label = m.split('/').pop() || m
  return label.charAt(0).toUpperCase()
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

// ── Component ─────────────────────────────────────────────────────

export default function ProjectResponses() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [project, setProject] = useState<{ name: string; target_url: string } | null>(null)
  const [batches, setBatches] = useState<BatchDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [compareBatch, setCompareBatch] = useState<{ left: BatchDisplay | null; right: BatchDisplay | null }>({ left: null, right: null })

  // Fetch project data
  useEffect(() => {
    if (!id) return
    api.getProject(id).then(setProject).catch(() => {})
  }, [id])

  // Fetch scan history
  const fetchResults = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const history = await api.getScanHistory(id)
      // Convert history entries to batch displays
      const batchList: BatchDisplay[] = history.map((entry) => {
        const models: Record<string, number> = {}
        let totalResults = 0
        for (const [key, val] of Object.entries(entry)) {
          if (key !== 'batch_id' && key !== 'scan_date' && key !== 'status' && typeof val === 'number') {
            models[key] = val
            totalResults++
          }
        }
        return {
          scanned_at: entry.scan_date,
          label: `${formatDate(entry.scan_date)} à ${formatTime(entry.scan_date)}`,
          status: entry.status || 'unknown',
          models,
          totalResults,
        }
      })
      setBatches(batchList)
    } catch {
      // ignore
    }
    setLoading(false)
  }, [id])

  useEffect(() => { fetchResults() }, [fetchResults])

  // Toggle compare selection
  const toggleCompare = (scannedAt: string) => {
    setCompareIds(prev => {
      if (prev.includes(scannedAt)) return prev.filter(id => id !== scannedAt)
      if (prev.length >= 2) return [prev[1], scannedAt]
      return [...prev, scannedAt]
    })
  }

  // Compute compare batches
  useEffect(() => {
    if (compareIds.length === 2) {
      setCompareBatch({
        left: batches.find(b => b.scanned_at === compareIds[0]) || null,
        right: batches.find(b => b.scanned_at === compareIds[1]) || null,
      })
    } else {
      setCompareBatch({ left: null, right: null })
    }
  }, [compareIds, batches])

  // Compute overall SOV for a batch
  const batchSov = (batch: BatchDisplay): number => {
    const vals = Object.values(batch.models)
    if (vals.length === 0) return 0
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
  }

  if (loading && batches.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-slate-500 dark:text-slate-400">Chargement des réponses...</p>
      </div>
    )
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-2">
        <span className="cursor-pointer hover:text-slate-700 dark:hover:text-slate-300" onClick={() => navigate('/')}>Dashboard</span>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
        <span className="cursor-pointer hover:text-slate-700 dark:hover:text-slate-300" onClick={() => navigate(`/project/${id}`)}>{project?.name ?? 'Projet'}</span>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
        <span className="text-slate-900 dark:text-white font-medium">Réponses</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Historique des réponses</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {batches.length} scan{batches.length > 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchResults()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-all duration-200 bg-slate-100 dark:bg-slate-800"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg>
            Actualiser
          </button>
        </div>
      </div>

      {batches.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <p className="text-slate-400 dark:text-slate-500">Aucun scan effectué pour ce projet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Compare mode banner */}
          {compareIds.length > 0 && (
            <div className="rounded-xl p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  Mode comparaison : sélectionne 2 scans pour les comparer côte à côte
                  {compareIds.length === 1 && ` (1 sélectionné, choisis-en un 2e)`}
                </p>
                <button onClick={() => setCompareIds([])} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                  Annuler
                </button>
              </div>
              {compareBatch.left && compareBatch.right && (
                <CompareView left={compareBatch.left} right={compareBatch.right} />
              )}
            </div>
          )}

          {/* Timeline */}
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700" />

            {batches.map((batch) => {
              const sov = batchSov(batch)
              return (
                <div key={batch.scanned_at} className="relative pl-12 pb-8 last:pb-0">
                  {/* Timeline dot */}
                  <div className={`absolute left-3 top-1.5 w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white z-10 bg-gradient-to-br ${sov > 50 ? 'from-emerald-500 to-emerald-600' : 'from-amber-500 to-amber-600'}`}>
                    {sov}%
                  </div>

                  {/* Batch card */}
                  <div className="glass-card rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
                    {/* Batch header */}
                    <div className="flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-700/50">
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{batch.label}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                          {batch.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleCompare(batch.scanned_at)}
                          className={`text-xs px-2 py-1 rounded-lg border transition-all ${
                            compareIds.includes(batch.scanned_at)
                              ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                              : 'border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          Comparer
                        </button>
                      </div>
                    </div>

                    {/* Per-model results */}
                    <div className="px-5 py-4 space-y-2">
                      {Object.entries(batch.models).length === 0 ? (
                        <p className="text-xs text-slate-400 dark:text-slate-500 italic">Aucune donnée modèle pour ce scan.</p>
                      ) : (
                        Object.entries(batch.models).map(([modelId, sovVal]) => (
                          <div key={modelId} className="flex items-center gap-3">
                            <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${modelColor(modelId)} flex items-center justify-center text-[10px] font-bold text-white shrink-0`}>
                              {modelInitial(modelId)}
                            </div>
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 w-24 truncate" title={modelId}>
                              {modelId.split('/').pop() || modelId}
                            </span>
                            <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all"
                                style={{ width: `${Math.max(sovVal, 2)}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 w-10 text-right">{sovVal}%</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Compare view ──────────────────────────────────────────────────

function CompareView({ left, right }: { left: BatchDisplay; right: BatchDisplay }) {
  return (
    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
      <CompareSide label={left.label} models={left.models} />
      <CompareSide label={right.label} models={right.models} />
    </div>
  )
}

function CompareSide({ label, models }: { label: string; models: Record<string, number> }) {
  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-800/30 bg-white dark:bg-slate-800/50 overflow-hidden">
      <div className="px-4 py-2 bg-blue-100 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800/30">
        <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">{label}</p>
      </div>
      <div className="p-4 space-y-2 text-xs max-h-80 overflow-y-auto">
        {Object.entries(models).map(([modelId, sovVal]) => (
          <div key={modelId} className="rounded-lg bg-slate-50 dark:bg-slate-800/30 p-3 border border-slate-200 dark:border-slate-700/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                {modelId.split('/').pop() || modelId}
              </span>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${sovVal > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                SOV {sovVal}%
              </span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all"
                style={{ width: `${Math.max(sovVal, 2)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
