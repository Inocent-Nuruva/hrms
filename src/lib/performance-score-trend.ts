export type PerformanceScorePoint = {
  reviewId: string;
  periodName: string;
  startDate: string;
  score: number;
};

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function valueOf(source: UnknownRecord, ...keys: string[]): unknown {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return source[key];
  }
  return undefined;
}

export function getPublishedMonthlyPerformanceTrend(
  reviews: UnknownRecord[],
): PerformanceScorePoint[] {
  const points = reviews.flatMap((review) => {
    if (String(valueOf(review, 'status') ?? '').toUpperCase() !== 'PUBLISHED') {
      return [];
    }
    const assignment = record(
      valueOf(review, 'periodAssignment', 'period_assignment'),
    );
    const period = record(
      valueOf(assignment, 'performancePeriod', 'performance_period') ??
        valueOf(review, 'performancePeriod', 'performance_period'),
    );
    const periodType = String(valueOf(period, 'periodType', 'period_type') ?? '')
      .toUpperCase();
    if (periodType && periodType !== 'MONTHLY') return [];

    const scoreValue = Number(valueOf(review, 'finalScore', 'final_score'));
    const startDate = String(valueOf(period, 'startDate', 'start_date') ?? '');
    const startTimestamp = Date.parse(`${startDate.slice(0, 10)}T00:00:00Z`);
    if (!Number.isFinite(scoreValue) || !Number.isFinite(startTimestamp)) return [];

    const id = valueOf(review, 'id');
    return [
      {
        reviewId: id === undefined ? startDate : String(id),
        periodName: String(valueOf(period, 'name') ?? startDate.slice(0, 7)),
        startDate: startDate.slice(0, 10),
        score: scoreValue,
      },
    ];
  });

  const uniqueByDate = new Map<string, PerformanceScorePoint>();
  for (const point of points) uniqueByDate.set(point.startDate, point);
  return Array.from(uniqueByDate.values())
    .sort((left, right) => left.startDate.localeCompare(right.startDate))
    .slice(-12);
}
