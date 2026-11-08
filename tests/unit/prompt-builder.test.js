import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDeckPrompt, DEFAULT_NOTE_GUIDANCE } from '../../src/prompt-builder.js';

test('default guidance is a spoken-sentence note style', () => {
  assert.equal(typeof DEFAULT_NOTE_GUIDANCE, 'string');
  assert.ok(DEFAULT_NOTE_GUIDANCE.includes('spoken'));
  assert.ok(DEFAULT_NOTE_GUIDANCE.includes('transition'));
});

test('prompt contains the canonical slide and notes contract', () => {
  const prompt = buildDeckPrompt({ brief: 'Quarterly review', slideCount: 4 });
  assert.ok(prompt.includes('<section class="slide">'));
  assert.ok(prompt.includes('<div class="slide-body">'));
  assert.ok(prompt.includes('<aside class="speaker-notes" data-speaker-notes hidden>'));
  assert.ok(prompt.includes('Plain spoken notes.'));
  assert.ok(prompt.includes('plain'));
  assert.ok(prompt.includes('.slide-body'));
  assert.ok(prompt.includes('speaker-notes'));
  assert.ok(prompt.includes('hidden'));
  assert.ok(prompt.includes('one element with class="slide" per page'));
  assert.ok(prompt.includes('16:9'));
  assert.ok(prompt.includes('Arrow-key navigation'));
  assert.ok(prompt.includes('no build step') || prompt.includes('no build,'));
  assert.ok(prompt.includes('Return only the complete HTML document.'));
  assert.ok(prompt.includes('speaker-notes'));
  assert.ok(prompt.includes('data-speaker-notes'));
});

test('prompt includes every requested slide number and nothing beyond', () => {
  const prompt = buildDeckPrompt({ brief: 'Kickoff', slideCount: 5 });
  for (let i = 1; i <= 5; i++) {
    assert.ok(prompt.includes(`Slide ${i}\nContent outline:`), `missing Slide ${i}`);
    assert.ok(prompt.includes(`Slide ${i}`));
    assert.ok(prompt.includes(`Content outline`));
    assert.ok(prompt.includes(`Speaker note outline`));
  }
  assert.ok(!prompt.includes('Slide 6'));
  assert.ok(!prompt.includes('Slide 0'));
});

test('provided content and note outlines are included verbatim', () => {
  const prompt = buildDeckPrompt({
    brief: 'Launch plan',
    slideCount: 3,
    slides: [
      { content: 'Why we shipped early', notes: 'Open with the win, then the numbers.' },
      { content: 'Numbers', notes: '' },
    ],
  });
  assert.ok(prompt.includes('Content outline: Why we shipped early'));
  assert.ok(prompt.includes('Speaker note outline: Open with the win, then the numbers.'));
  assert.ok(prompt.includes('Content outline: Numbers'));
  assert.ok(prompt.includes('Slide 2'));
  // Unspecified outlines are marked optional for the AI to infer.
  assert.ok(prompt.includes('(optional — infer suitable slide content from the brief)'));
  assert.ok(prompt.includes('(optional — write spoken notes'));
});

test('slideCount is clamped to 1..30 and floored to an integer', () => {
  const low = buildDeckPrompt({ slideCount: 0 });
  assert.ok(low.includes('Slide 1\n'));
  assert.ok(!low.includes('Slide 2'));

  const negative = buildDeckPrompt({ slideCount: -5 });
  assert.ok(negative.includes('Slide 1\n'));

  const high = buildDeckPrompt({ slideCount: 45 });
  assert.ok(high.includes('Slide 30\n'));
  assert.ok(!high.includes('Slide 31'));

  const fractional = buildDeckPrompt({ slideCount: 2.9 });
  assert.ok(fractional.includes('Slide 2\n'));
  assert.ok(!fractional.includes('Slide 3'));

  const nan = buildDeckPrompt({ slideCount: Number.NaN });
  assert.ok(nan.includes('Slide 6\n'));
  assert.ok(!nan.includes('Slide 7'));
});

test('default note guidance is used when none is provided', () => {
  const prompt = buildDeckPrompt({ brief: 'Workshop' });
  assert.ok(prompt.includes(DEFAULT_NOTE_GUIDANCE));
  const custom = buildDeckPrompt({ brief: 'Workshop', noteGuidance: 'One crisp sentence per beat.' });
  assert.ok(custom.includes('One crisp sentence per beat.'));
  assert.ok(!custom.includes(DEFAULT_NOTE_GUIDANCE));
});

test('empty brief still produces a copyable prompt', () => {
  const prompt = buildDeckPrompt({});
  assert.ok(prompt.includes('HTML presentation'));
  assert.ok(prompt.includes('Slide 6\n'));
  assert.ok(prompt.includes('self-contained'));
  assert.ok(prompt.includes('Return only the complete HTML document.'));
  const explicit = buildDeckPrompt({ brief: '   ' });
  assert.ok(explicit.includes('Return only the complete HTML document.'));
});

test('missing slides entries are treated as empty outlines', () => {
  const prompt = buildDeckPrompt({ brief: 'Backup', slideCount: 3, slides: [{}, undefined, []] });
  assert.ok(prompt.includes('Slide 1\n'));
  assert.ok(prompt.includes('Slide 3\n'));
  assert.ok(prompt.includes('(optional — infer suitable slide content from the brief)'));
});

test('density modes carry the right guidance', () => {
  const speaker = buildDeckPrompt({ brief: 'Talk', slideCount: 3 });
  assert.ok(speaker.includes('Density: Speaker-led / low density'));
  assert.ok(speaker.includes('one idea per slide'));
  assert.ok(speaker.includes('at most 2 text boxes'));

  const reading = buildDeckPrompt({ brief: 'Report', slideCount: 3, density: 'reading' });
  assert.ok(reading.includes('Density: Reading-first / high density'));
  assert.ok(reading.includes('self-contained'));
  assert.ok(reading.includes('body type at least 32px'));
});

test('leaves style choice to the AI with an innovation directive', () => {
  const prompt = buildDeckPrompt({ brief: 'Opening' });
  assert.ok(prompt.includes('Visual style: many styles are possible'));
  assert.ok(prompt.includes('fits the topic, audience, occasion, and its formality'));
  assert.ok(prompt.includes('be innovative'));
  assert.ok(prompt.includes('theme and event'));
  assert.ok(!prompt.includes('editorial poster, Swiss grid'));
});

test('prompt includes fixed-stage, readability, motion, and self-check rules', () => {
  const prompt = buildDeckPrompt({ brief: 'Rules', slideCount: 2 });
  for (const rule of [
    'full-window .deck-viewport',
    'fixed 1920x1080 .deck-stage',
    'never reflow slide content for phones',
    'Never use display:none to hide slides',
    'at most 2 text boxes',
    'body 32-44px',
    'Never shrink body or headings to fit',
    'prefers-reduced-motion',
    'no animation library',
    'only one slide visible',
  ]) {
    assert.ok(prompt.includes(rule), `missing ${rule}`);
  }
});

test('the prompt forbids previews and any host-app API instead of requesting them', () => {
  const prompt = buildDeckPrompt({ brief: 'Roadmap' });
  assert.ok(prompt.includes('No visual slide previews'));
  assert.ok(prompt.includes('no thumbnails'));
  assert.ok(prompt.includes('no presenter API'));
  // Nothing in the prompt should ask the model to produce a preview or call an app.
  assert.ok(!/screenshot|snapshot|render a preview|make a preview|build a preview/i.test(prompt));
  assert.ok(!/use (the|our) presenter api|window\.presenter/i.test(prompt));
});
