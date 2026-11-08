// Pure prompt-builder for asking an LLM to generate one self-contained HTML
// deck that follows Presenter's canonical slide + speaker-notes contract.
// No DOM access; safe to unit-test with node:test.

export const DEFAULT_NOTE_GUIDANCE =
  '2-3 spoken sentences per slide: what to say, what to emphasize, and how to transition.';

const DENSITY_GUIDANCE = {
  speaker:
    'Speaker-led / low density: one idea per slide, 1-3 short bullets, generous negative space, and more slides instead of packed text.',
  reading:
    'Reading-first / high density: self-contained but still at most 2 text boxes; 3-5 concise points per box if needed, body type at least 32px, and split into more slides before packing.',
};

const SLIDE_CONTRACT = [
  '<section class="slide">',
  '  <div class="slide-body">...visible content...</div>',
  '  <aside class="speaker-notes" data-speaker-notes hidden>',
  '    Plain spoken notes.',
  '  </aside>',
  '</section>',
].join('\n');

function clampSlideCount(value) {
  let count = Number(value);
  if (!Number.isFinite(count)) count = 6;
  count = Math.floor(count);
  if (count < 1) count = 1;
  if (count > 30) count = 30;
  return count;
}

function normalizeSlides(slides, count) {
  const source = Array.isArray(slides) ? slides : [];
  const rows = [];
  for (let i = 0; i < count; i++) {
    const entry = source[i];
    if (typeof entry === 'string') {
      rows.push({ content: entry.trim(), notes: '' });
      continue;
    }
    const content = typeof entry?.content === 'string' ? entry.content.trim() : '';
    const notes = typeof entry?.notes === 'string' ? entry.notes.trim() : '';
    rows.push({ content, notes });
  }
  return rows;
}

function outlineLine(label, value, fallback) {
  return `${label}: ${value || fallback}`;
}

export function buildDeckPrompt({
  brief = '',
  slideCount = 6,
  slides = [],
  noteGuidance = '',
  density = 'speaker',
} = {}) {
  const count = clampSlideCount(slideCount);
  const topic = typeof brief === 'string' ? brief.trim() : '';
  const guidance =
    typeof noteGuidance === 'string' && noteGuidance.trim() ? noteGuidance.trim() : DEFAULT_NOTE_GUIDANCE;
  const densityKey = density === 'reading' ? 'reading' : 'speaker';
  const rows = normalizeSlides(slides, count);

  const lines = [];
  lines.push(
    topic
      ? `Write one complete, self-contained HTML presentation about: ${topic}.`
      : 'Write one complete, self-contained HTML presentation about a topic of your choice.'
  );
  lines.push('');
  lines.push('Presentation requirements:');
  lines.push('- One single HTML file with inline CSS and JS: no build step, no framework, no external app dependencies, no import of the viewer. It must run when opened directly in a browser.');
  lines.push('- A full-window .deck-viewport containing a fixed 1920x1080 .deck-stage scaled uniformly with transform. Slides stay 16:9 on every screen; never reflow slide content for phones.');
  lines.push('- Every .slide is absolutely positioned at 1920x1080. Switch slides with .active/.visible and visibility, opacity, pointer-events. Never use display:none to hide slides; layout classes can override it.');
  lines.push('- Body overflow hidden; no slide scroll.');
  lines.push(`- Exactly ${count} slide${count === 1 ? '' : 's'}: exactly one element with class="slide" per page, with one slide visible at a time.`);
  lines.push('- Arrow-key navigation: the Left and Right arrow keys (plus Space) move between slides.');
  lines.push('- No visual slide previews, no thumbnails, and no calls to any host application: no presenter API, no messaging protocol, no integration hooks. The deck is fully standalone.');
  lines.push(`- Density: ${DENSITY_GUIDANCE[densityKey]}`);
  lines.push('- Visible content: at most 2 text boxes/containers per slide, such as a title block plus one content block. Speaker notes are hidden and do not count. If the content needs a third box, split the slide instead.');
  lines.push('- Type scale at 1920x1080: H1 88-140px+, H2 56-88px, lead 40-56px, body 32-44px, captions 24-28px, stats 96-180px+. Never shrink body or headings to fit; split instead.');
  lines.push('- Smooth type with a distinctive font pairing. A Google Fonts or Fontshare link is fine, but include robust fallbacks and keep the hierarchy readable if the font fails. Do not make Inter, Roboto, Arial, or a default system stack the primary display face.');
  lines.push('- Motion: one CSS-only staggered reveal when a slide becomes active; respect prefers-reduced-motion; no animation library.');
  lines.push('- Design: commit to one coherent visual system: one display/body pairing, one dominant color plus one accent, and one layout grammar. Use CSS-generated background atmosphere. Avoid generic AI-slop: no purple gradient on white, no generic SaaS card grids, and no decorative noise that fights the message. Match the topic and its formality; a serious deck should feel composed, not loud.');
  lines.push('- Speaker notes are not visible content and must not count toward the 2 text boxes.');
  lines.push('');
  lines.push('Visual style: many styles are possible. Choose one that fits the topic, audience, occasion, and its formality; be innovative and commit to it. You may invent a better style if it suits the theme and event. Do not mix styles, name a template, or copy a template.');
  lines.push('');
  lines.push('Every slide must use exactly this structure:');
  lines.push('');
  lines.push(SLIDE_CONTRACT);
  lines.push('');
  lines.push('Speaker note rules:');
  lines.push('- Every slide carries exactly one hidden speaker-notes block inside it, after .slide-body, always with the class speaker-notes, the attribute data-speaker-notes, and the hidden attribute.');
  lines.push('- Notes are plain spoken text only: never visible in the slide, never rendered, never mixed into .slide-body, and never executed as markup or script.');
  lines.push(`- Writing style for every slide's notes: ${guidance}`);
  lines.push('');

  if (topic) {
    lines.push('Content and note outlines for each slide (use these as the plan):');
  } else {
    lines.push('Content and note outlines for each slide (empty lines are optional — infer them from the presentation itself):');
  }
  lines.push('');
  for (let i = 0; i < count; i++) {
    const row = rows[i];
    lines.push(`Slide ${i + 1}`);
    if (row.content) {
      lines.push(outlineLine('Content outline', row.content));
    } else {
      lines.push('Content outline: (optional — infer suitable slide content from the brief)');
    }
    if (row.notes) {
      lines.push(outlineLine('Speaker note outline', row.notes));
    } else {
      lines.push('Speaker note outline: (optional — write spoken notes that follow the note-writing style above)');
    }
    if (i < count - 1) lines.push('');
  }
  lines.push('');
  lines.push('Before returning, verify every slide: 16:9 stage, at most 2 visible text boxes, body type at least 32px, no overflow, notes hidden, and only one slide visible.');
  lines.push('Return only the complete HTML document.');

  return lines.join('\n');
}
