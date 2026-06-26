import { useMemo, useState } from 'react';
import type { OpenRouterModel } from '../lib/api';
import { modelDisplay } from '../lib/modelMap';

interface ModelPickerProps {
  models: OpenRouterModel[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  loading?: boolean;
  selectionLimit?: number;
  title?: string;
  description?: string;
  emptyMessage?: string;
}

const providerLabel = (provider: string) => {
  const labels: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google',
    perplexity: 'Perplexity',
    'x-ai': 'xAI',
    deepseek: 'DeepSeek',
  };
  return labels[provider] ?? provider;
};

const tokenPrice = (value: unknown) => {
  const price = Number(value ?? 0);
  if (!Number.isFinite(price) || price <= 0) return '—';
  return `$${price.toFixed(9)}/token`;
};

const millionPrice = (value: unknown) => {
  const price = Number(value ?? 0);
  if (!Number.isFinite(price) || price <= 0) return '—';
  return `$${(price * 1_000_000).toFixed(2)}/M`;
};

function priceSummary(model?: OpenRouterModel) {
  if (!model) return 'Prix indisponible';
  return `Input ${millionPrice(model.pricing.prompt)} · Output ${millionPrice(model.pricing.completion)}`;
}

export default function ModelPicker({
  models,
  selectedIds,
  onChange,
  loading = false,
  selectionLimit,
  title,
  description,
  emptyMessage,
}: ModelPickerProps) {
  const [provider, setProvider] = useState('all');
  const [query, setQuery] = useState('');

  const modelById = useMemo(() => new Map(models.map((model) => [model.id, model])), [models]);
  const selected = selectedIds.map((id) => modelById.get(id) ?? ({ id, name: id, provider: id.split('/')[0] || 'custom', pricing: {} } as OpenRouterModel));

  const providers = useMemo(
    () => Array.from(new Set(models.map((model) => model.provider))).sort(),
    [models],
  );

  const filteredModels = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return models
      .filter((model) => !selectedIds.includes(model.id))
      .filter((model) => provider === 'all' || model.provider === provider)
      .filter((model) => {
        if (!needle) return true;
        return `${model.name} ${model.id} ${model.provider}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => a.provider.localeCompare(b.provider) || a.name.localeCompare(b.name))
      .slice(0, 40);
  }, [models, provider, query, selectedIds]);

  const addModel = (modelId: string) => {
    if (!modelId || selectedIds.includes(modelId)) return;
    onChange(selectionLimit === 1 ? [modelId] : [...selectedIds, modelId]);
  };

  const removeModel = (modelId: string) => {
    onChange(selectedIds.filter((id) => id !== modelId));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
        {description ?? 'Tu peux sélectionner plusieurs modèles du même fournisseur, par exemple GPT-4o mini + GPT-4.1 + o3-mini. Le coût affiché vient du catalogue OpenRouter.'}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{title ?? 'Modèles sélectionnés'}</label>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-300">
            {selectedIds.length} modèle{selectedIds.length > 1 ? 's' : ''}
          </span>
        </div>

        {selected.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-400 dark:border-slate-700">
            {emptyMessage ?? 'Aucun modèle sélectionné. Ajoute au moins un modèle pour lancer les scans.'}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {selected.map((model) => {
              const display = modelDisplay(model.id);
              return (
                <div key={model.id} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/40">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${display.iconBg} ${display.iconColor} text-xs font-bold`}>
                      {display.letter}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white" title={model.name}>
                        {model.name}
                      </p>
                      <p className="truncate font-mono text-[11px] text-slate-400" title={model.id}>
                        {model.id}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeModel(model.id)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                      aria-label={`Supprimer ${model.name}`}
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <PriceCell label="Input" token={tokenPrice(model.pricing.prompt)} million={millionPrice(model.pricing.prompt)} />
                    <PriceCell label="Output" token={tokenPrice(model.pricing.completion)} million={millionPrice(model.pricing.completion)} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            className="input-field sm:w-44"
            value={provider}
            onChange={(event) => setProvider(event.target.value)}
            disabled={loading}
          >
            <option value="all">Tous les fournisseurs</option>
            {providers.map((item) => (
              <option key={item} value={item}>{providerLabel(item)}</option>
            ))}
          </select>
          <input
            className="input-field flex-1"
            placeholder="Rechercher un modèle : gpt, o3, claude, gemini..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={loading}
          />
        </div>

        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
          {loading ? (
            <p className="py-6 text-center text-sm text-slate-400">Chargement du catalogue OpenRouter...</p>
          ) : filteredModels.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Aucun autre modèle disponible avec ces filtres.</p>
          ) : (
            filteredModels.map((model) => {
              const display = modelDisplay(model.id);
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => addModel(model.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-blue-300 hover:bg-blue-50/60 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/10"
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${display.iconBg} ${display.iconColor} text-xs font-bold`}>
                    {display.letter}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{model.name}</p>
                    <p className="truncate font-mono text-[11px] text-slate-400">{model.id}</p>
                  </div>
                  <div className="hidden text-right text-xs text-slate-500 dark:text-slate-400 sm:block">
                    <p>{priceSummary(model)}</p>
                    {model.context_length && <p>Contexte {Number(model.context_length).toLocaleString('fr-FR')} tokens</p>}
                  </div>
                  <span className="shrink-0 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white">
                    Ajouter
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function PriceCell({ label, token, million }: { label: string; token: string; million: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/70">
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200">{token}</p>
      <p className="text-[10px] text-slate-400">{million}</p>
    </div>
  );
}
