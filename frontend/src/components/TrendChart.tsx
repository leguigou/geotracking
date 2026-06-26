import { useEffect, useRef } from 'react';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Filler,
} from 'chart.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler);

interface TrendDataset {
  label: string;
  data: Array<number | null>;
  borderColor: string;
  backgroundColor?: string;
  borderDash?: number[];
  pointMeta?: Array<{
    mentions?: number;
    total?: number;
    failed?: number;
  } | null>;
}

interface TrendChartProps {
  labels: string[];
  datasets: TrendDataset[];
  height?: number;
  chartId: string;
}

export default function TrendChart({ labels, datasets, height = 260, chartId }: TrendChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const hasUsableData = datasets.some((dataset) => dataset.data.some((value) => value !== null && value !== undefined));

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();
    if (!hasUsableData) return;

    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? 'rgba(51,65,85,.5)' : 'rgba(226,232,240,.8)';

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: datasets.map((ds) => ({
          label: ds.label,
          data: ds.data,
          borderColor: ds.borderColor,
          backgroundColor: ds.backgroundColor || ds.borderColor.replace(')', ',.08)').replace('rgb', 'rgba'),
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 2,
          borderDash: ds.borderDash,
          spanGaps: false,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: isDark ? '#1e293b' : '#fff',
            titleColor: isDark ? '#f1f5f9' : '#1e293b',
            bodyColor: isDark ? '#cbd5e1' : '#475569',
            borderColor: isDark ? '#334155' : '#e2e8f0',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            displayColors: true,
            boxPadding: 4,
            callbacks: {
              label: (context) => {
                const dataset = datasets[context.datasetIndex];
                const value = context.parsed.y;
                const meta = dataset?.pointMeta?.[context.dataIndex];
                if (!meta || meta.total == null) {
                  return `${context.dataset.label}: ${Number.isFinite(value) ? `${value}%` : 'N/A'}`;
                }
                const failed = meta.failed ? ` · ${meta.failed} erreur${meta.failed > 1 ? 's' : ''}` : '';
                return `${context.dataset.label}: ${value}% (${meta.mentions ?? 0}/${meta.total} mentions${failed})`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: textColor, font: { size: 11 } },
          },
          y: {
            grid: { color: gridColor },
            ticks: { color: textColor, font: { size: 11 }, callback: (v) => v + '%' },
            min: 0,
            max: 100,
          },
        },
      },
    });

    return () => {
      if (chartRef.current) chartRef.current.destroy();
    };
  }, [labels, datasets, hasUsableData]);

  return (
    <div className="relative" style={{ height }}>
      {!hasUsableData && (
        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center dark:border-slate-700 dark:bg-slate-900/40">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Pas encore assez de données</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Lance au moins un scan terminé pour voir une tendance. Un score à 0% sera affiché comme une vraie donnée si des réponses ont bien été analysées.
          </p>
        </div>
      )}
      <canvas ref={canvasRef} id={chartId} />
    </div>
  );
}
