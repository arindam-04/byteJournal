import test from 'node:test';
import assert from 'node:assert/strict';
import { articleCsvTemplate, parseArticleCsv } from '../../client/src/models/articleCsv.js';

test('downloadable article CSV template parses into a complete draft row', () => {
  const [row]=parseArticleCsv(articleCsvTemplate);
  assert.equal(row.values.title,'A Practical Guide to Reliable APIs');
  assert.equal(row.values.category,'Backend');
  assert.match(row.values.content,/<h2>Start with clear boundaries<\/h2>/);
  assert.equal(row.values.tags,'backend|api|architecture');
});

test('CSV parser preserves commas, escaped quotes, embedded newlines, and UTF-8 BOM', () => {
  const csv='\uFEFFtitle,excerpt,category,content\r\n"Guide, with ""quotes""","A concise excerpt, with a comma.",Backend,"First paragraph,\r\nsecond line"';
  const [row]=parseArticleCsv(csv);
  assert.equal(row.values.title,'Guide, with "quotes"');
  assert.equal(row.values.excerpt,'A concise excerpt, with a comma.');
  assert.equal(row.values.content,'First paragraph,\r\nsecond line');
});

test('CSV parser rejects malformed headers, unclosed quotes, and batches over 100 rows', () => {
  assert.throws(()=>parseArticleCsv('title,title,excerpt,category,content\nA,A,An excerpt,Backend,This is enough content.'),/duplicate column/i);
  assert.throws(()=>parseArticleCsv('title,excerpt,category,content\n"unfinished,An excerpt,Backend,This has enough content.'),/unclosed quoted field/i);
  const header='title,excerpt,category,content';
  const row='A title,An adequate excerpt,Backend,This content is long enough.';
  assert.throws(()=>parseArticleCsv([header,...Array(101).fill(row)].join('\n')),/up to 100/i);
});
