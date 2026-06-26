import { useState } from 'react';

interface HelpTooltipProps {
  title: string;
  children: string;
}

export default function HelpTooltip({ title, children }: HelpTooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-[11px] font-bold text-slate-500 shadow-sm transition hover:border-blue-300 hover:text-blue-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-300"
        aria-label={`Aide : ${title}`}
      >
        ?
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 px-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-4">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Fermer l'aide"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{children}</p>
            <button type="button" onClick={() => setOpen(false)} className="btn-primary mt-5 w-full justify-center">
              J'ai compris
            </button>
          </div>
        </div>
      )}
    </>
  );
}
