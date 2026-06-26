import { useEffect, useRef } from 'react';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

interface Props {
  labels: string[];
  campaigns: number[];
  planned: number[];
  completed: number[];
  failures: number[];
}

export default function ScanVolumeChart({ labels, campaigns, planned, completed, failures }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current?.destroy();
    if (!labels.length) return;

    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? 'rgba(51,65,85,.5)' : 'rgba(226,232,240,.8)';
    const successfulRequests = completed.map((total, index) => Math.max(0, total - failures[index]));
    const skippedRequests = planned.map((total, index) => Math.max(0, total - completed[index]));

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Campagnes lancées',
            data: campaigns,
            backgroundColor: '#2563eb',
            borderRadius: 5,
            yAxisID: 'campaigns',
          },
          {
            label: 'Requêtes réussies',
            data: successfulRequests,
            backgroundColor: '#10b981',
            borderRadius: 5,
            yAxisID: 'requests',
            stack: 'requests',
          },
          {
            label: 'Requêtes en erreur',
            data: failures,
            backgroundColor: '#f59e0b',
            borderRadius: 5,
            yAxisID: 'requests',
            stack: 'requests',
          },
          {
            label: 'Requêtes non exécutées',
            data: skippedRequests,
            backgroundColor: '#94a3b8',
            borderRadius: 5,
            yAxisID: 'requests',
            stack: 'requests',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: textColor, boxWidth: 10, boxHeight: 10, usePointStyle: true },
          },
          tooltip: {
            backgroundColor: isDark ? '#1e293b' : '#fff',
            titleColor: isDark ? '#f1f5f9' : '#1e293b',
            bodyColor: isDark ? '#cbd5e1' : '#475569',
            borderColor: isDark ? '#334155' : '#e2e8f0',
            borderWidth: 1,
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: textColor, maxRotation: 0, maxTicksLimit: 12 },
          },
          campaigns: {
            position: 'left',
            beginAtZero: true,
            grid: { color: gridColor },
            ticks: { color: textColor, precision: 0 },
            title: { display: true, text: 'Campagnes', color: textColor },
          },
          requests: {
            position: 'right',
            beginAtZero: true,
            grid: { drawOnChartArea: false },
            ticks: { color: textColor, precision: 0 },
            title: { display: true, text: 'Requêtes LLM', color: textColor },
          },
        },
      },
    });

    return () => chartRef.current?.destroy();
  }, [campaigns, completed, failures, labels, planned]);

  return (
    <div className="relative h-64">
      {labels.length ? (
        <canvas ref={canvasRef} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400 dark:border-slate-700">
          Aucune campagne sur cette période.
        </div>
      )}
    </div>
  );
}
