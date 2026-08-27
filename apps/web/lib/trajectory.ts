import type { Metrics } from "./types";

export type DailyPoint = {
  date: string;
  month: string;
  dailyTarget: number;
  cumulativeTarget: number;
};

export type MonthTrajectory = {
  month: string;
  total: number;
  days: number;
  dailyTarget: number;
  weeklyEquivalent: number;
  cumulativeEnd: number;
};

function daysInMonth(month: string): number {
  const [year, m] = month.split("-").map(Number);
  return new Date(Date.UTC(year, m, 0)).getUTCDate();
}

export function buildTrajectory(metrics: Metrics): { daily: DailyPoint[]; monthly: MonthTrajectory[] } {
  let cumulative = 0;
  const daily: DailyPoint[] = [];
  const monthly: MonthTrajectory[] = [];

  for (const [month, total] of Object.entries(metrics.monthly_totals)) {
    const days = daysInMonth(month);
    const dailyTarget = total / days;
    const [year, m] = month.split("-").map(Number);

    for (let day = 1; day <= days; day += 1) {
      cumulative += dailyTarget;
      daily.push({
        date: `${year}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        month,
        dailyTarget,
        cumulativeTarget: cumulative,
      });
    }

    monthly.push({
      month,
      total,
      days,
      dailyTarget,
      weeklyEquivalent: dailyTarget * 7,
      cumulativeEnd: cumulative,
    });
  }

  return { daily, monthly };
}

export function trajectoryAtDate(metrics: Metrics, now = new Date()) {
  const { daily, monthly } = buildTrajectory(metrics);
  const iso = now.toISOString().slice(0, 10);
  const first = daily[0];
  const last = daily[daily.length - 1];
  const point = daily.find((d) => d.date === iso);

  if (!first || !last) return { phase: "EMPTY" as const, daily, monthly };
  if (iso < first.date) return { phase: "PRE" as const, daily, monthly, firstDate: first.date, lastDate: last.date };
  if (iso > last.date) return { phase: "POST" as const, daily, monthly, firstDate: first.date, lastDate: last.date };
  return { phase: "ACTIVE" as const, daily, monthly, point, firstDate: first.date, lastDate: last.date };
}
