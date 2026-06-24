import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Badge from './Badge';
import { api } from '../lib/api';

interface InspectModalProps {
  open: boolean;
  onClose: () => void;
  llm?: string;
  prompt?: string;
  responseSnippet?: string | null;
  mentioned?: boolean;
  position?: number | null;
  hasChanges?: boolean;
  note?: string | null;
  resultId?: string;
  projectId?: string;
}

export default function InspectModal({
  open,
  onClose,
  llm = 'ChatGPT',
  prompt = '',
  responseSnippet = '',
  mentioned = false,
  position = null,
  hasChanges = false,
  note: initialNote = null,
  resultId,
  projectId,
}: InspectModalProps) {
  const { t } = useTranslation();
  const [note, setNote] = useState(initialNote || '');
  const [changes, setChanges] = useState(hasChanges);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNote(initialNote || '');
    setChanges(hasChanges);
  }, [initialNote, hasChanges]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const saveNote = async () => {
    if (!resultId || !projectId) return;
    setSaving(true);
    try {
      await api.updateScanResult(projectId, resultId, {
        note: note || null,
        has_changes: changes,
      });
      setEditing(false);
    } catch { /* ignore */ }
    setSaving(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 animate-[modalIn_.25s_ease]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">{t('modal.title')}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {llm}{prompt ? ` — "${prompt}"` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 ml-3"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[70vh] space-y-4">
          {/* Summary badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {mentioned ? <Badge variant="emerald">✅ Marque mentionnée</Badge> : <Badge variant="red">❌ Marque absente</Badge>}
            {position != null && (
              <span className="text-xs text-slate-500">{t('modal.position')} #{position}</span>
            )}
            {changes && (
              <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 font-medium">
                Modifications effectuées
              </span>
            )}
          </div>

          {/* Response text */}
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Réponse LLM</p>
            {responseSnippet ? (
              <pre className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300 font-['JetBrains_Mono',monospace] text-xs whitespace-pre-wrap max-h-60 overflow-y-auto">
                {responseSnippet}
              </pre>
            ) : (
              <p className="text-sm text-slate-400 dark:text-slate-500 italic bg-slate-50 dark:bg-slate-800/30 rounded-xl p-4">
                Aucune réponse disponible.
              </p>
            )}
          </div>

          {/* Note section */}
          {(resultId && projectId) && (
            <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Note personnelle</span>
                {!editing ? (
                  <button
                    onClick={() => setEditing(true)}
                    className="text-xs px-2 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors"
                  >
                    {note ? 'Modifier la note' : 'Ajouter une note'}
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => { setEditing(false); setNote(initialNote || ''); setChanges(hasChanges); }}
                      className="text-xs px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={saveNote}
                      disabled={saving}
                      className="text-xs px-2 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
                    >
                      {saving ? '...' : 'Sauvegarder'}
                    </button>
                  </div>
                )}
              </div>
              {editing ? (
                <div className="space-y-2">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Noter ce qui a changé, ce qu'il faut surveiller..."
                    className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
                    rows={3}
                  />
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={changes}
                      onChange={(e) => setChanges(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs text-slate-500 dark:text-slate-400">Modifications effectuées sur la page / le contenu</span>
                  </label>
                </div>
              ) : (
                note ? (
                  <p className="text-sm text-slate-600 dark:text-slate-400">{note}</p>
                ) : (
                  <p className="text-sm text-slate-400 dark:text-slate-500 italic">Aucune note — clique sur « Ajouter une note » pour suivre l'évolution.</p>
                )
              )}
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
            </svg>
            <span>{t('modal.tip')}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-slate-200 dark:border-slate-700">
          <button className="btn-ghost text-xs inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-all duration-200" onClick={onClose}>
            {t('modal.close')}
          </button>
          {responseSnippet && (
            <button
              className="btn-primary inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-blue-600 to-violet-600 text-white hover:from-blue-500 hover:to-violet-500 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-200 active:scale-[.97]"
              onClick={() => navigator.clipboard.writeText(responseSnippet)}
            >
              {t('modal.copy')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
