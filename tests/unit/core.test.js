import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractTitle, injectBridge, notesKey, slugify, isOverSizeLimit, MAX_HTML_BYTES,
} from '../../src/core.js';

test('extractTitle reads and decodes <title>', () => {
  assert.equal(extractTitle('<head><title> Hand &amp; Hygiene </title></head>'), 'Hand & Hygiene');
  assert.equal(extractTitle('<title>&amp;lt;b&amp;gt; &amp;quot;</title>'), '&lt;b&gt; &quot;');
  assert.equal(extractTitle('<p>no title</p>'), '');
  assert.equal(extractTitle('<title>' + 'x'.repeat(300) + '</title>').length, 120);
});

test('injectBridge inserts before the last </body>', () => {
  const out = injectBridge('<html><body><h1>A</h1></body></html>', 'BRIDGE');
  assert.equal(out, '<html><body><h1>A</h1><script data-presenter-bridge>BRIDGE</script></body></html>');
});

test('injectBridge falls back to </html> then append', () => {
  assert.equal(injectBridge('<html><h1>A</h1></html>', 'B'), '<html><h1>A</h1><script data-presenter-bridge>B</script></html>');
  assert.equal(injectBridge('<h1>A</h1>', 'B'), '<h1>A</h1><script data-presenter-bridge>B</script>');
});

test('notesKey and slugify are stable', () => {
  assert.equal(notesKey('abc', 2), 'presenter:note:abc:2');
  assert.equal(slugify('Hand Hygiene: 2026!'), 'hand-hygiene-2026');
  assert.equal(slugify('   '), 'deck');
});

test('isOverSizeLimit uses UTF-8 bytes', () => {
  assert.equal(MAX_HTML_BYTES, 25 * 1024 * 1024);
  assert.equal(isOverSizeLimit('x'.repeat(10)), false);
  assert.equal(isOverSizeLimit('x'.repeat(MAX_HTML_BYTES + 1)), true);
});
