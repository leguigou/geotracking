import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type ScanResultDetail } from '../lib/api';

// ── Types ────────────────────────────────────────────────────────

interface BatchResult {
  id: string
  prompt_id: string
  prompt_text: string
  model: string
  modelLabel: string
  response_text: string
  has_url: boolean
  has_brand: boolean
  rank: number | null
  latency_ms: number | null
  tokens_used: number | null
  note: string | null
  has_changes: boolean
}

interface ScanBatch {
  scanned_at: string
  label: string
  results: BatchResult[]
  sov: number
}

// ── Helpers ───────────────────────────────────────────────────────

const MODEL_NAMES: Record<string, string> = {
  'openai/gpt-4o-mini': 'GPT-4o Mini',
  'openai/gpt-4o': 'GPT-4o',
  'openai/gpt-4-turbo': 'GPT-4 Turbo',
  'anthropic/claude-3-opus': 'Claude Opus',
  'anthropic/claude-3-sonnet': 'Claude Sonnet',
  'anthropic/claude-3-haiku': 'Claude Haiku',
  'perplexity/llama-3-sonar': 'Perplexity',
  'google/gemini-1.5-pro': 'Gemini 1.5 Pro',
  'google/gemini-1.5-flash': 'Gemini 1.5 Flash',
}

const MODEL_COLORS: Record<string, string> = {
  'openai/gpt-4o-mini': 'from-emerald-500 to-emerald-600',
  'openai/gpt-4o': 'from-emerald-600 to-emerald-700',
  'anthropic/claude-3-sonnet': 'from-violet-500 to-violet-600',
  'perplexity/llama-3-sonar': 'from-amber-500 to-amber-600',
  'google/gemini-1.5-pro': 'from-red-500 to-red-600',
}

function modelLabel(m: string) {
  return MODEL_NAMES[m] || m.split('/').pop() || m
}

function modelColor(m: string) {
  return MODEL_COLORS[m] || 'from-blue-500 to-blue-600'
}

function modelInitial(m: string) {
  const label = modelLabel(m)
  return label.charAt(0)
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
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [project, setProject] = useState<{ name: string; target_url: string } | null>(null)
  const [batches, setBatches] = useState<ScanBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [compareBatch, setCompareBatch] = useState<{ left: ScanBatch | null; right: ScanBatch | null }>({ left: null, right: null })

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Fetch project data
  useEffect(() => {
    if (!id) return
    api.getProject(id).then(setProject).catch(() => {})
  }, [id])

  // Fetch all results
  const fetchResults = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const results = await api.getResults(id)
      // Group by scanned_at (truncated to the minute for batch grouping)
      const groupMap = new Map<string, typeof results>()
      for (const r of results) {
        const key = r.scanned_at?.slice(0, 16) ?? 'unknown'
        const group = groupMap.get(key) || []
        group.push(r)
        groupMap.set(key, group)
      }

      // For each batch, fetch full details (response_text + prompt_text)
      const batchList: ScanBatch[] = []
      for (const [key, group] of groupMap) {
        const details = await Promise.all(
          group.map(async (r) => {
            try {
              return await api.getResultDetail(id, r.id)
            } catch {
              return null as ScanResultDetail | null
            }
          })
        )
        const validDetails = details.filter((d): d is ScanResultDetail => d !== null)
        if (validDetails.length === 0) continue

        const urlOk = validDetails.filter(d => d.has_url).length
        const sov = Math.round((urlOk / validDetails.length) * 100)

        batchList.push({
          scanned_at: key,
          label: `${formatDate(validDetails[0].scanned_at)} à ${formatTime(validDetails[0].scanned_at)}`,
          results: validDetails.map(d => ({
            id: d.id,
            prompt_id: d.prompt_id,
            prompt_text: d.prompt_text,
            model: d.model,
            modelLabel: modelLabel(d.model),
            response_text: d.response_text,
            has_url: d.has_url,
            has_brand: d.has_brand,
            rank: d.rank,
            latency_ms: d.latency_ms,
            tokens_used: d.tokens_used,
            note: d.note,
            has_changes: d.has_changes,
          })),
          sov,
        })
      }
      setBatches(batchList)
    } catch {
      // ignore
    }
    setLoading(false)
  }, [id])

  useEffect(() => { fetchResults() }, [fetchResults])

  // Save note
  const saveNote = async (resultId: string, note: string | null, hasChanges: boolean) => {
    setSaving(resultId)
    try {
      await api.updateScanResult(id!, resultId, { note, has_changes: hasChanges })
      // Update local state
      setBatches(prev => prev.map(b => ({
        ...b,
        results: b.results.map(r => r.id === resultId ? { ...r, note, has_changes: hasChanges } : r),
      })))
    } catch { /* ignore */ }
    setSaving(null)
    setEditingNote(null)
  }

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
            {batches.length} scan{batches.length > 1 ? 's' : ''} · {batches.reduce((a, b) => a + b.results.length, 0)} réponse{batches.reduce((a, b) => a + b.results.length, 0) > 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setCompareIds([]); fetchResults() }}
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

            {batches.map((batch, bi) => (
              <div key={batch.scanned_at} className="relative pl-12 pb-8 last:pb-0">
                {/* Timeline dot */}
                <div className={`absolute left-3 top-1.5 w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white z-10 bg-gradient-to-br ${batch.sov > 50 ? 'from-emerald-500 to-emerald-600' : 'from-amber-500 to-amber-600'}`}>
                  {batch.sov}%
                </div>

                {/* Batch card */}
                <div className="glass-card rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
                  {/* Batch header */}
                  <div className="flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-700/50">
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{batch.label}</p>
                      <span className="text-xs text-slate-400">{batch.results.length} résultat{batch.results.length > 1 ? 's' : ''}</span>
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

                  {/* Results */}
                  <div className="divide-y divide-slate-100 dark:divide-slate-700/30">
                    {batch.results.map((result) => {
                      const isExpanded = expanded.has(result.id)
                      return (
                        <div key={result.id} className="px-5 py-3">
                          {/* Result header */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${modelColor(result.model)} flex items-center justify-center text-[10px] font-bold text-white shrink-0`}>
                                {modelInitial(result.model)}
                              </div>
                              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{result.modelLabel}</span>
                              <span className="text-xs text-slate-400 truncate">"{result.prompt_text}"</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              {/* Status badges */}
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${result.has_url ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                                URL
                              </span>
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${result.has_brand ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                                Marque
                              </span>
                              {result.rank != null && (
                                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">#{result.rank}</span>
                              )}
                              {result.has_changes && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                                  Modifié
                                </span>
                              )}
                              {/* Expand toggle */}
                              <button
                                onClick={() => toggleExpand(result.id)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                              >
                                <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                </svg>
                              </button>
                            </div>
                          </div>

                          {/* Response text (expandable) */}
                          {isExpanded && (
                            <div className="mt-3 space-y-3">
                              <pre className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300 font-['JetBrains_Mono',monospace] text-xs whitespace-pre-wrap max-h-80 overflow-y-auto">
                                {result.response_text || <span className="text-slate-400 italic">Aucune réponse</span>}
                              </pre>

                              {/* Métriques */}
                              <div className="flex flex-wrap gap-3 text-[11px] text-slate-400">
                                {result.latency_ms != null && (
                                  <span>⏱ {result.latency_ms}ms</span>
                                )}
                                {result.tokens_used != null && (
                                  <span>📝 {result.tokens_used} tokens</span>
                                )}
                                {result.cost != null && (
                                  <span>💰 ${result.cost.toFixed(6)}</span>
                                )}
                              </div>

                              {/* Note section */}
                              <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-3 border border-slate-200 dark:border-slate-700/50">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Note personnelle</span>
                                  <button
                                    onClick={() => {
                                      if (editingNote === result.id) {
                                        saveNote(result.id, noteText || null, result.has_changes)
                                      } else {
                                        setEditingNote(result.id)
                                        setNoteText(result.note || '')
                                      }
                                    }}
                                    disabled={saving === result.id}
                                    className="text-xs px-2 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
                                  >
                                    {saving === result.id ? '...' : editingNote === result.id ? 'Sauvegarder' : 'Éditer'}
                                  </button>
                                </div>

                                {editingNote === result.id ? (
                                  <div className="space-y-2">
                                    <textarea
                                      value={noteText}
                                      onChange={(e) => setNoteText(e.target.value)}
                                      placeholder="Noter ce qui a changé, ce qu'il faut surveiller..."
                                      className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
                                      rows={3}
                                    />
                                    <label className="flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={result.has_changes}
                                        onChange={(e) => {
                                          const newChanges = e.target.checked
                                          saveNote(result.id, noteText || null, newChanges)
                                        }}
                                        className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                                      />
                                      <span className="text-xs text-slate-500 dark:text-slate-400">Modifications effectuées sur la page / le contenu</span>
                                    </label>
                                  </div>
                                ) : (
                                  <div>
                                    {result.note ? (
                                      <p className="text-sm text-slate-600 dark:text-slate-400">{result.note}</p>
                                    ) : (
                                      <p className="text-sm text-slate-400 dark:text-slate-500 italic">Aucune note</p>
                                    )}
                                    {result.has_changes && (
                                      <div className="mt-2 flex items-center gap-1.5 text-xs text-yellow-600 dark:text-yellow-400">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                                        </svg>
                                        Modifications marquées comme effectuées
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Compare view ──────────────────────────────────────────────────

function CompareView({ left, right }: { left: ScanBatch; right: ScanBatch }) {
  return (
    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-xl border border-blue-200 dark:border-blue-800/30 bg-white dark:bg-slate-800/50 overflow-hidden">
        <div className="px-4 py-2 bg-blue-100 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800/30">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">{left.label}</p>
        </div>
        <div className="p-4 space-y-3 text-xs max-h-80 overflow-y-auto">
          {left.results.map((r) => (
            <CompareCard key={r.id} result={r} />
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-blue-200 dark:border-blue-800/30 bg-white dark:bg-slate-800/50 overflow-hidden">
        <div className="px-4 py-2 bg-blue-100 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800/30">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">{right.label}</p>
        </div>
        <div className="p-4 space-y-3 text-xs max-h-80 overflow-y-auto">
          {right.results.map((r) => (
            <CompareCard key={r.id} result={r} />
          ))}
        </div>
      </div>
    </div>
  )
}

function CompareCard({ result }: { result: BatchResult }) {
  return (
    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/30 p-3 border border-slate-200 dark:border-slate-700/50">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{result.modelLabel}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${result.has_url ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>URL</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${result.has_brand ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>Marque</span>
        {result.rank != null && <span className="text-[10px] text-slate-400">#{result.rank}</span>}
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-400 truncate mb-1">"{result.prompt_text}"</p>
      <p className="text-xs text-slate-500 dark:text-slate-500 line-clamp-3">{result.response_text || '—'}</p>
      {result.note && (
        <p className="text-[10px] text-yellow-600 dark:text-yellow-400 mt-1">📝 {result.note}</p>
      )}
    </div>
  )
}
