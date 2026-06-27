import { useState, type ReactNode } from 'react';
import api, { type GeoAuditFinding, type GeoAuditPriority, type GeoAuditReport } from '../lib/api';

const priorityMeta: Record<GeoAuditPriority, { label: string; classes: string; dot: string }> = {
  critical: { label: 'Critique', classes: 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200', dot: 'bg-red-500' },
  high: { label: 'Urgent', classes: 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-200', dot: 'bg-orange-500' },
  medium: { label: 'Important', classes: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200', dot: 'bg-amber-400' },
  low: { label: 'Amélioration', classes: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200', dot: 'bg-blue-500' },
};

const errorMessage = (error: unknown) => {
  const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return detail || (error instanceof Error ? error.message : 'Impossible de générer cet audit.');
};

export default function GeoAuditPage() {
  const [url, setUrl] = useState('');
  const [brand, setBrand] = useState('');
  const [useAi, setUseAi] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<GeoAuditReport | null>(null);

  const runAudit = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    setReport(null);
    try {
      setReport(await api.createGeoAudit({ url: url.trim(), brand: brand.trim(), use_ai: useAi }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const exportPdf = () => {
    const previousTitle = document.title;
    let hostname = 'site';
    try {
      hostname = new URL(report?.final_url || 'https://site').hostname;
    } catch {
      // Keep the safe fallback filename.
    }
    document.title = `audit-geo-${hostname}`;
    window.print();
    window.setTimeout(() => { document.title = previousTitle; }, 500);
  };

  return (
    <div className="geo-audit-page">
      <header className="no-print mb-6">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">Audit de visibilité IA</p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Audit GEO d’une URL</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
          Vérifie robots.txt, les robots des LLM, le sitemap, les données structurées, le contenu et les signaux qui aident les assistants IA à comprendre et citer une marque.
        </p>
      </header>

      <section className="no-print glass-card mb-7 rounded-2xl border border-slate-200 p-4 dark:border-slate-700 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)]">
          <Field label="URL publique à analyser" htmlFor="audit-url">
            <input
              id="audit-url"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && !loading && runAudit()}
              className="input-field"
              placeholder="https://www.monsite.fr/page"
            />
          </Field>
          <Field label="Marque à rechercher (facultatif)" htmlFor="audit-brand">
            <input id="audit-brand" value={brand} onChange={(event) => setBrand(event.target.value)} className="input-field" placeholder="Ex. Cabesto" />
          </Field>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={useAi} onChange={(event) => setUseAi(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600" />
            <span>
              Générer un résumé avec le modèle assistant sélectionné
              <span className="block text-xs text-slate-400">Le modèle se choisit dans Paramètres. L’audit technique fonctionne même sans lui.</span>
            </span>
          </label>
          <button type="button" onClick={runAudit} disabled={loading || !url.trim()} className="btn-primary min-w-44 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Analyse en cours…</> : 'Lancer l’audit GEO'}
          </button>
        </div>
        {loading && (
          <p className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
            Lecture de la page, de robots.txt, du sitemap et de llms.txt, puis génération des préconisations…
          </p>
        )}
        {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
      </section>

      {report && <AuditReport report={report} onExportPdf={exportPdf} />}
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return <div><label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</label>{children}</div>;
}

function AuditReport({ report, onExportPdf }: { report: GeoAuditReport; onExportPdf: () => void }) {
  return (
    <div className="geo-audit-report space-y-6">
      <div className="print-only hidden"><h1>Rapport d’audit GEO</h1><p>{report.final_url}</p></div>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Rapport généré le {new Date(report.generated_at).toLocaleString('fr-FR')}</p>
            <h2 className="mt-1 break-words text-xl font-bold text-slate-900 dark:text-white">{report.final_url}</h2>
            {report.brand && <p className="mt-1 text-sm text-slate-500">Marque recherchée : <strong>{report.brand}</strong></p>}
          </div>
          <div className="flex items-center gap-4">
            <Score score={report.score} />
            <button type="button" onClick={onExportPdf} className="no-print btn-primary">Exporter en PDF</button>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(priorityMeta) as GeoAuditPriority[]).map((priority) => (
            <div key={priority} className={`rounded-xl border p-3 ${priorityMeta[priority].classes}`}>
              <p className="text-[10px] font-semibold uppercase tracking-wide">{priorityMeta[priority].label}</p>
              <p className="mt-1 text-2xl font-bold">{report.priority_counts[priority] || 0}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-violet-200 bg-violet-50/60 p-5 dark:border-violet-500/20 dark:bg-violet-500/5 sm:p-6">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Résumé IA de l’audit GEO</h2>
        <p className="mb-3 text-xs text-slate-500">
          {report.ai_model ? `Généré par le modèle assistant sélectionné : ${report.ai_model}` : 'Résumé IA non généré'}
        </p>
        {report.ai_summary ? (
          <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-200">{report.ai_summary}</div>
        ) : (
          <p className="rounded-xl border border-dashed border-violet-200 p-4 text-sm text-slate-500 dark:border-violet-500/20">
            {report.ai_warning || 'La génération du résumé IA était désactivée. Les préconisations techniques restent disponibles.'}
          </p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Plan d’action priorisé</h2>
        <p className="mb-3 text-sm text-slate-500">Du plus urgent au moins urgent, avec le constat observé et l’action recommandée.</p>
        {report.findings.length ? (
          <div className="space-y-3">{report.findings.map((finding, index) => <Finding key={`${finding.title}-${index}`} finding={finding} index={index} />)}</div>
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">Aucun problème notable détecté par les contrôles automatiques.</div>
        )}
      </section>

      <TechnicalSummary report={report} />

      <footer className="border-t border-slate-200 py-4 text-xs text-slate-400 dark:border-slate-700">
        Audit automatisé GEOTrack — les recommandations doivent être validées selon la stratégie d’indexation et les contraintes métier.
      </footer>
    </div>
  );
}

function Score({ score }: { score: number }) {
  const color = score >= 80 ? 'text-emerald-600' : score >= 55 ? 'text-amber-600' : 'text-red-600';
  return <div className="text-center"><div className={`text-4xl font-black ${color}`}>{score}<span className="text-lg">/100</span></div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Score GEO</p></div>;
}

function Finding({ finding, index }: { finding: GeoAuditFinding; index: number }) {
  const meta = priorityMeta[finding.priority];
  return (
    <article className="audit-finding rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
      <div className="flex items-start gap-3">
        <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${meta.classes}`}>{meta.label}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{finding.category}</span>
            <span className="ml-auto text-xs font-bold text-slate-300">#{index + 1}</span>
          </div>
          <h3 className="mt-2 font-bold text-slate-900 dark:text-white">{finding.title}</h3>
          <p className="mt-1 text-xs text-slate-500"><strong>Constat :</strong> {finding.evidence}</p>
          <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-200"><strong>Préconisation :</strong> {finding.recommendation}</p>
        </div>
      </div>
    </article>
  );
}

function TechnicalSummary({ report }: { report: GeoAuditReport }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold text-slate-900 dark:text-white">Données techniques contrôlées</h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <TechnicalCard title="Page HTML" status={report.page.status < 400}>
          <Line label="HTTP" value={String(report.page.status)} /><Line label="Titre" value={report.page.title || 'Absent'} />
          <Line label="Mots" value={String(report.page.word_count)} /><Line label="H1" value={String(report.page.headings.h1 || 0)} />
          <Line label="Langue" value={report.page.language || 'Non déclarée'} />
        </TechnicalCard>
        <TechnicalCard title="robots.txt" status={report.robots.status < 400 && !report.robots.blocks_all}>
          <Line label="HTTP" value={String(report.robots.status)} />
          {Object.entries(report.robots.bots).map(([bot, state]) => <Line key={bot} label={bot} value={state === 'allowed' ? 'Autorisé' : 'Bloqué'} danger={state === 'blocked'} />)}
        </TechnicalCard>
        <TechnicalCard title="Découverte" status={report.sitemap.status < 400}>
          <Line label="Sitemap HTTP" value={String(report.sitemap.status)} /><Line label="URLs trouvées" value={String(report.sitemap.url_count)} />
          <Line label="llms.txt" value={report.llms_txt.present ? 'Présent' : 'Absent (optionnel)'} /><Line label="Canonical" value={report.page.canonical || 'Absent'} />
        </TechnicalCard>
        <TechnicalCard title="Données structurées" status={report.page.json_ld_types.length > 0}>
          <Line label="Types JSON-LD" value={report.page.json_ld_types.join(', ') || 'Aucun'} /><Line label="Meta robots" value={report.page.robots_meta || 'Valeur par défaut'} />
        </TechnicalCard>
        <TechnicalCard title="Images" status={report.page.images_without_alt === 0}>
          <Line label="Images" value={String(report.page.image_count)} /><Line label="Sans texte alt" value={String(report.page.images_without_alt)} danger={report.page.images_without_alt > 0} />
        </TechnicalCard>
      </div>
    </section>
  );
}

function TechnicalCard({ title, status, children }: { title: string; status: boolean; children: ReactNode }) {
  return (
    <article className="audit-technical rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between"><h3 className="font-bold text-slate-900 dark:text-white">{title}</h3><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${status ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{status ? 'OK' : 'À vérifier'}</span></div>
      <dl className="space-y-2">{children}</dl>
    </article>
  );
}

function Line({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div className="flex items-start justify-between gap-3 text-xs"><dt className="shrink-0 text-slate-400">{label}</dt><dd className={`break-words text-right font-medium ${danger ? 'text-red-600' : 'text-slate-700 dark:text-slate-200'}`}>{value}</dd></div>;
}
