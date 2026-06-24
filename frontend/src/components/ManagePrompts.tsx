import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import type { PromptData } from '../lib/api';

interface Props {
  projectId: string;
  prompts: PromptData[];
  onClose: () => void;
  onRefresh: () => void;
}

export default function ManagePrompts({ projectId, prompts, onClose, onRefresh }: Props) {
  const { t } = useTranslation();
  const [newTheme, setNewTheme] = useState('');
  const [newText, setNewText] = useState('');
  const [themeFilter, setThemeFilter] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Grouper les prompts par thème
  const themes = [...new Set(prompts.map((p) => String((p as Record<string, unknown>).theme ?? '')))].filter(Boolean).sort();
  const filtered = themeFilter
    ? prompts.filter((p) => String((p as Record<string, unknown>).theme ?? '') === themeFilter)
    : prompts;

  const handleAddPrompt = async () => {
    if (!newText.trim()) return;
    setSaving(true);
    try {
      await api.createPrompts(projectId, [newText.trim()], newTheme || undefined);
      setNewText('');
      onRefresh();
    } catch (err) {
      alert(`Erreur: ${err instanceof Error ? err.message : 'Échec'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePrompt = async (promptId: string | number) => {
    if (!confirm('Supprimer ce prompt ?')) return;
    try {
      await api.deletePrompt(projectId, promptId);
      onRefresh();
    } catch (err) {
      alert(`Erreur: ${err instanceof Error ? err.message : 'Échec'}`);
    }
  };

  const handleAddThemePrompt = async (theme: string) => {
    const text = prompt(`Ajouter une question pour le thème "${theme}" :`);
    if (!text?.trim()) return;
    setSaving(true);
    try {
      await api.createPrompts(projectId, [text.trim()], theme);
      onRefresh();
    } catch (err) {
      alert(`Erreur: ${err instanceof Error ? err.message : 'Échec'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 pb-8 bg-black/40 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Gérer les prompts</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Ajout rapide */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Ajouter un prompt</h4>
            <div className="flex gap-2">
              <input
                type="text"
                className="input-field flex-1"
                placeholder="Question / mot-clé..."
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddPrompt()}
              />
              <input
                type="text"
                className="input-field w-36"
                placeholder="Thème (optionnel)"
                value={newTheme}
                onChange={(e) => setNewTheme(e.target.value)}
              />
              <button onClick={handleAddPrompt} disabled={saving || !newText.trim()} className="btn-primary shrink-0">
                {saving ? '...' : t('create.add')}
              </button>
            </div>
            <p className="text-xs text-slate-400">Laissez le thème vide pour un prompt général, ou spécifiez un univers (Piscine, Jardin...).</p>
          </div>

          {/* Thèmes existants — raccourci d'ajout */}
          {themes.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Thèmes existants</h4>
              <div className="flex flex-wrap gap-2">
                {themes.map((th) => (
                  <div key={th} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-300">{th}</span>
                    <button
                      onClick={() => handleAddThemePrompt(th)}
                      className="text-blue-400 hover:text-blue-600"
                      title={`Ajouter une question au thème "${th}"`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filtre par thème */}
          {themes.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-slate-200 dark:border-slate-700 pt-4">
              <button
                onClick={() => setThemeFilter(null)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  !themeFilter
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                Tous ({prompts.length})
              </button>
              {themes.map((th) => {
                const count = prompts.filter((p) => String((p as Record<string, unknown>).theme ?? '') === th).length;
                return (
                  <button
                    key={th}
                    onClick={() => setThemeFilter(th)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      themeFilter === th
                        ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {th} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {/* Liste des prompts */}
          <div className="space-y-2 max-h-64 overflow-y-auto border-t border-slate-200 dark:border-slate-700 pt-4">
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                {prompts.length === 0
                  ? 'Aucun prompt configuré. Ajoutez-en un ci-dessus.'
                  : 'Aucun prompt pour ce thème.'}
              </p>
            ) : (
              filtered.map((p) => {
                const pData = p as Record<string, unknown>;
                return (
                  <div
                    key={String(pData.id ?? '')}
                    className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                  >
                    {pData.theme ? (
                      <span className="badge bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 text-[10px] mt-0.5 shrink-0">
                        {String(pData.theme)}
                      </span>
                    ) : (
                      <span className="badge bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20 text-[10px] mt-0.5 shrink-0">
                        Général
                      </span>
                    )}
                    <p className="text-sm text-slate-700 dark:text-slate-300 flex-1 break-words">
                      {String(pData.text ?? '')}
                    </p>
                    <button
                      onClick={() => handleDeletePrompt(pData.id as string | number)}
                      className="text-slate-300 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0 mt-0.5"
                      title="Supprimer"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 pb-5 pt-3 border-t border-slate-200 dark:border-slate-700">
          <button onClick={onClose} className="btn-primary">Fermer</button>
        </div>
      </div>
    </div>
  );
}
