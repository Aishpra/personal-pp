// The 7-phase service workflow from the planning PDF, as a checklist.
// Task ids are stored in project files, so rename labels freely but keep ids stable.
const PHASES = [
  {
    id: 'intake',
    name: '1. Intake',
    owner: 'client',
    days: 'Day 1-2',
    tasks: [
      { id: 'intake-form', label: 'Client submitted intake form' },
      { id: 'intake-assets', label: 'Logo + media checked (quality, format)' },
      { id: 'intake-scope', label: 'Scope signed' },
      { id: 'intake-deposit', label: '50% deposit received' },
    ],
  },
  {
    id: 'strategy',
    name: '2. Strategy',
    owner: 'you',
    days: 'Day 3-4',
    tasks: [
      { id: 'strategy-keywords', label: 'Keyword research' },
      { id: 'strategy-sitemap', label: 'Sitemap approved by client' },
      { id: 'strategy-style', label: 'Style guide (colours, fonts)' },
    ],
  },
  {
    id: 'copy',
    name: '3. Copywriting',
    owner: 'you',
    days: 'Day 4-7',
    tasks: [
      { id: 'copy-pages', label: 'Page copy written (replace generated drafts)' },
      { id: 'copy-ctas', label: 'CTAs' },
      { id: 'copy-meta', label: 'SEO titles + meta descriptions' },
      { id: 'copy-facts', label: 'Client checked facts' },
    ],
  },
  {
    id: 'build',
    name: '4. Design + Dev',
    owner: 'you',
    days: 'Day 7-14',
    tasks: [
      { id: 'build-push', label: 'Draft pushed to staging' },
      { id: 'build-pages', label: 'Pages polished in WordPress' },
      { id: 'build-forms', label: 'Contact form working' },
      { id: 'build-mobile', label: 'Mobile checked' },
    ],
  },
  {
    id: 'seo',
    name: '5. SEO + Speed',
    owner: 'you',
    days: 'Day 12-15',
    tasks: [
      { id: 'seo-onpage', label: 'On-page SEO' },
      { id: 'seo-schema', label: 'LocalBusiness schema' },
      { id: 'seo-images', label: 'Images compressed + alt text' },
      { id: 'seo-analytics', label: 'Analytics installed' },
    ],
  },
  {
    id: 'review',
    name: '6. Review',
    owner: 'client',
    days: 'Day 15-18',
    tasks: [
      { id: 'review-r1', label: 'Revision round 1 done' },
      { id: 'review-r2', label: 'Revision round 2 done' },
      { id: 'review-signoff', label: 'Client sign-off' },
    ],
  },
  {
    id: 'launch',
    name: '7. Launch',
    owner: 'you',
    days: 'Day 19-20',
    tasks: [
      { id: 'launch-final-payment', label: 'Final 50% received' },
      { id: 'launch-live', label: 'Moved to live hosting + SSL' },
      { id: 'launch-backups', label: 'Backups scheduled' },
      { id: 'launch-gsc', label: 'Submitted to Search Console' },
      { id: 'launch-handover', label: 'Training video + handover doc sent' },
    ],
  },
];

function phaseProgress(project) {
  return PHASES.map((phase) => {
    const done = phase.tasks.filter((t) => project.checklist[t.id]).length;
    return { ...phase, done, total: phase.tasks.length, complete: done === phase.tasks.length };
  });
}

// The current phase is the first one with unfinished tasks.
function currentPhase(project) {
  return phaseProgress(project).find((p) => !p.complete) || null;
}

module.exports = { PHASES, phaseProgress, currentPhase };
