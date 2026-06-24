import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';

type SettingsTab = 'general' | 'members' | 'credits';

const modelsList = [
  { id: 'chatgpt', label: 'ChatGPT' },
  { id: 'claude', label: 'Claude' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'perplexity', label: 'Perplexity' },
  { id: 'grok', label: 'Grok' },
];

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<SettingsTab>('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Settings form state
  const [apiKey, setApiKey] = useState('');
  const [modelsEnabled, setModelsEnabled] = useState<string[]>([]);
  const [temperature, setTemperature] = useState(0.7);
  const [frequency, setFrequency] = useState('weekly');
  const [notifications, setNotifications] = useState(true);
  const [language, setLanguage] = useState('fr');

  // OpenRouter test state
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  const handleTestKey = async () => {
    setTestStatus('testing');
    setTestMessage('');
    try {
      const result = await api.testOpenRouterKey();
      setTestStatus(result.status as 'ok' | 'error');
      setTestMessage(result.message);
    } catch {
      setTestStatus('error');
      setTestMessage('Erreur réseau ou clé non configurée');
    }
  };

  // Load settings on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const settings = await api.getSettings();
        if (cancelled) return;
        setApiKey((settings.openrouter_api_key as string) || '');
        setModelsEnabled(
          Array.isArray(settings.models_enabled)
            ? (settings.models_enabled as string[])
            : ['chatgpt', 'claude']
        );
        setTemperature(
          settings.temperature != null ? Number(settings.temperature) : 0.7
        );
        setFrequency((settings.frequency as string) || 'weekly');
        setNotifications(
          settings.notifications_enabled != null
            ? Boolean(settings.notifications_enabled)
            : true
        );
        setLanguage((settings.language as string) || 'fr');
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggleModel = (id: string) => {
    setModelsEnabled((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateSettings({
        openrouter_api_key: apiKey || undefined,
        models_enabled: modelsEnabled,
        temperature,
        frequency,
        notifications_enabled: notifications,
        language,
      });
      showToast('Paramètres sauvegardés');
    } catch (err) {
      console.error('Failed to save settings:', err);
      alert(`Erreur : ${err instanceof Error ? err.message : 'Échec de la sauvegarde'}`);
    } finally {
      setSaving(false);
    }
  };

  const teamMembers = [
    {
      initials: 'AC',
      name: 'Alex Chen',
      email: 'alex@agence.fr',
      role: 'admin' as const,
      gradient: 'from-blue-500 to-violet-500',
    },
    {
      initials: 'SM',
      name: 'Sarah Martin',
      email: 'sarah@agence.fr',
      role: 'editor' as const,
      bg: 'bg-emerald-500',
    },
    {
      initials: 'TL',
      name: 'Thomas Lee',
      email: 'thomas@agence.fr',
      role: 'viewer' as const,
      bg: 'bg-amber-500',
    },
  ];

  const roleBadge = (role: 'admin' | 'editor' | 'viewer') => {
    const config = {
      admin: {
        className:
          'badge bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20',
        label: t('settings.admin'),
      },
      editor: {
        className:
          'badge bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20',
        label: t('settings.editor'),
      },
      viewer: {
        className:
          'badge bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20',
        label: t('settings.viewer'),
      },
    };
    return config[role];
  };

  const tabs: { key: SettingsTab; label: string }[] = [
    { key: 'general', label: t('settings.general') },
    { key: 'members', label: t('settings.members') },
    { key: 'credits', label: t('settings.credits') },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-slate-500 dark:text-slate-400">Chargement…</p>
      </div>
    );
  }

  return (
    <div>
      {/* Toast notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium animate-fade-in">
          {toast}
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('settings.title')}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {t('settings.subtitle')}
        </p>
      </div>

      {/* Settings Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              tab === key
                ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* General Tab — Settings form */}
      {tab === 'general' && (
        <div className="space-y-6 max-w-2xl">
          {/* API & Provider */}
          <div className="glass-card rounded-xl p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                API & Provider
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Configurez votre clé OpenRouter pour accéder aux modèles.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                OpenRouter API Key
              </label>
              <div className="flex gap-2 items-start">
                <input
                  type="password"
                  className="input-field font-mono flex-1"
                  placeholder="sk-or-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <button
                  onClick={handleTestKey}
                  disabled={testStatus === 'testing'}
                  className={`btn-primary shrink-0 px-4 py-2.5 text-xs ${
                    testStatus === 'testing' ? 'opacity-50 cursor-wait' : ''
                  }`}
                >
                  {testStatus === 'testing' ? 'Test...' : 'Tester'}
                </button>
              </div>
              {testStatus === 'ok' && (
                <p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {testMessage}
                </p>
              )}
              {testStatus === 'error' && (
                <p className="mt-1.5 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  {testMessage}
                </p>
              )}
            </div>
          </div>

          {/* Modèles */}
          <div className="glass-card rounded-xl p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Modèles
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Activez ou désactivez les LLMs à tracker.
              </p>
            </div>
            <div className="space-y-2">
              {modelsList.map((model) => (
                <label
                  key={model.id}
                  className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                    checked={modelsEnabled.includes(model.id)}
                    onChange={() => toggleModel(model.id)}
                  />
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {model.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Configuration */}
          <div className="glass-card rounded-xl p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Configuration
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Réglages généraux de tracking.
              </p>
            </div>
            {/* Température */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Température : {temperature.toFixed(1)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                className="w-full accent-blue-600"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>Précis (0)</span>
                <span>Céatif (1)</span>
              </div>
            </div>
            {/* Fréquence */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Fréquence de tracking
              </label>
              <select
                className="input-field"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
              >
                <option value="daily">Quotidien</option>
                <option value="weekly">Hebdomadaire</option>
                <option value="biweekly">Bi-hebdomadaire</option>
                <option value="monthly">Mensuel</option>
              </select>
            </div>
          </div>

          {/* Notifications */}
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Notifications
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Recevoir des alertes SOV par email.
                </p>
              </div>
              <button
                onClick={() => setNotifications(!notifications)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full cursor-pointer transition-colors duration-200 ${
                  notifications
                    ? 'bg-blue-600'
                    : 'bg-slate-300 dark:bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    notifications ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Langue */}
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Langue
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Langue de l'interface.
                </p>
              </div>
              <select
                className="input-field w-40"
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value);
                  i18n.changeLanguage(e.target.value);
                }}
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>

          {/* Save button */}
          <div className="flex justify-end">
            <button
              className="btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Sauvegarde…' : 'Sauvegarder'}
            </button>
          </div>
        </div>
      )}

      {/* Members Tab */}
      {tab === 'members' && (
        <div className="space-y-6">
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  {t('settings.team')}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t('settings.teamDesc')}
                </p>
              </div>
              <button className="btn-primary text-xs">
                {t('settings.invite')}
              </button>
            </div>
            <div className="space-y-3">
              {teamMembers.map((member, i) => {
                const badge = roleBadge(member.role);
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700"
                  >
                    <div
                      className={`w-9 h-9 rounded-full bg-gradient-to-br ${
                        member.gradient || member.bg
                      } flex items-center justify-center text-white text-xs font-bold`}
                    >
                      {member.initials}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {member.name}
                      </p>
                      <p className="text-xs text-slate-500">{member.email}</p>
                    </div>
                    <span className={badge.className}>{badge.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Credits Tab */}
      {tab === 'credits' && (
        <div className="space-y-6">
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  {t('settings.plan')}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t('settings.planDesc')}
                </p>
              </div>
              <span className="badge bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 text-xs font-bold uppercase">
                {t('settings.pro')}
              </span>
            </div>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-bold text-slate-900 dark:text-white">
                €89
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {t('settings.perMonth')}
              </span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">
                  {t('settings.creditsUsed')}
                </span>
                <span className="font-medium text-slate-900 dark:text-white">
                  <span className="num">24 560</span> /{' '}
                  <span className="num">50 000</span>
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-blue-500 to-violet-500 h-2 rounded-full"
                  style={{ width: '49%' }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>{t('settings.resetDate')}</span>
                <span>49%</span>
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-700">
              <button className="btn-secondary text-xs w-full">
                {t('settings.upgrade')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
