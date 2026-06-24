/// Transforme les données brutes de l'API backend
/// en formats utilisables par les composants du dashboard.

import type { ScanResultData } from "./api";

// Mapping OpenRouter model IDs → infos d'affichage frontend
export const LLM_UI_MAP: Record<string, { label: string; letter: string; barColor: string; iconBg: string; iconColor: string; chartColor: string }> = {
  "openai/gpt-4o-mini":         { label: "GPT-4o Mini",    letter: "C", barColor: "bg-emerald-500", iconBg: "bg-emerald-500/10", iconColor: "text-emerald-600 dark:text-emerald-400", chartColor: "#10b981" },
  "openai/gpt-4o":              { label: "GPT-4o",         letter: "C", barColor: "bg-emerald-500", iconBg: "bg-emerald-500/10", iconColor: "text-emerald-600 dark:text-emerald-400", chartColor: "#10b981" },
  "openai/gpt-4-turbo":         { label: "GPT-4 Turbo",    letter: "C", barColor: "bg-emerald-500", iconBg: "bg-emerald-500/10", iconColor: "text-emerald-600 dark:text-emerald-400", chartColor: "#10b981" },
  "openai/gpt-3.5-turbo":       { label: "GPT-3.5 Turbo",  letter: "C", barColor: "bg-emerald-500", iconBg: "bg-emerald-500/10", iconColor: "text-emerald-600 dark:text-emerald-400", chartColor: "#10b981" },
  "anthropic/claude-3.5-sonnet":{ label: "Claude 3.5 Sonnet", letter: "C", barColor: "bg-violet-500", iconBg: "bg-violet-500/10", iconColor: "text-violet-600 dark:text-violet-400", chartColor: "#8b5cf6" },
  "anthropic/claude-3-opus":    { label: "Claude 3 Opus",  letter: "C", barColor: "bg-violet-500", iconBg: "bg-violet-500/10", iconColor: "text-violet-600 dark:text-violet-400", chartColor: "#8b5cf6" },
  "anthropic/claude-3-sonnet":  { label: "Claude 3 Sonnet", letter: "C", barColor: "bg-violet-500", iconBg: "bg-violet-500/10", iconColor: "text-violet-600 dark:text-violet-400", chartColor: "#8b5cf6" },
  "anthropic/claude-3-haiku":   { label: "Claude 3 Haiku", letter: "C", barColor: "bg-violet-500", iconBg: "bg-violet-500/10", iconColor: "text-violet-600 dark:text-violet-400", chartColor: "#8b5cf6" },
  "perplexity/llama-3.1-sonar-large-128k": { label: "Perplexity", letter: "P", barColor: "bg-orange-500", iconBg: "bg-orange-500/10", iconColor: "text-orange-600 dark:text-orange-400", chartColor: "#f97316" },
  "perplexity/llama-3.1-sonar-small-128k": { label: "Perplexity Small", letter: "P", barColor: "bg-orange-500", iconBg: "bg-orange-500/10", iconColor: "text-orange-600 dark:text-orange-400", chartColor: "#f97316" },
  "google/gemini-2.0-flash-001":{ label: "Gemini 2.0 Flash", letter: "G", barColor: "bg-amber-500", iconBg: "bg-amber-500/10", iconColor: "text-amber-600 dark:text-amber-400", chartColor: "#f59e0b" },
  "google/gemini-1.5-pro":      { label: "Gemini 1.5 Pro", letter: "G", barColor: "bg-amber-500", iconBg: "bg-amber-500/10", iconColor: "text-amber-600 dark:text-amber-400", chartColor: "#f59e0b" },
  "google/gemini-1.5-flash":    { label: "Gemini 1.5 Flash", letter: "G", barColor: "bg-amber-500", iconBg: "bg-amber-500/10", iconColor: "text-amber-600 dark:text-amber-400", chartColor: "#f59e0b" },
  "x-ai/grok-2-1212":           { label: "Grok 2",        letter: "X", barColor: "bg-sky-500", iconBg: "bg-sky-500/10", iconColor: "text-sky-600 dark:text-sky-400", chartColor: "#06b6d4" },
  "x-ai/grok-vision-1212":      { label: "Grok Vision",   letter: "X", barColor: "bg-sky-500", iconBg: "bg-sky-500/10", iconColor: "text-sky-600 dark:text-sky-400", chartColor: "#06b6d4" },
  "deepseek/deepseek-chat":     { label: "DeepSeek V3",   letter: "D", barColor: "bg-orange-500", iconBg: "bg-orange-500/10", iconColor: "text-orange-600 dark:text-orange-400", chartColor: "#f97316" },
  "deepseek/deepseek-r1":       { label: "DeepSeek R1",   letter: "D", barColor: "bg-orange-500", iconBg: "bg-orange-500/10", iconColor: "text-orange-600 dark:text-orange-400", chartColor: "#f97316" },
};

export function getLlmInfo(modelId: string) {
  return LLM_UI_MAP[modelId] ?? {
    label: modelId.split("/").pop() ?? modelId,
    letter: "?",
    barColor: "bg-blue-500",
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-600 dark:text-blue-400",
    chartColor: "#3b82f6",
  };
}

/** Calcule les stats SOV par modèle depuis un tableau de résultats. */
export interface ModelSov {
  model: string;
  total: number;
  urlFound: number;
  brandFound: number;
  sovUrl: number;
  sovBrand: number;
  avgRank: number | null;
}

export function computePerModelSov(results: ScanResultData[]): ModelSov[] {
  const groups = new Map<string, ScanResultData[]>();
  for (const r of results) {
    if (!groups.has(r.model)) groups.set(r.model, []);
    groups.get(r.model)!.push(r);
  }
  const out: ModelSov[] = [];
  for (const [model, rows] of groups) {
    const total = rows.length;
    const urlFound = rows.filter((r) => r.has_url).length;
    const brandFound = rows.filter((r) => r.has_brand).length;
    const ranks = rows.map((r) => r.rank).filter((r): r is number => r !== null);
    const avgRank = ranks.length > 0 ? Math.round((ranks.reduce((a, b) => a + b, 0) / ranks.length) * 10) / 10 : null;
    out.push({
      model,
      total,
      urlFound,
      brandFound,
      sovUrl: total > 0 ? Math.round((urlFound / total) * 1000) / 10 : 0,
      sovBrand: total > 0 ? Math.round((brandFound / total) * 1000) / 10 : 0,
      avgRank,
    });
  }
  return out.sort((a, b) => a.model.localeCompare(b.model));
}

/** Construit les lignes pour PromptMatrix : une ligne par prompt, une colonne par modèle. */
export interface PromptMatrixRow {
  id: string;
  prompt: string;
  theme: string | null;
  date: string;
  /** modelId → { hasUrl, hasBrand, rank } */
  models: Record<string, { hasUrl: boolean; hasBrand: boolean; rank: number | null }>;
}

export function buildPromptMatrix(results: ScanResultData[], prompts: Array<{ id: string; text: string; theme?: string | null; created_at?: string }>): PromptMatrixRow[] {
  // Dernier résultat par (prompt_id, model)
  const latestByPromptModel = new Map<string, ScanResultData>();
  for (const r of results) {
    const key = `${r.prompt_id}:${r.model}`;
    const existing = latestByPromptModel.get(key);
    if (!existing || new Date(r.scanned_at) > new Date(existing.scanned_at)) {
      latestByPromptModel.set(key, r);
    }
  }

  return prompts.map((p) => {
    const models: PromptMatrixRow["models"] = {};
    for (const [key, r] of latestByPromptModel) {
      const [pId, model] = key.split(":");
      if (pId === String(p.id)) {
        models[model] = { hasUrl: r.has_url, hasBrand: r.has_brand, rank: r.rank };
      }
    }
    return {
      id: String(p.id),
      prompt: p.text,
      theme: p.theme ?? null,
      date: p.created_at ? new Date(p.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "",
      models,
    };
  });
}

/** Agrège les résultats en tendances chronologiques pour le graphique. */
export interface TrendPoint {
  date: string;
  /** modelId → sovUrl */
  values: Record<string, number>;
}

export function buildTrendSeries(results: ScanResultData[]): TrendPoint[] {
  // Grouper par date (tronquée à la minute pour regrouper un même scan batch)
  const batches = new Map<string, ScanResultData[]>();
  for (const r of results) {
    const date = r.scanned_at.slice(0, 16); // "2026-06-24T12:00"
    if (!batches.has(date)) batches.set(date, []);
    batches.get(date)!.push(r);
  }

  const points: TrendPoint[] = [];
  for (const [date, rows] of batches) {
    const models = new Map<string, { total: number; url: number }>();
    for (const r of rows) {
      if (!models.has(r.model)) models.set(r.model, { total: 0, url: 0 });
      const m = models.get(r.model)!;
      m.total++;
      if (r.has_url) m.url++;
    }
    const values: Record<string, number> = {};
    for (const [model, stats] of models) {
      values[model] = stats.total > 0 ? Math.round((stats.url / stats.total) * 100) : 0;
    }
    points.push({ date, values });
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

/** Renvoie les modèles uniques présents dans les résultats, triés. */
export function getUniqueModels(results: ScanResultData[]): string[] {
  const models = new Set(results.map((r) => r.model));
  return Array.from(models).sort();
}
