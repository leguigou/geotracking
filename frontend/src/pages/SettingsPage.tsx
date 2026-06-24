import { useState } from 'react';
import { useTranslation } from 'react-i18next';

type SettingsTab = 'api' | 'members' | 'credits';

export default function SettingsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<SettingsTab>('api');
  const [webhookEnabled, setWebhookEnabled] = useState(true);

  const apiKeys = [
    {
      llm: 'OpenAI API Key',
      keyLabel: 'sk-••••••••••••••••f3k2',
      letter: 'C',
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-500/10',
      verified: true,
    },
    {
      llm: 'Anthropic API Key',
      keyLabel: 'sk-ant-••••••••••••••••a9x1',
      letter: 'C',
      color: 'text-violet-600 dark:text-violet-400',
      bg: 'bg-violet-500/10',
      verified: true,
    },
    {
      llm: 'Perplexity API Key',
      keyLabel: 'pplx-••••••••••••••••m4n7',
      letter: 'P',
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-500/10',
      verified: true,
    },
    {
      llm: 'Google AI API Key',
      keyLabel: t('settings.configure'),
      letter: 'G',
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-500/10',
      verified: false,
    },
  ];

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
    { key: 'api', label: t('settings.api') },
    { key: 'members', label: t('settings.members') },
    { key: 'credits', label: t('settings.credits') },
  ];

  return (
    <div>
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

      {/* API Tab */}
      {tab === 'api' && (
        <div className="space-y-6">
          {/* API Keys */}
          <div className="glass-card rounded-xl p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                {t('settings.apiKeys')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t('settings.apiKeysDesc')}
              </p>
            </div>
            <div className="space-y-4">
              {apiKeys.map((key, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg ${key.bg} ${key.color} flex items-center justify-center text-xs font-bold`}
                    >
                      {key.letter}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {key.llm}
                      </p>
                      <p className="text-xs text-slate-500">{key.keyLabel}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {key.verified ? (
                      <>
                        <span className="badge bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                          {t('settings.verified')}
                        </span>
                        <button className="btn-ghost text-xs">
                          {t('settings.edit')}
                        </button>
                      </>
                    ) : (
                      <button className="btn-secondary text-xs">
                        {t('settings.configure')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
              <button className="btn-primary text-xs">
                {t('settings.addKey')}
              </button>
            </div>
          </div>

          {/* Webhook */}
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  {t('settings.webhook')}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t('settings.webhookDesc')}
                </p>
              </div>
              <button
                onClick={() => setWebhookEnabled(!webhookEnabled)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full cursor-pointer transition-colors duration-200 ${
                  webhookEnabled
                    ? 'bg-blue-600'
                    : 'bg-slate-300 dark:bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    webhookEnabled ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
            {webhookEnabled && (
              <div className="mt-3">
                <input
                  type="text"
                  className="input-field text-xs font-mono"
                  value="https://hooks.acmecorp.com/geotrack/alerts"
                  readOnly
                />
              </div>
            )}
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
