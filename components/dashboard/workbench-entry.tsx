'use client';

import { FriendlyRoleDashboard, WorkbenchErrorBoundary } from './friendly-role-dashboard';

export function WorkbenchEntry({ initialRole, initialTasks, assignees, kpis }: Parameters<typeof FriendlyRoleDashboard>[0]) {
  return <WorkbenchErrorBoundary><FriendlyRoleDashboard initialRole={initialRole} initialTasks={initialTasks} assignees={assignees} kpis={kpis} /></WorkbenchErrorBoundary>;
}
