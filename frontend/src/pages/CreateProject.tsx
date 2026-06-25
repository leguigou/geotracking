import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api, { type OpenRouterModel } from '../lib/api';

const steps = ['create.step1', 'create.step2', 'create.step3', 'create.step4'] as const;

const llms = [
  { id: 'chatgpt', label: 'ChatGPT', sublabel: 'GPT-4o, GPT-4-turbo, GPT-3.5', letter: 'C', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
  { id: 'claude', label: 'Claude', sublabel: 'Claude 3 Opus, Sonnet, Haiku', letter: 'C', color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10' },
  { id: 'perplexity', label: 'Perplexity', sublabel: 'Perplexity Pro', letter: 'P', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
  { id: 'gemini', label: 'Gemini', sublabel: 'Gemini 1.5 Pro, Flash', letter: 'G', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
  { id: 'grok', label: 'Grok', sublabel: 'Grok-2', letter: 'X', color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-500/10' },
  { id: 'deepseek', label: 'DeepSeek', sublabel: 'DeepSeek V3, R1', letter: 'D', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10' },
];

const providerPrefixes: Record<string, string> = {
  chatgpt: 'openai/', claude: 'anthropic/', perplexity: 'perplexity/',
  gemini: 'google/', grok: 'x-ai/', deepseek: 'deepseek/',
};

const modelPrice = (model?: OpenRouterModel) => {
  if (!model) return '';
  const input = Number(model.pricing.prompt ?? 0) * 1_000_000;
  const output = Number(model.pricing.completion ?? 0) * 1_000_000;
  return `$${input.toFixed(2)} / $${output.toFixed(2)} par M tokens`;
};

export default function CreateProject() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

// Form state
  const [name, setName] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState('weekly');
  const [selectedLlms, setSelectedLlms] = useState<string[]>(['chatgpt', 'claude', 'perplexity']);
  const [modelPresets, setModelPresets] = useState<Record<string, OpenRouterModel>>({});
  const [availableModels, setAvailableModels] = useState<OpenRouterModel[]>([]);
  const [selectedModels, setSelectedModels] = useState<Record<string, string>>({});
  const [loadingModels, setLoadingModels] = useState(true);
  const [themeGroups, setThemeGroups] = useState<{ theme: string; keywords: string[] }[]>([
    { theme: '', keywords: [] },
  ]);
  const [activeThemeIdx, setActiveThemeIdx] = useState(0);
  const [keywordInput, setKeywordInput] = useState('');

  const themes = ['Piscine', 'Jardin', 'Équipement', 'Mode', 'Autre'];

  const addThemeGroup = (preset?: string) => {
    setThemeGroups([...themeGroups, { theme: preset || '', keywords: [] }]);
    setActiveThemeIdx(themeGroups.length);
  };

  const removeThemeGroup = (idx: number) => {
    if (themeGroups.length <= 1) return;
    const updated = themeGroups.filter((_, i) => i !== idx);
    setThemeGroups(updated);
    if (activeThemeIdx >= updated.length) setActiveThemeIdx(updated.length - 1);
  };

  const updateThemeName = (idx: number, name: string) => {
    const updated = [...themeGroups];
    updated[idx] = { ...updated[idx], theme: name };
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

  const removeKeyword = (themeIdx: number, kw: string) => {
    const updated = [...themeGroups];
    updated[themeIdx] = {
      ...updated[themeIdx],
      keywords: updated[themeIdx].keywords.filter((k) => k !== kw),
    };
    setThemeGroups(updated);
  };

  const totalKeywords = themeGroups.reduce((sum, g) => sum + g.keywords.length, 0);

  useEffect(() => {
    api.getAvailableModels()
      .then((data) => {
        const recommended = data.recommended || {};
        setModelPresets(recommended);
        setAvailableModels(data.models);
        setSelectedModels(Object.fromEntries(Object.entries(recommended).map(([provider, model]) => [provider, model.id])));
        setSelectedLlms((current) => {
          const available = current.filter((provider) => recommended[provider]);
          return available.length > 0 ? available : Object.keys(recommended).slice(0, 3);
        });
      })
      .finally(() => setLoadingModels(false));
  }, []);

  const goNext = () => {
    if (step < 4) setStep(step + 1);
  };

  const goBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const toggleLlm = (id: string) => {
    setSelectedLlms((prev) =>
      prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const enabledModels = selectedLlms
        .map((provider) => selectedModels[provider] || modelPresets[provider]?.id)
        .filter((model): model is string => Boolean(model));
      if (enabledModels.length === 0) {
        throw new Error('Aucun modèle OpenRouter valide n’est disponible');
      }
      const project = (await api.createProject({
        name,
        target_url: targetUrl,
        description: description || undefined,
        brand_names: [name],
        enabled_models: enabledModels,
        frequency,
      })) as { id: string };

      // Créer les prompts par groupe de thématique
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

  const runsPerMonth: Record<string, number> = { daily: 30, weekly: 4.3, biweekly: 2.2, monthly: 1 };
  const monthlyRequests = Math.ceil(totalKeywords * selectedLlms.length * (runsPerMonth[frequency] ?? 1));
  const frequencyLabels: Record<string, string> = {
    daily: 'Quotidienne', weekly: 'Hebdomadaire', biweekly: 'Toutes les deux semaines', monthly: 'Mensuelle',
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('create.title')}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {t('create.subtitle')}
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-10 px-4">
        {steps.map((key, i) => {
          const stepNum = i + 1;
          const isCompleted = stepNum < step;
          const isActive = stepNum === step;
          return (
            <div key={i} className="flex items-center flex-1">
              <div
                className={`progress-step flex flex-col items-center ${
                  isCompleted ? 'completed' : ''
                } ${isActive ? 'active' : ''}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 border-2 ${
                    isCompleted
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : isActive
                      ? 'border-blue-600 text-blue-600 bg-blue-50 dark:bg-blue-500/10'
                      : 'border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {stepNum}
                </div>
                <span className="text-xs mt-1.5 font-medium text-slate-500 dark:text-slate-400">
                  {t(key)}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`flex-1 h-px mx-3 ${
                    stepNum < step ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step 1: Site Info */}
      {step === 1 && (
        <div className="step-content">
          <div className="glass-card rounded-xl p-6 space-y-5">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {t('create.siteInfo')}
            </h2>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {t('create.url')}
              </label>
              <div className="flex gap-2">
                <span className="inline-flex items-center px-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm text-slate-500 border border-slate-200 dark:border-slate-700">
                  https://
                </span>
                <input
                  type="url"
                  className="input-field flex-1"
                  placeholder="monsite.com"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                />
              </div>
              {targetUrl && !/^[a-zA-Z0-9][-a-zA-Z0-9.]*\.[a-zA-Z]{2,}(\/.*)?$/.test(targetUrl) && (
                <p className="mt-1 text-xs text-red-500">Format d'URL invalide (ex: monsite.com)</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {t('create.name')}
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="Mon Projet"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {t('create.description')}
              </label>
              <textarea
                className="input-field resize-none"
                rows={3}
                placeholder={t('create.descPlaceholder')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Fréquence automatique</label>
              <select className="input-field w-full" value={frequency} onChange={(event) => setFrequency(event.target.value)}>
                <option value="daily">Quotidienne</option>
                <option value="weekly">Hebdomadaire</option>
                <option value="biweekly">Toutes les deux semaines</option>
                <option value="monthly">Mensuelle</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <button onClick={goNext} className="btn-primary" disabled={!name || !targetUrl}>
              {t('create.next')}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: LLM Selection */}
      {step === 2 && (
        <div className="step-content">
          <div className="glass-card rounded-xl p-6 space-y-5">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {t('create.selectLLMs')}
            </h2>
            <div className="space-y-3">
              {llms.map((llm) => {
                const preset = modelPresets[llm.id];
                return (
                <label
                  key={llm.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                    checked={selectedLlms.includes(llm.id)}
                    onChange={() => toggleLlm(llm.id)}
                    disabled={!preset}
                  />
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-lg ${llm.bg} ${llm.color} flex items-center justify-center text-xs font-bold`}
                    >
                      {llm.letter}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {llm.label}
                      </p>
                      <p className="text-xs text-slate-500">
                        {loadingModels ? 'Recherche du modèle OpenRouter…' : modelPrice(availableModels.find((model) => model.id === selectedModels[llm.id])) || 'Indisponible sur OpenRouter'}
                      </p>
                      {preset && (
                        <select
                          className="input-field text-xs mt-2 w-full"
                          value={selectedModels[llm.id] || preset.id}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => setSelectedModels((current) => ({ ...current, [llm.id]: event.target.value }))}
                        >
                          {availableModels
                            .filter((model) => model.id.startsWith(providerPrefixes[llm.id]))
                            .map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
                        </select>
                      )}
                    </div>
                  </div>
                </label>
              );})}
            </div>
          </div>
          <div className="flex justify-between mt-6">
            <button onClick={goBack} className="btn-secondary">
              {t('create.back')}
            </button>
            <button onClick={goNext} className="btn-primary" disabled={selectedLlms.length === 0 || loadingModels}>
              {t('create.next')}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Keywords grouped by theme */}
      {step === 3 && (
        <div className="step-content">
          <div className="glass-card rounded-xl p-6 space-y-5">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {t('create.keywords')}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('create.keywordsDesc')}
            </p>

            {/* Theme tabs */}
            <div className="flex flex-wrap gap-2">
              {themeGroups.map((group, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveThemeIdx(idx)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    idx === activeThemeIdx
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border border-blue-300 dark:border-blue-500/30'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-transparent hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {group.theme || `Thème ${idx + 1}`}
                  <span className="ml-0.5 text-[10px] opacity-60">({group.keywords.length})</span>
                  {themeGroups.length > 1 && (
                    <svg className="w-3 h-3 ml-0.5 cursor-pointer hover:text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" onClick={(e) => { e.stopPropagation(); removeThemeGroup(idx); }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </button>
              ))}
              <button
                onClick={() => addThemeGroup()}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 border border-dashed border-blue-300 dark:border-blue-500/30 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Ajouter un thème
              </button>
            </div>

            {/* Active theme group */}
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Nom de la thématique
              </label>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  className="input-field flex-1"
                  placeholder="Ex: Piscine, Jardin, Équipement…"
                  value={themeGroups[activeThemeIdx]?.theme || ''}
                  onChange={(e) => updateThemeName(activeThemeIdx, e.target.value)}
                />
                {/* Preset theme buttons */}
                <div className="flex gap-1 flex-wrap items-center">
                  {themes.map((t) => (
                    <button
                      key={t}
                      onClick={() => updateThemeName(activeThemeIdx, t)}
                      className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                        themeGroups[activeThemeIdx]?.theme === t
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Questions / mots-clés
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {themeGroups[activeThemeIdx]?.keywords.map((kw) => (
                  <span
                    key={kw}
                    className="badge bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20"
                  >
                    {kw}
                    <button
                      onClick={() => removeKeyword(activeThemeIdx, kw)}
                      className="ml-1 hover:text-blue-500"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input-field flex-1"
                  placeholder="Ajouter une question…"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                />
                <button onClick={addKeyword} className="btn-secondary shrink-0">
                  {t('create.add')}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700">
              <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <span>{totalKeywords} question{totalKeywords > 1 ? 's' : ''} dans {themeGroups.length} thématique{themeGroups.length > 1 ? 's' : ''}</span>
            </div>
          </div>
          <div className="flex justify-between mt-6">
            <button onClick={goBack} className="btn-secondary">
              {t('create.back')}
            </button>
            <button onClick={goNext} className="btn-primary">
              {totalKeywords > 0 ? t('create.next') : 'Passer'}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Confirm */}
      {step === 4 && (
        <div className="step-content">
          <div className="glass-card rounded-xl p-6 space-y-5">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {t('create.confirmTitle')}
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('create.name')}
                </p>
                <p className="font-medium text-slate-900 dark:text-white mt-0.5">
                  {name || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Fréquence</p>
                <p className="font-medium text-slate-900 dark:text-white mt-0.5">{frequencyLabels[frequency]}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('create.url')}
                </p>
                <p className="font-medium text-slate-900 dark:text-white mt-0.5 font-mono text-xs">
                  {targetUrl || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('create.llms')}
                </p>
                <p className="font-medium text-slate-900 dark:text-white mt-0.5">
                  {selectedLlms
                    .map((id) => llms.find((l) => l.id === id)?.label)
                    .filter(Boolean)
                    .join(', ') || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('create.kw')}
                </p>
                <p className="font-medium text-slate-900 dark:text-white mt-0.5">
                  {totalKeywords} requête{totalKeywords > 1 ? 's' : ''} dans {themeGroups.length} thématique{themeGroups.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-lg p-3 flex items-start gap-3 text-sm">
              <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-300">
                  {t('create.creditInfo')}
                </p>
                <p className="text-amber-700 dark:text-amber-400 text-xs mt-0.5">
                  Environ {monthlyRequests} appels OpenRouter par mois ({totalKeywords} prompt{totalKeywords > 1 ? 's' : ''} × {selectedLlms.length} modèle{selectedLlms.length > 1 ? 's' : ''}).
                </p>
              </div>
            </div>
          </div>
          <div className="flex justify-between mt-6">
            <button onClick={goBack} className="btn-secondary" disabled={submitting}>
              {t('create.back')}
            </button>
            <button
              className="btn-primary"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Création en cours…' : t('create.launch')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
