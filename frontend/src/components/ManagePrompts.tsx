import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import type { PromptData } from '../lib/api';

interface Props {
  projectId: string;
  prompts: PromptData[];
  initialPromptId?: string | number | null;
  onClose: () => void;
  onRefresh: () => void;
}

export default function ManagePrompts({ projectId, prompts, initialPromptId, onClose, onRefresh }: Props) {
  const { t } = useTranslation();
  const [localPrompts, setLocalPrompts] = useState<PromptData[]>(prompts);
  const [newTheme, setNewTheme] = useState('');
  const [newText, setNewText] = useState('');
  const [themeFilter, setThemeFilter] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editText, setEditText] = useState('');
  const [editTheme, setEditTheme] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);

  // Réécriture IA
  const [hasKey, setHasKey] = useState(true);
  const [assistantModel, setAssistantModel] = useState('');
  const [rewriting, setRewriting] = useState(false);

  useEffect(() => {
    api.getAvailableModels()
      .then((data) => {
        setHasKey(data.has_key);
        setAssistantModel(data.assistant_model ?? '');
      })
      .catch(() => {
        setHasKey(false);
        setAssistantModel('');
      });
  }, []);

  useEffect(() => {
    setLocalPrompts(prompts);
  }, [prompts]);

  useEffect(() => {
    if (initialPromptId == null) return;
    const selected = prompts.find((prompt) => String(prompt.id) === String(initialPromptId));
    if (!selected) return;
    setEditingId(selected.id);
    setEditText(selected.text);
    setEditTheme(selected.theme ?? '');
    setEditActive(selected.is_active !== false);
  }, [initialPromptId, prompts]);

  const handleRewrite = async () => {
    if (!newText.trim()) return;
    setRewriting(true);
    try {
      const data = await api.rewritePrompt(newText.trim());
      if (data.rewritten) {
        setNewText(data.rewritten);
      }
    } catch (err) {
      alert(`Erreur réécriture: ${err instanceof Error ? err.message : 'Échec'}`);
    } finally {
      setRewriting(false);
    }
  };

  // Grouper les prompts par thème
  const themes = [...new Set(localPrompts.map((p) => p.theme ?? ''))].filter(Boolean).sort();
  const filtered = themeFilter
    ? localPrompts.filter((p) => p.theme === themeFilter)
    : localPrompts;

  const handleAddPrompt = async () => {
    if (!newText.trim()) return;
    setSaving(true);
    try {
      const created = await api.createPrompts(projectId, [newText.trim()], newTheme.trim() || undefined);
      setLocalPrompts((current) => [...current, ...created]);
      setNewText('');
      await onRefresh();
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
      setLocalPrompts((current) => current.filter((item) => item.id !== promptId));
      if (editingId === promptId) setEditingId(null);
      await onRefresh();
    } catch (err) {
      alert(`Erreur: ${err instanceof Error ? err.message : 'Échec'}`);
    }
  };

  const handleAddThemePrompt = async (theme: string) => {
    const text = prompt(`Ajouter une question pour le thème "${theme}" :`);
    if (!text?.trim()) return;
    setSaving(true);
    try {
      const created = await api.createPrompts(projectId, [text.trim()], theme);
      setLocalPrompts((current) => [...current, ...created]);
      await onRefresh();
    } catch (err) {
      alert(`Erreur: ${err instanceof Error ? err.message : 'Échec'}`);
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (promptData: PromptData) => {
    setEditingId(promptData.id);
    setEditText(promptData.text);
    setEditTheme(promptData.theme ?? '');
    setEditActive(promptData.is_active !== false);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditText('');
    setEditTheme('');
    setEditActive(true);
  };

  const handleSaveEdit = async () => {
    if (editingId == null || !editText.trim()) return;
    setSavingEdit(true);
    try {
      const updated = await api.updatePrompt(projectId, editingId, {
        text: editText.trim(),
        theme: editTheme.trim() || null,
        is_active: editActive,
      });
      setLocalPrompts((current) => current.map((item) => (
        item.id === editingId ? updated : item
      )));
      cancelEditing();
      await onRefresh();
    } catch (err) {
      alert(`Erreur: ${err instanceof Error ? err.message : 'Échec'}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleActive = async (promptData: PromptData) => {
    try {
      const updated = await api.updatePrompt(projectId, promptData.id, {
        is_active: promptData.is_active === false,
      });
      setLocalPrompts((current) => current.map((item) => (
        item.id === promptData.id ? updated : item
      )));
      await onRefresh();
    } catch (err) {
      alert(`Erreur: ${err instanceof Error ? err.message : 'Échec'}`);
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

            {/* Alerte si pas de clé API */}
            {!hasKey && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-xs text-amber-700 dark:text-amber-300">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <span>Aucune clé API OpenRouter configurée. La réécriture IA n'est pas disponible.</span>
                <a href="/settings" className="ml-auto font-medium underline hover:text-amber-800 dark:hover:text-amber-200">Configurer</a>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label htmlFor="new-prompt-text" className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Texte du prompt
                </label>
                <textarea
                  id="new-prompt-text"
                  rows={3}
                  className="input-field w-full resize-y"
                  placeholder="Ex. Quel est le meilleur robot de piscine pour une maison à Aubagne ?"
                  value={newText}
                  onChange={(event) => setNewText(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                      handleAddPrompt();
                    }
                  }}
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <label htmlFor="new-prompt-theme" className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Thème <span className="font-normal text-slate-400">(facultatif)</span>
                  </label>
                  <input
                    id="new-prompt-theme"
                    type="text"
                    className="input-field w-full"
                    placeholder="Ex. Piscine"
                    value={newTheme}
                    onChange={(event) => setNewTheme(event.target.value)}
                  />
                </div>
                <button
                  onClick={handleAddPrompt}
                  disabled={saving || !newText.trim()}
                  className="btn-primary w-full shrink-0 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {saving ? 'Ajout…' : t('create.add')}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">Astuce : Ctrl + Entrée pour ajouter rapidement le prompt.</p>
            </div>

            {/* Ligne réécriture IA */}
            {hasKey && assistantModel && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 font-mono text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  Assistant : {assistantModel}
                </span>
                <button
                  onClick={handleRewrite}
                  disabled={rewriting || !newText.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 hover:bg-violet-100 dark:hover:bg-violet-500/20 transition-all shrink-0"
                >
                  {rewriting ? (
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                    </svg>
                  )}
                  {rewriting ? 'Réécriture...' : 'Réécrire avec l\'IA'}
                </button>
              </div>
            )}

            {hasKey && !assistantModel && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                Choisis le modèle assistant IA dans les paramètres pour utiliser la réécriture.
              </div>
            )}

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
                Tous ({localPrompts.length})
              </button>
              {themes.map((th) => {
                const count = localPrompts.filter((p) => p.theme === th).length;
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
          <div className="space-y-2 max-h-96 overflow-y-auto border-t border-slate-200 dark:border-slate-700 pt-4">
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                {localPrompts.length === 0
                  ? 'Aucun prompt configuré. Ajoutez-en un ci-dessus.'
                  : 'Aucun prompt pour ce thème.'}
              </p>
            ) : (
              filtered.map((p) => {
                const pData = p as Record<string, unknown>;
                return (
                  <div
                    key={String(pData.id ?? '')}
                    className={`flex flex-wrap items-start gap-3 p-3 rounded-lg border transition-colors group ${
                      editingId === p.id
                        ? 'border-blue-300 bg-blue-50/60 dark:border-blue-500/50 dark:bg-blue-500/5'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
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
                    <div className="flex items-center gap-1 shrink-0 mt-0.5">
                      <button
                        onClick={() => startEditing(p)}
                        className="rounded-md p-1 text-slate-400 hover:bg-blue-50 hover:text-blue-600 dark:text-slate-500 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
                        title="Modifier ce prompt"
                        aria-label="Modifier ce prompt"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zM19.5 7.125L16.875 4.5M18 14.25v4.125A1.875 1.875 0 0116.125 20.25H5.625A1.875 1.875 0 013.75 18.375V7.875A1.875 1.875 0 015.625 6H9.75" />
                        </svg>
                      </button>
                      {(pData as Record<string, unknown>).is_active !== false ? (
                        <button
                          onClick={async () => {
                            await handleToggleActive(p);
                          }}
                          className="rounded-md p-1 text-slate-400 hover:bg-amber-50 hover:text-amber-600 dark:text-slate-500 dark:hover:bg-amber-500/10 dark:hover:text-amber-300"
                          title="Mettre en pause"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9v6m-4.5 0V9M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      ) : (
                        <button
                          onClick={async () => {
                            await handleToggleActive(p);
                          }}
                          className="rounded-md p-1 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:text-slate-500 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300"
                          title="Réactiver"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => handleDeletePrompt(pData.id as string | number)}
                        className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                        title="Supprimer"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    {editingId === p.id && (
                      <div className="w-full space-y-3 border-t border-blue-200 pt-3 dark:border-blue-500/20">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                            Texte du prompt
                          </label>
                          <textarea
                            autoFocus
                            rows={4}
                            value={editText}
                            onChange={(event) => setEditText(event.target.value)}
                            className="input-field w-full resize-y"
                          />
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                          <div className="flex-1">
                            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                              Thème
                            </label>
                            <input
                              value={editTheme}
                              onChange={(event) => setEditTheme(event.target.value)}
                              className="input-field w-full"
                              placeholder="Général"
                            />
                          </div>
                          <label className="flex min-h-10 items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                            <input
                              type="checkbox"
                              checked={editActive}
                              onChange={(event) => setEditActive(event.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600"
                            />
                            Prompt actif
                          </label>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={cancelEditing}
                            disabled={savingEdit}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                          >
                            Annuler
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            disabled={savingEdit || !editText.trim()}
                            className="btn-primary"
                          >
                            {savingEdit ? 'Enregistrement…' : 'Enregistrer'}
                          </button>
                        </div>
                      </div>
                    )}
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
