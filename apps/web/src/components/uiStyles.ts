export const fieldInputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm shadow-slate-100 transition placeholder:text-slate-400 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-teal-100';

export const standardFieldInputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm shadow-slate-100 transition placeholder:text-slate-400 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-teal-100';

export const compactFieldInputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 shadow-sm shadow-slate-100 transition placeholder:text-slate-400 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-teal-100';

export const fieldLabelClass = 'mb-1.5 block text-[13px] font-semibold text-slate-700';
export const formLabelClass = 'mb-1.5 block text-sm font-semibold text-slate-700';

export const pageStackClass = 'flex flex-col gap-5 pb-8';
export const sectionCardClass = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70';
export const subtleSectionCardClass = 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40';
export const sectionHeaderClass = 'mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 text-base font-semibold text-[var(--color-navy)]';
export const sectionIconClass = 'flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-[var(--color-primary)] ring-1 ring-teal-100';

export const emptyStateClass =
  'flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center';
export const smallEmptyStateClass =
  'rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-xs text-slate-400';

export const patientStripClass = sectionCardClass;
export const patientAvatarClass =
  'flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-400 ring-1 ring-slate-200';
export const patientNameClass = 'text-lg font-semibold text-[var(--color-navy)]';
export const patientMetaClass = 'mt-1 text-xs font-medium text-slate-500';
export const visitBadgeClass = 'rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600';
export const patientAlertClass = 'mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800';

export const quickChipClass =
  'rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-[var(--color-primary)] hover:bg-teal-50 hover:text-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-teal-100';

export const primaryButtonClass =
  'rounded-lg bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-teal-200 transition hover:-translate-y-0.5 hover:opacity-95 disabled:translate-y-0 disabled:opacity-50';

export const secondaryButtonClass =
  'rounded-lg border border-teal-200 bg-white px-5 py-2.5 text-sm font-semibold text-[var(--color-primary)] shadow-sm transition hover:border-[var(--color-primary)] hover:bg-teal-50 disabled:opacity-50';

export const toolbarButtonClass =
  'flex w-fit items-center gap-1.5 rounded-lg px-1 py-1 text-sm font-medium text-slate-500 transition hover:text-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-teal-100';

export type ActionTone = 'blue' | 'green' | 'amber' | 'cyan' | 'red';

export const actionToneClass: Record<ActionTone, string> = {
  blue: 'border-blue-200 text-blue-600 hover:border-blue-300 hover:bg-blue-50 focus-visible:ring-blue-200',
  green: 'border-green-200 text-green-600 hover:border-green-300 hover:bg-green-50 focus-visible:ring-green-200',
  amber: 'border-amber-200 text-amber-600 hover:border-amber-300 hover:bg-amber-50 focus-visible:ring-amber-200',
  cyan: 'border-cyan-200 text-cyan-700 hover:border-cyan-300 hover:bg-cyan-50 focus-visible:ring-cyan-200',
  red: 'border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50 focus-visible:ring-red-200',
};

export const actionIconClass =
  'group relative inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg border bg-white transition hover:-translate-y-0.5 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1';

export const actionTooltipClass =
  'pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-visible:opacity-100';
