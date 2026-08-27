"use client";

import { useMemo } from "react";
import type { Metrics } from "../lib/types";
import { buildTrajectory, trajectoryAtDate } from "../lib/trajectory";

const LABEL: Record<string, string> = {
  "2026-09": "September",
  "2026-10": "October",
  "2026-11": "November",
  "2026-12": "December",
  "2027-01": "January",
};

const money = (n: number, digits = 0) =>
  new Intl.NumberFormat("fr-CH", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);

export function DailyTrajectory({ metrics }: { metrics: Metrics }) {
  const trajectory = useMemo(() => buildTrajectory(metrics), [metrics]);
  const current = useMemo(() => trajectoryAtDate(metrics), [metrics]);
  const max = metrics.global_mt || 1;
  const svgPoints = trajectory.daily
    .map((point, index) => {
      const x = trajectory.daily.length <= 1 ? 0 : (index / (trajectory.daily.length - 1)) * 100;
      const y = 100 - (point.cumulativeTarget / max) * 100;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const phaseLabel =
    current.phase === "PRE"
      ? `Starts ${current.firstDate}`
      : current.phase === "POST"
        ? "Window complete"
        : current.phase === "ACTIVE"
          ? `Today target CHF ${money(current.point?.dailyTarget ?? 0, 2)}`
          : "No trajectory";

  const currentTarget = current.phase === "ACTIVE" ? current.point?.cumulativeTarget ?? 0 : current.phase === "POST" ? metrics.global_mt : 0;
  const progress = Math.max(0, Math.min(100, (currentTarget / max) * 100));

  return (
    <section className="panel trajectory-panel">
      <div className="panel-head">
        <div>
          <span className="eyebrow">153-DAY GENERATION TRAJECTORY</span>
          <h2>Daily operating target</h2>
        </div>
        <span className="solver">{phaseLabel}</span>
      </div>

      <div className="trajectory-summary">
        <div>
          <span>Global daily average</span>
          <b>CHF {money(metrics.average_per_day, 2)}</b>
        </div>
        <div>
          <span>153-day cumulative target</span>
          <b>CHF {money(metrics.global_mt)}</b>
        </div>
        <div>
          <span>Target reached by today</span>
          <b>CHF {money(currentTarget, 2)}</b>
        </div>
      </div>

      <div className="trajectory-chart" aria-label="Cumulative target trajectory">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img">
          <line x1="0" y1="100" x2="100" y2="100" className="chart-axis" />
          <line x1="0" y1="0" x2="0" y2="100" className="chart-axis" />
          <polyline points={svgPoints} className="chart-line" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="trajectory-progress"><span style={{ width: `${progress}%` }} /></div>
      </div>

      <div className="trajectory-months">
        {trajectory.monthly.map((m) => (
          <article key={m.month}>
            <span>{LABEL[m.month] ?? m.month}</span>
            <strong>CHF {money(m.total)}</strong>
            <dl>
              <div><dt>/ day</dt><dd>CHF {money(m.dailyTarget, 2)}</dd></div>
              <div><dt>/ week</dt><dd>CHF {money(m.weeklyEquivalent, 2)}</dd></div>
              <div><dt>cumulative</dt><dd>CHF {money(m.cumulativeEnd, 0)}</dd></div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
