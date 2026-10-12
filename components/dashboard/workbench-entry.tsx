'use client';

import { FriendlyRoleDashboard, WorkbenchErrorBoundary } from './friendly-role-dashboard';

export function WorkbenchEntry({ initialRole, initialTasks, kpis }: Parameters<typeof FriendlyRoleDashboard>[0]) {
  return <WorkbenchErrorBoundary><FriendlyRoleDashboard initialRole={initialRole} initialTasks={initialTasks} kpis={kpis} /></WorkbenchErrorBoundary>;
}
