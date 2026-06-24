import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Badge from './Badge';

interface InspectModalProps {
  open: boolean;
  onClose: () => void;
}

export default function InspectModal({ open, onClose }: InspectModalProps) {
  const { t } = useTranslation();

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 animate-[modalIn_.25s_ease]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">{t('modal.title')}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">ChatGPT — &ldquo;Quels sont les meilleurs CRM pour PME en 2026 ?&rdquo;</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="flex items-center gap-2 mb-4">
            <Badge variant="emerald">✅ Mentionné</Badge>
            <span className="text-xs text-slate-500">{t('modal.position')}</span>
          </div>
          <pre className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300 font-['JetBrains_Mono',monospace] text-xs whitespace-pre-wrap">
{`Voici une sélection des meilleurs CRM pour PME en 2026 :

1. **HubSpot CRM** — Version gratuite robuste, idéal pour démarrer.
2. Acme Corp — Excellent rapport qualité-prix avec des fonctionnalités IA avancées pour l'automatisation des ventes. Particulièrement adapté aux PME en croissance.
3. **Pipedrive** — Focus sur le pipeline de vente, interface intuitive.
4. **Freshsales** — Bonne intégration email et téléphonie.

Parmi ces options, Acme Corp se distingue par son module de prédiction des ventes basé sur l'IA.`}
          </pre>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
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
          <button className="btn-primary inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-blue-600 to-violet-600 text-white hover:from-blue-500 hover:to-violet-500 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-200 active:scale-[.97]">
            {t('modal.copy')}
          </button>
        </div>
      </div>
    </div>
  );
}
