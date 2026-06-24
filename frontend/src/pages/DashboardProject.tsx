import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import TrendChart from '../components/TrendChart';
import PromptMatrix from '../components/PromptMatrix';

export default function DashboardProject() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState('last30d');

  const sovCards = [
    { llm: 'ChatGPT', model: 'GPT-4o / GPT-4-turbo', value: 42, change: '+8%', changeColor: 'text-emerald-600 dark:text-emerald-400', barColor: 'bg-emerald-500', iconLetter: 'C', iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-600 dark:text-emerald-400', promptsTracked: '124' },
    { llm: 'Claude', model: 'Claude 3 Opus / Sonnet', value: 38, change: '+5%', changeColor: 'text-emerald-600 dark:text-emerald-400', barColor: 'bg-violet-500', iconLetter: 'C', iconBg: 'bg-violet-500/10', iconColor: 'text-violet-600 dark:text-violet-400', promptsTracked: '98' },
    { llm: 'Perplexity', model: 'Perplexity Pro', value: 15, change: '+2%', changeColor: 'text-amber-600 dark:text-amber-400', barColor: 'bg-amber-500', iconLetter: 'P', iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-600 dark:text-emerald-400', promptsTracked: '67' },
    { llm: 'Gemini', model: 'Gemini 1.5 Pro', value: 0, change: t('project.notConfigured'), changeColor: 'text-red-600 dark:text-red-400', barColor: 'bg-red-500', iconLetter: 'G', iconBg: 'bg-red-500/10', iconColor: 'text-red-600 dark:text-red-400', promptsTracked: t('project.notConfigured') },
  ];

  const prompts = [
    { id: 1, prompt: '"Quels sont les meilleurs CRM pour PME en 2026 ?"', chatgpt: true, claude: true, perplexity: true, gemini: false, date: '23 juin' },
    { id: 2, prompt: '"Comparatif outils de marketing automation 2026"', chatgpt: true, claude: false, perplexity: true, gemini: false, date: '22 juin' },
    { id: 3, prompt: '"Solution SaaS pour gestion de projet agile"', chatgpt: true, claude: true, perplexity: false, gemini: true, date: '21 juin' },
    { id: 4, prompt: '"Top plateformes emailing pour e-commerce 2026"', chatgpt: true, claude: true, perplexity: true, gemini: true, date: '20 juin' },
    { id: 5, prompt: '"Quelle solution analytics choisir en 2026 ?"', chatgpt: false, claude: true, perplexity: false, gemini: false, date: '19 juin' },
  ];

  const chartLabels = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Sem 6', 'Sem 7', 'Sem 8'];
  const chartDatasets = [
    { label: 'ChatGPT', data: [18, 22, 25, 28, 32, 36, 39, 42], borderColor: '#3b82f6' },
    { label: 'Claude', data: [12, 15, 18, 22, 26, 30, 34, 38], borderColor: '#8b5cf6' },
    { label: 'Perplexity', data: [5, 7, 8, 10, 11, 12, 14, 15], borderColor: '#10b981' },
    { label: 'Gemini', data: [0, 0, 0, 0, 1, 0, 0, 0], borderColor: '#f59e0b', borderDash: [4, 3] },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-2">
        <span className="cursor-pointer hover:text-slate-700 dark:hover:text-slate-300">{t('nav.dashboard')}</span>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
        <span className="text-slate-900 dark:text-white font-medium">Acme Corp</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Acme Corp</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
              <span>{t('project.url')}</span> : <span className="font-mono text-xs text-slate-700 dark:text-slate-300">acmecorp.com</span>
              <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">{t('project.active')}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-all duration-200 bg-slate-100 dark:bg-slate-800 text-xs">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span>{t('project.inspect')}</span>
          </button>
          <button className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-blue-600 to-violet-600 text-white hover:from-blue-500 hover:to-violet-500 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-200 active:scale-[.97] text-xs">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg>
            <span>{t('project.refresh')}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {sovCards.map((card, i) => (
          <div key={i} className="rounded-xl p-5 transition-all duration-200 cursor-default bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 hover:shadow-md">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-8 h-8 rounded-lg ${card.iconBg} ${card.iconColor} flex items-center justify-center text-xs font-bold`}>{card.iconLetter}</div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{card.llm}</p>
                <p className="text-[10px] text-slate-400">{card.model}</p>
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-slate-900 dark:text-white num">{card.value}%</span>
              <span className={`text-xs font-medium ${card.changeColor}`}>{card.change}</span>
            </div>
            <div className="mt-3 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
              <div className={`${card.barColor} h-1.5 rounded-full`} style={{ width: `${Math.max(card.value, 2)}%` }} />
            </div>
            <p className="text-xs text-slate-400 mt-2">{card.promptsTracked} {t('project.promptsTracked')}</p>
          </div>
        ))}
      </div>

      <div className="glass-card rounded-xl p-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{t('project.trendTitle', { name: 'Acme Corp' })}</h2>
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className="text-xs bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-600 dark:text-slate-400 outline-none">
            <option value="last7d">{t('project.last7d')}</option>
            <option value="last30d">{t('project.last30d')}</option>
            <option value="last90d">{t('project.last90d')}</option>
          </select>
        </div>
        <TrendChart chartId="trendProject" labels={chartLabels} datasets={chartDatasets} />
      </div>

      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{t('project.promptMatrix')}</h2>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> {t('project.mentioned')}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> {t('project.absent')}</span>
          </div>
        </div>
        <PromptMatrix prompts={prompts} />
      </div>
    </div>
  );
}
