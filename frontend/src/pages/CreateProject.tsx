import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ModelPicker from '../components/ModelPicker';
import api, { type OpenRouterModel } from '../lib/api';

const steps = ['create.step1', 'create.step2', 'create.step3', 'create.step4'] as const;

const runsPerMonth: Record<string, number> = {
  daily: 30,
  weekly: 4.3,
  biweekly: 2.2,
  monthly: 1,
};

const frequencyLabels: Record<string, string> = {
  daily: 'Quotidienne',
  weekly: 'Hebdomadaire',
  biweekly: 'Toutes les deux semaines',
  monthly: 'Mensuelle',
};

export default function CreateProject() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState('weekly');
  const [availableModels, setAvailableModels] = useState<OpenRouterModel[]>([]);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);

  const [themeGroups, setThemeGroups] = useState<{ theme: string; keywords: string[] }[]>([
    { theme: '', keywords: [] },
  ]);
  const [activeThemeIdx, setActiveThemeIdx] = useState(0);
  const [keywordInput, setKeywordInput] = useState('');

  const themes = ['Piscine', 'Jardin', 'Équipement', 'Mode', 'Autre'];
  const totalKeywords = themeGroups.reduce((sum, group) => sum + group.keywords.length, 0);
  const monthlyRequests = Math.ceil(totalKeywords * selectedModelIds.length * (runsPerMonth[frequency] ?? 1));
  const modelNameById = new Map(availableModels.map((model) => [model.id, model.name]));

  useEffect(() => {
    api.getAvailableModels()
      .then((data) => {
        const recommended = Object.values(data.recommended || {});
        setAvailableModels(data.models);
        setSelectedModelIds(recommended.slice(0, 3).map((model) => model.id));
      })
      .finally(() => setLoadingModels(false));
  }, []);

  const goNext = () => {
    if (step < 4) setStep(step + 1);
  };

  const goBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const addThemeGroup = (preset?: string) => {
    setThemeGroups([...themeGroups, { theme: preset || '', keywords: [] }]);
    setActiveThemeIdx(themeGroups.length);
  };

  const removeThemeGroup = (idx: number) => {
    if (themeGroups.length <= 1) return;
    const updated = themeGroups.filter((_, index) => index !== idx);
    setThemeGroups(updated);
    if (activeThemeIdx >= updated.length) setActiveThemeIdx(updated.length - 1);
  };

  const updateThemeName = (idx: number, theme: string) => {
    const updated = [...themeGroups];
    updated[idx] = { ...updated[idx], theme };
    setThemeGroups(updated);
  };

  const addKeyword = () => {
    const trimmed = keywordInput.trim();
    if (!trimmed) return;
    const updated = [...themeGroups];
    if (!updated[activeThemeIdx].keywords.includes(trimmed)) {
      updated[activeThemeIdx] = {
        ...updated[activeThemeIdx],
        keywords: [...updated[activeThemeIdx].keywords, trimmed],
      };
      setThemeGroups(updated);
      setKeywordInput('');
    }
  };

  const removeKeyword = (themeIdx: number, keyword: string) => {
    const updated = [...themeGroups];
    updated[themeIdx] = {
      ...updated[themeIdx],
      keywords: updated[themeIdx].keywords.filter((item) => item !== keyword),
    };
    setThemeGroups(updated);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (selectedModelIds.length === 0) {
        throw new Error('Aucun modèle OpenRouter valide n’est sélectionné');
      }

      const project = (await api.createProject({
        name,
        target_url: targetUrl,
        description: description || undefined,
        brand_names: [name],
        enabled_models: selectedModelIds,
        frequency,
      })) as { id: string };

      for (const group of themeGroups) {
        if (group.keywords.length > 0) {
          await api.createPrompts(project.id, group.keywords, group.theme || undefined);
        }
      }

      navigate(`/project/${project.id}`);
    } catch (err) {
      console.error('Failed to create project:', err);
      alert(`Erreur : ${err instanceof Error ? err.message : 'Échec de la création'}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('create.title')}</h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{t('create.subtitle')}</p>
      </div>

      <div className="mb-10 flex items-center justify-between px-4">
        {steps.map((key, index) => {
          const stepNum = index + 1;
          const isCompleted = stepNum < step;
          const isActive = stepNum === step;
          return (
            <div key={key} className="flex flex-1 items-center">
              <div className={`progress-step flex flex-col items-center ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}>
                <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-all duration-300 ${
                  isCompleted
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : isActive
                      ? 'border-blue-600 bg-blue-50 text-blue-600 dark:bg-blue-500/10'
                      : 'border-slate-300 text-slate-400 dark:border-slate-600 dark:text-slate-500'
                }`}>
                  {stepNum}
                </div>
                <span className="mt-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">{t(key)}</span>
              </div>
              {index < steps.length - 1 && (
                <div className={`mx-3 h-px flex-1 ${stepNum < step ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`} />
              )}
            </div>
          );
        })}
      </div>

      {step === 1 && (
        <div className="step-content">
          <div className="glass-card space-y-5 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('create.siteInfo')}</h2>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('create.url')}</label>
              <div className="flex gap-2">
                <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800">
                  https://
                </span>
                <input type="url" className="input-field flex-1" placeholder="monsite.com" value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} />
              </div>
              {targetUrl && !/^[a-zA-Z0-9][-a-zA-Z0-9.]*\.[a-zA-Z]{2,}(\/.*)?$/.test(targetUrl) && (
                <p className="mt-1 text-xs text-red-500">Format d'URL invalide (ex: monsite.com)</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('create.name')}</label>
              <input type="text" className="input-field" placeholder="Mon Projet" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('create.description')}</label>
              <textarea className="input-field resize-none" rows={3} placeholder={t('create.descPlaceholder')} value={description} onChange={(event) => setDescription(event.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Fréquence automatique</label>
              <select className="input-field w-full" value={frequency} onChange={(event) => setFrequency(event.target.value)}>
                <option value="daily">Quotidienne</option>
                <option value="weekly">Hebdomadaire</option>
                <option value="biweekly">Toutes les deux semaines</option>
                <option value="monthly">Mensuelle</option>
              </select>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button onClick={goNext} className="btn-primary" disabled={!name || !targetUrl}>{t('create.next')}</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="step-content">
          <div className="glass-card space-y-5 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('create.selectLLMs')}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Ajoute les modèles exacts à utiliser pour ce projet. Tu peux choisir plusieurs modèles OpenAI, les comparer, puis en supprimer quand tu veux.
            </p>
            <ModelPicker models={availableModels} selectedIds={selectedModelIds} onChange={setSelectedModelIds} loading={loadingModels} />
          </div>
          <div className="mt-6 flex justify-between">
            <button onClick={goBack} className="btn-secondary">{t('create.back')}</button>
            <button onClick={goNext} className="btn-primary" disabled={selectedModelIds.length === 0 || loadingModels}>{t('create.next')}</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="step-content">
          <div className="glass-card space-y-5 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('create.keywords')}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('create.keywordsDesc')}</p>

            <div className="flex flex-wrap gap-2">
              {themeGroups.map((group, idx) => (
                <button
                  key={`${group.theme}-${idx}`}
                  onClick={() => setActiveThemeIdx(idx)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    idx === activeThemeIdx
                      ? 'border border-blue-300 bg-blue-100 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-300'
                      : 'border border-transparent bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                  }`}
                >
                  {group.theme || `Thème ${idx + 1}`}
                  <span className="ml-0.5 text-[10px] opacity-60">({group.keywords.length})</span>
                  {themeGroups.length > 1 && (
                    <svg className="ml-0.5 h-3 w-3 cursor-pointer hover:text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" onClick={(event) => { event.stopPropagation(); removeThemeGroup(idx); }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  )}
                </button>
              ))}
              <button
                onClick={() => addThemeGroup()}
                className="inline-flex items-center gap-1 rounded-lg border border-dashed border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-600 transition-all hover:bg-blue-50 dark:border-blue-500/30 dark:text-blue-400 dark:hover:bg-blue-500/10"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Ajouter un thème
              </button>
            </div>

            <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Nom de la thématique</label>
              <div className="mb-4 flex gap-2">
                <input
                  type="text"
                  className="input-field flex-1"
                  placeholder="Ex: Piscine, Jardin, Équipement..."
                  value={themeGroups[activeThemeIdx]?.theme || ''}
                  onChange={(event) => updateThemeName(activeThemeIdx, event.target.value)}
                />
                <div className="flex flex-wrap items-center gap-1">
                  {themes.map((theme) => (
                    <button
                      key={theme}
                      onClick={() => updateThemeName(activeThemeIdx, theme)}
                      className={`rounded-md px-2 py-1 text-xs font-medium transition-all ${
                        themeGroups[activeThemeIdx]?.theme === theme
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                      }`}
                    >
                      {theme}
                    </button>
                  ))}
                </div>
              </div>

              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Questions / mots-clés</label>
              <div className="mb-2 flex flex-wrap gap-2">
                {themeGroups[activeThemeIdx]?.keywords.map((keyword) => (
                  <span key={keyword} className="badge border border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300">
                    {keyword}
                    <button onClick={() => removeKeyword(activeThemeIdx, keyword)} className="ml-1 hover:text-blue-500">&times;</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input-field flex-1"
                  placeholder="Ajouter une question..."
                  value={keywordInput}
                  onChange={(event) => setKeywordInput(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && addKeyword()}
                />
                <button onClick={addKeyword} className="btn-secondary shrink-0">{t('create.add')}</button>
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-slate-200 pt-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
              <svg className="h-4 w-4 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
              <span>{totalKeywords} question{totalKeywords > 1 ? 's' : ''} dans {themeGroups.length} thématique{themeGroups.length > 1 ? 's' : ''}</span>
            </div>
          </div>
          <div className="mt-6 flex justify-between">
            <button onClick={goBack} className="btn-secondary">{t('create.back')}</button>
            <button onClick={goNext} className="btn-primary">{totalKeywords > 0 ? t('create.next') : 'Passer'}</button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="step-content">
          <div className="glass-card space-y-5 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('create.confirmTitle')}</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Summary label={t('create.name')} value={name || '—'} />
              <Summary label="Fréquence" value={frequencyLabels[frequency]} />
              <Summary label={t('create.url')} value={targetUrl || '—'} mono />
              <Summary label="Modèles" value={`${selectedModelIds.length} modèle${selectedModelIds.length > 1 ? 's' : ''}`} />
              <Summary label={t('create.kw')} value={`${totalKeywords} requête${totalKeywords > 1 ? 's' : ''}`} />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/30">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Modèles sélectionnés</p>
              <div className="flex flex-wrap gap-2">
                {selectedModelIds.map((modelId) => (
                  <span key={modelId} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-300" title={modelId}>
                    {modelNameById.get(modelId) ?? modelId}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-500/20 dark:bg-amber-500/5">
              <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-300">{t('create.creditInfo')}</p>
                <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                  Environ {monthlyRequests} appels OpenRouter par mois ({totalKeywords} prompt{totalKeywords > 1 ? 's' : ''} × {selectedModelIds.length} modèle{selectedModelIds.length > 1 ? 's' : ''}).
                </p>
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-between">
            <button onClick={goBack} className="btn-secondary" disabled={submitting}>{t('create.back')}</button>
            <button className="btn-primary" onClick={handleSubmit} disabled={submitting || selectedModelIds.length === 0}>
              {submitting ? 'Création en cours...' : t('create.launch')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Summary({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-0.5 font-medium text-slate-900 dark:text-white ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
    </div>
  );
}
