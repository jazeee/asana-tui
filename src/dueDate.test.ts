import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveDueDate } from './dueDate.ts';

function expectedOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

test('passes through explicit dates', () => {
  assert.equal(resolveDueDate('2024-05-02'), '2024-05-02');
  assert.equal(resolveDueDate('2024-05-02T17:00:00Z'), '2024-05-02T17:00:00Z');
});

test('resolves keywords and relative offsets against today', () => {
  assert.equal(resolveDueDate('today'), expectedOffset(0));
  assert.equal(resolveDueDate('tomorrow'), expectedOffset(1));
  assert.equal(resolveDueDate('+3d'), expectedOffset(3));
  assert.equal(resolveDueDate('-1w'), expectedOffset(-7));
});

test('distinguishes clearing the date from failing to parse it', () => {
  assert.equal(resolveDueDate('none'), null);
  assert.throws(() => resolveDueDate('next thursday'), /Cannot parse date/);
});
