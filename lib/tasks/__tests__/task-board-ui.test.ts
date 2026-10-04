import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../../../app/(main)/tasks/page.tsx', import.meta.url),
  'utf8',
);

test('task page keeps a clear workflow board without nested task cards', () => {
  assert.match(source, /title="任務"/);
  assert.match(source, /aria-label={\`\$\{col\.label\}任務\`}/);
  assert.match(source, /divide-y divide-border\/60/);
  assert.doesNotMatch(source, /<Card/);
});

test('task rows expose priority, type, owner and due-date state', () => {
  assert.match(source, /StatusBadge kind="taskPriority"/);
  assert.match(source, /taskTypeLabel\[t\.type\]/);
  assert.match(source, /t\.assignee\.name/);
  assert.match(source, /t\.dueDate < now/);
  assert.match(source, /逾期/);
});

test('task page does not show an action that has no task creation flow', () => {
  assert.doesNotMatch(source, /新增任務/);
});
