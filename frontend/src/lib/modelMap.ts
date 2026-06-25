/**
 * modelMap.ts – Dynamic model display information for OpenRouter model IDs.
 *
 * Instead of hardcoding LLM_DEFS per-model, this module derives
 * human-readable names, initials, and colours from the model ID itself.
 *
 * Exports:
 *   modelDisplay(modelId: string) – full display info object
 *   providerKey(modelId: string)  – short semantic key  (backward compat)
 */

/* ── Per-provider colour scheme ──────────────────────────────────── */

interface ModelColors {
  barColor: string;
  iconBg: string;
  iconColor: string;
  chartColor: string;
}

const PROVIDER_COLORS: Record<string, ModelColors> = {
  'openai/': {
    barColor: 'bg-emerald-500',
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    chartColor: '#10b981',
  },
  'anthropic/': {
    barColor: 'bg-violet-500',
    iconBg: 'bg-violet-500/10',
    iconColor: 'text-violet-600 dark:text-violet-400',
    chartColor: '#8b5cf6',
  },
  'perplexity/': {
    barColor: 'bg-amber-500',
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-600 dark:text-amber-400',
    chartColor: '#f59e0b',
  },
  'google/': {
    barColor: 'bg-red-500',
    iconBg: 'bg-red-500/10',
    iconColor: 'text-red-600 dark:text-red-400',
    chartColor: '#ef4444',
  },
  'deepseek/': {
    barColor: 'bg-blue-500',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-600 dark:text-blue-400',
    chartColor: '#3b82f6',
  },
  'x-ai/': {
    barColor: 'bg-cyan-500',
    iconBg: 'bg-cyan-500/10',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    chartColor: '#06b6d4',
  },
};

const FALLBACK_COLORS: ModelColors = {
  barColor: 'bg-slate-500',
  iconBg: 'bg-slate-500/10',
  iconColor: 'text-slate-600 dark:text-slate-400',
  chartColor: '#64748b',
};

/* ── Legacy short-key mappings (for backward compat with old settings) ─ */

const LEGACY_PROVIDER: Record<string, string> = {
  chatgpt: 'openai/',
  claude: 'anthropic/',
  perplexity: 'perplexity/',
  gemini: 'google/',
  grok: 'x-ai/',
  deepseek: 'deepseek/',
};

const LEGACY_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  perplexity: 'Perplexity',
  gemini: 'Gemini',
  grok: 'Grok',
  deepseek: 'DeepSeek',
};

/* ── Public helpers ──────────────────────────────────────────────── */

/**
 * Derive the short semantic key from a full OpenRouter model ID.
 *
 *   "openai/gpt-4o-mini"     → "chatgpt"
 *   "anthropic/claude-3.5"   → "claude"
 *   "unknown/my-model"       → "unknown"
 */
export function providerKey(modelId: string): string {
  if (modelId.startsWith('openai/')) return 'chatgpt';
  if (modelId.startsWith('anthropic/')) return 'claude';
  if (modelId.startsWith('perplexity/')) return 'perplexity';
  if (modelId.startsWith('google/')) return 'gemini';
  if (modelId.startsWith('x-ai/')) return 'grok';
  if (modelId.startsWith('deepseek/')) return 'deepseek';
  // For unknown providers, return the provider segment
  return modelId.includes('/') ? modelId.split('/')[0] : modelId;
}

/**
 * Turn a model ID segment into a friendly human-readable name.
 *
 *   "gpt-4o-mini"     → "GPT 4o Mini"
 *   "claude-haiku-4.5" → "Claude Haiku 4.5"
 *   "gemini-2.5-flash" → "Gemini 2.5 Flash"
 */
function readableModelName(namePart: string): string {
  return namePart
    .split(/[-_]/)
    .map((word) => {
      const lower = word.toLowerCase();
      // Handle "gpt*" → "GPT*"
      if (lower.startsWith('gpt')) {
        const rest = lower.slice(3);
        return 'GPT' + (rest ? '-' + rest.toUpperCase() : '');
      }
      // Don't modify if it's a version/digit token
      if (/^\d/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Map a modelId to its colours based on the provider prefix.
 */
function modelColors(modelId: string): ModelColors {
  // Check if it's a legacy short key first
  const legacyProvider = LEGACY_PROVIDER[modelId];
  if (legacyProvider) return PROVIDER_COLORS[legacyProvider] ?? FALLBACK_COLORS;

  // Otherwise look up by provider prefix
  for (const [prefix, colors] of Object.entries(PROVIDER_COLORS)) {
    if (modelId.startsWith(prefix)) return colors;
  }
  return FALLBACK_COLORS;
}

/**
 * Generate a human-readable provider label.
 *   "openai" → "OpenAI"
 *   "anthropic" → "Anthropic"
 *   "x-ai" → "X-Ai"
 */
function providerLabel(provider: string): string {
  return provider
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

/* ── Main display function ───────────────────────────────────────── */

export interface ModelDisplayInfo {
  id: string;          // short semantic key (e.g. "chatgpt")
  label: string;       // readable name (e.g. "GPT 4o Mini")
  model: string;       // provider subtitle (e.g. "OpenAI via OpenRouter")
  letter: string;      // initial letter (uppercase)
  barColor: string;
  iconBg: string;
  iconColor: string;
  chartColor: string;
}

/**
 * Derive full display info from any model identifier.
 *
 * Accepts either a full OpenRouter model ID:
 *   "openai/gpt-4o-mini"
 * or a legacy short key:
 *   "chatgpt"
 */
export function modelDisplay(modelId: string): ModelDisplayInfo {
  const isFullId = modelId.includes('/');

  const key = isFullId ? providerKey(modelId) : modelId;
  const colors = modelColors(modelId);

  let label: string;
  let provider: string;

  if (isFullId) {
    const namePart = modelId.split('/')[1];
    label = readableModelName(namePart);
    provider = modelId.split('/')[0];
  } else {
    // Legacy short key
    label = LEGACY_LABELS[modelId] ?? modelId.charAt(0).toUpperCase() + modelId.slice(1);
    provider = LEGACY_PROVIDER[modelId]?.replace('/', '') ?? modelId;
  }

  const letter = label.charAt(0).toUpperCase();
  const modelSubtitle = `${providerLabel(provider)} via OpenRouter`;

  return {
    id: key,
    label,
    model: modelSubtitle,
    letter,
    ...colors,
  };
}
