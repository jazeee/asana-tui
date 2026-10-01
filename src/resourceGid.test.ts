import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveGid } from './resourceGid.ts';

test('passes a bare gid through', () => {
  assert.equal(resolveGid('1219084491890009'), '1219084491890009');
  assert.equal(resolveGid('  1219084491890009  '), '1219084491890009');
});

test('extracts the task gid from the permalink Asana returns', () => {
  assert.equal(
    resolveGid('https://app.asana.com/1/1187495389489253/project/1219084434562732/task/1219084491890009', 'task'),
    '1219084491890009',
  );
});

test('handles the older /0/<project>/<task> permalink shape', () => {
  assert.equal(resolveGid('https://app.asana.com/0/1219084434562732/1219084491890009', 'task'), '1219084491890009');
  assert.equal(resolveGid('https://app.asana.com/0/1219084434562732/1219084491890009/f', 'task'), '1219084491890009');
});

test('picks the project, not the task, when asked for a project', () => {
  const url = 'https://app.asana.com/1/1187495389489253/project/1219084434562732/task/1219084491890009';
  assert.equal(resolveGid(url, 'project'), '1219084434562732');
  assert.equal(resolveGid('https://app.asana.com/1/1187495389489253/project/1219084434562732/list', 'project'), '1219084434562732');
});

test('ignores query strings and fragments', () => {
  assert.equal(resolveGid('https://app.asana.com/0/0/1219084491890009/f?focus=true#x', 'task'), '1219084491890009');
});

test('rejects input with no gid in it', () => {
  assert.throws(() => resolveGid('not-a-task'), /Expected a gid or an Asana URL/);
  assert.throws(() => resolveGid('https://app.asana.com/0/inbox'), /Could not find a gid/);
});
