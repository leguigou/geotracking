import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const steps = ['create.step1', 'create.step2', 'create.step3', 'create.step4'] as const;

const llms = [
  { id: 'chatgpt', label: 'ChatGPT', sublabel: 'GPT-4o, GPT-4-turbo, GPT-3.5', letter: 'C', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
  { id: 'claude', label: 'Claude', sublabel: 'Claude 3 Opus, Sonnet, Haiku', letter: 'C', color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10' },
  { id: 'perplexity', label: 'Perplexity', sublabel: 'Perplexity Pro', letter: 'P', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
  { id: 'gemini', label: 'Gemini', sublabel: 'Gemini 1.5 Pro, Flash', letter: 'G', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
];

const initialKeywords = ['CRM PME 2026', 'marketing automation', 'gestion projet agile', 'emailing e-commerce'];

export default function CreateProject() {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [selectedLlms, setSelectedLlms] = useState<string[]>(['chatgpt', 'claude', 'perplexity']);
  const [keywords, setKeywords] = useState<string[]>(initialKeywords);
  const [keywordInput, setKeywordInput] = useState('');

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

  const addKeyword = () => {
    const trimmed = keywordInput.trim();
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords([...keywords, trimmed]);
      setKeywordInput('');
    }
  };

  const removeKeyword = (kw: string) => {
    setKeywords(keywords.filter((k) => k !== kw));
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
                  type="text"
                  className="input-field flex-1"
                  placeholder="monsite.com"
                  defaultValue="acmecorp"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {t('create.name')}
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="Mon Projet"
                defaultValue="Acme Corp"
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
              />
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <button onClick={goNext} className="btn-primary">
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
              {llms.map((llm) => (
                <label
                  key={llm.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                    checked={selectedLlms.includes(llm.id)}
                    onChange={() => toggleLlm(llm.id)}
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
                      <p className="text-xs text-slate-500">{llm.sublabel}</p>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-between mt-6">
            <button onClick={goBack} className="btn-secondary">
              {t('create.back')}
            </button>
            <button onClick={goNext} className="btn-primary">
              {t('create.next')}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Keywords */}
      {step === 3 && (
        <div className="step-content">
          <div className="glass-card rounded-xl p-6 space-y-5">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {t('create.keywords')}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('create.keywordsDesc')}
            </p>
            <div className="flex flex-wrap gap-2 mb-2">
              {keywords.map((kw) => (
                <span
                  key={kw}
                  className="badge bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20"
                >
                  {kw}
                  <button
                    onClick={() => removeKeyword(kw)}
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
                placeholder="Ajouter un mot-clé..."
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
              />
              <button onClick={addKeyword} className="btn-secondary shrink-0">
                {t('create.add')}
              </button>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700">
              <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <span>{t('create.keywordsTip')}</span>
            </div>
          </div>
          <div className="flex justify-between mt-6">
            <button onClick={goBack} className="btn-secondary">
              {t('create.back')}
            </button>
            <button onClick={goNext} className="btn-primary">
              {t('create.next')}
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
                  Acme Corp
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('create.url')}
                </p>
                <p className="font-medium text-slate-900 dark:text-white mt-0.5 font-mono text-xs">
                  acmecorp.com
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
                    .join(', ')}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('create.kw')}
                </p>
                <p className="font-medium text-slate-900 dark:text-white mt-0.5">
                  {keywords.length} requêtes
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
                <p
                  className="text-amber-700 dark:text-amber-400 text-xs mt-0.5"
                  dangerouslySetInnerHTML={{ __html: t('create.creditDetail') }}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-between mt-6">
            <button onClick={goBack} className="btn-secondary">
              {t('create.back')}
            </button>
            <button className="btn-primary" onClick={() => alert('Projet lancé !')}>
              {t('create.launch')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
