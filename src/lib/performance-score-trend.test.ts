import { describe, expect, it } from 'vitest';
import { getPublishedMonthlyPerformanceTrend } from './performance-score-trend';

describe('getPublishedMonthlyPerformanceTrend', () => {
  it('returns scored published monthly reviews in chronological order', () => {
    const result = getPublishedMonthlyPerformanceTrend([
      {
        id: 2,
        status: 'PUBLISHED',
        finalScore: '90.0000',
        periodAssignment: {
          performancePeriod: {
            periodType: 'MONTHLY',
            name: 'February 2026',
            startDate: '2026-02-01',
          },
        },
      },
      {
        id: 1,
        status: 'PUBLISHED',
        final_score: '80.0000',
        period_assignment: {
          performance_period: {
            period_type: 'MONTHLY',
            name: 'January 2026',
            start_date: '2026-01-01',
          },
        },
      },
      {
        id: 3,
        status: 'DRAFT',
        finalScore: '100',
        periodAssignment: {
          performancePeriod: {
            periodType: 'MONTHLY',
            startDate: '2026-03-01',
          },
        },
      },
      {
        id: 4,
        status: 'PUBLISHED',
        finalScore: '100',
        periodAssignment: {
          performancePeriod: {
            periodType: 'QUARTERLY',
            startDate: '2026-04-01',
          },
        },
      },
    ]);

    expect(result.map(({ periodName, score }) => [periodName, score])).toEqual([
      ['January 2026', 80],
      ['February 2026', 90],
    ]);
  });

  it('limits the chart to the latest twelve monthly results', () => {
    const result = getPublishedMonthlyPerformanceTrend(
      Array.from({ length: 14 }, (_, index) => {
        const startDate = new Date(Date.UTC(2025, index, 1))
          .toISOString()
          .slice(0, 10);
        return {
          id: index + 1,
          status: 'PUBLISHED',
          finalScore: String(71 + index),
          periodAssignment: {
            performancePeriod: {
              periodType: 'MONTHLY',
              name: `Month ${index + 1}`,
              startDate,
            },
          },
        };
      }),
    );

    expect(result).toHaveLength(12);
    expect(result[0].periodName).toBe('Month 3');
    expect(result.at(-1)?.periodName).toBe('Month 14');
  });
});
