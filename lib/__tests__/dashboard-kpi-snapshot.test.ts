import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DASHBOARD_KPI_FRESH_MS,
  isDashboardKpiFresh,
} from '@/lib/dashboard-kpi-snapshot';

describe('dashboard-kpi-snapshot freshness', () => {
  it('treats recent timestamps as fresh', () => {
    const now = Date.UTC(2026, 6, 25, 12, 0, 0);
    assert.equal(isDashboardKpiFresh(new Date(now - 60_000), now), true);
    assert.equal(
      isDashboardKpiFresh(new Date(now - DASHBOARD_KPI_FRESH_MS - 1), now),
      false,
    );
  });
});
