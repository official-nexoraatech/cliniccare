import { useState } from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import type { OutstandingDueItem } from '@clinic-care/shared-types';
import { useAuthStore } from '@/store/auth-store';
import { hasPermission } from '@/lib/permissions';
import { InlineSkeleton } from '@/components/Skeleton';
import { formLabelClass, sectionCardClass, sectionHeaderClass, smallEmptyStateClass, standardFieldInputClass } from '@/components/uiStyles';
import { useOutstandingDuesQuery } from '@/hooks/useAccounts';
import {
  useAppointmentFunnelQuery,
  usePatientFootfallQuery,
  useRevenueTrendQuery,
  useTopMedicinesQuery,
} from '@/hooks/useReports';

// Validated categorical palette (dataviz skill reference, slots 1/2/3) — fixed hue
// order, never cycled. The app has no other multi-series charts, so this stays
// scoped to this page.
const REVENUE_COLORS = { billed: '#2a78d6', collected: '#eb6834' };
const FOOTFALL_COLORS = { new: '#2a78d6', followUp: '#1baf7a', emergency: '#eb6834' };
const MEDICINE_COLOR = '#2a78d6';

// Ordinal ramp (light -> dark) for the funnel's ordered stages — the palette
// reference names "funnel stages" as the canonical ordinal use case.
const FUNNEL_FLOW_COLORS = ['#86b6ef', '#6da7ec', '#3987e5', '#2a78d6', '#1c5cab'];

// Fixed status palette — never themed, never reused for a plain series. Aging
// buckets are genuinely a risk-status ladder, so this is the right fit (not the
// ordinal ramp), and status color is always paired with an icon + label, never
// carried by hue alone.
const STATUS_COLORS = { good: '#0ca30c', warning: '#fab219', serious: '#ec835a', critical: '#d03b3b' };
const STATUS_ICONS = { good: CheckCircle2, warning: Clock, serious: AlertTriangle, critical: AlertOctagon };

const AGING_BUCKETS: { label: string; maxAge: number; status: keyof typeof STATUS_COLORS }[] = [
  { label: '0-7 days', maxAge: 7, status: 'good' },
  { label: '8-15 days', maxAge: 15, status: 'warning' },
  { label: '16-30 days', maxAge: 30, status: 'serious' },
  { label: '30+ days', maxAge: Infinity, status: 'critical' },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function money(value: number) {
  return `₹${value.toLocaleString('en-IN')}`;
}

function compactMoney(value: number) {
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(value % 100_000 === 0 ? 0 : 1)}L`;
  if (value >= 1_000) return `₹${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}k`;
  return `₹${value}`;
}

function dayNum(iso: string) {
  return new Date(iso).getDate().toString().padStart(2, '0');
}

function fmtRange(from: string, to: string) {
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
  return `${new Date(from).toLocaleDateString('en-IN', opts)} – ${new Date(to).toLocaleDateString('en-IN', { ...opts, year: 'numeric' })}`;
}

function denseDateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(from);
  const end = new Date(to);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function bucketDues(dues: OutstandingDueItem[] | undefined) {
  const buckets = AGING_BUCKETS.map((b) => ({ ...b, amount: 0, count: 0 }));
  if (!dues) return buckets;
  const now = Date.now();
  for (const due of dues) {
    const ageDays = Math.floor((now - new Date(due.date).getTime()) / 86_400_000);
    const bucket = buckets.find((b) => ageDays <= b.maxAge) ?? buckets[buckets.length - 1];
    bucket.amount += due.dueAmount;
    bucket.count += 1;
  }
  return buckets;
}

// Rounds a max value up to a clean 1/2/5×10^n step, then multiplies by the
// step count — so every gridline (not just the top one) lands on a round number.
function niceAxis(maxValue: number, steps = 4) {
  const rawStep = maxValue / steps || 1;
  const exp = Math.floor(Math.log10(rawStep));
  const base = 10 ** exp;
  const norm = rawStep / base;
  const niceNorm = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  const step = niceNorm * base;
  return { step, max: step * steps };
}

function tint(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Top corners rounded to a 4px data-end, square at the baseline — never a
// uniformly-rounded rect, which would round the baseline too.
function roundedTopRectPath(x: number, y: number, w: number, h: number, r = 4) {
  if (h <= 0 || w <= 0) return '';
  const radius = Math.min(r, h, w / 2);
  return `M${x},${y + h} V${y + radius} Q${x},${y} ${x + radius},${y} H${x + w - radius} Q${x + w},${y} ${x + w},${y + radius} V${y + h} Z`;
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
      <span className="h-2.5 w-4 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function StatTile({ label, value, loading }: { label: string; value: string; loading?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-2 text-2xl font-bold text-[var(--color-navy)]">
        {loading ? <InlineSkeleton className="h-7 w-24" /> : value}
      </div>
    </div>
  );
}

interface SeriesDef {
  key: string;
  label: string;
  color: string;
}

/** Grouped or stacked day-by-day bar chart, built in plain SVG (no charting
 * library in this app). Handles both Revenue Trend (grouped) and Patient
 * Footfall (stacked) — same mark specs, hover, and axis either way. */
function MultiSeriesBarChart<T extends { date: string }>({
  points,
  series,
  mode,
  formatTick,
  formatTooltipValue,
}: {
  points: T[];
  series: SeriesDef[];
  mode: 'grouped' | 'stacked';
  formatTick: (value: number) => string;
  formatTooltipValue: (value: number) => string;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const valueAt = (p: T, key: string) => Number((p as unknown as Record<string, number>)[key]) || 0;

  const plotHeight = 148;
  const axisBand = 20;
  const height = plotHeight + axisBand;
  const colWidth = 26;
  const width = Math.max(points.length * colWidth, 280);

  const rawMax =
    mode === 'stacked'
      ? Math.max(0, ...points.map((p) => series.reduce((sum, s) => sum + valueAt(p, s.key), 0)))
      : Math.max(0, ...points.flatMap((p) => series.map((s) => valueAt(p, s.key))));
  const { step, max } = niceAxis(Math.max(rawMax, 1));
  const ticks = [0, step, step * 2, step * 3, step * 4];
  const yFor = (v: number) => plotHeight - (v / max) * plotHeight;

  const labelEvery = Math.max(1, Math.ceil(points.length / 8));

  const barGap = 2;
  const barThickness = mode === 'stacked' ? 16 : Math.min(9, (colWidth - barGap * (series.length - 1) - 6) / series.length);
  const groupWidth = mode === 'stacked' ? barThickness : barThickness * series.length + barGap * (series.length - 1);
  const groupOffset = (colWidth - groupWidth) / 2;

  return (
    <div className="flex gap-2">
      <div className="flex flex-shrink-0 flex-col justify-between text-right text-[10px] text-slate-400" style={{ height: plotHeight }}>
        {[...ticks].reverse().map((t) => (
          <span key={t}>{formatTick(t)}</span>
        ))}
      </div>

      <div className="relative flex-1 overflow-x-auto pb-1">
        <svg width={width} height={height} className="block">
          {ticks.map((t) => (
            <line key={t} x1={0} x2={width} y1={yFor(t)} y2={yFor(t)} stroke="#e1e0d9" strokeWidth={1} />
          ))}

          {hoverIndex !== null && (
            <rect x={hoverIndex * colWidth} y={0} width={colWidth} height={plotHeight} fill="rgba(11, 11, 11, 0.04)" />
          )}

          {points.map((p, i) => {
            const x = i * colWidth;
            if (mode === 'stacked') {
              let cursor = plotHeight;
              return (
                <g key={p.date}>
                  {series.map((s, si) => {
                    const value = valueAt(p, s.key);
                    const h = (value / max) * plotHeight;
                    const y = cursor - h;
                    const isTop = series.slice(si + 1).every((rest) => valueAt(p, rest.key) === 0);
                    cursor = y - (h > 0 ? barGap : 0);
                    if (h <= 0) return null;
                    return isTop ? (
                      <path key={s.key} d={roundedTopRectPath(x + groupOffset, y, barThickness, h)} fill={s.color} />
                    ) : (
                      <rect key={s.key} x={x + groupOffset} y={y} width={barThickness} height={h} fill={s.color} />
                    );
                  })}
                </g>
              );
            }
            return (
              <g key={p.date}>
                {series.map((s, si) => {
                  const value = valueAt(p, s.key);
                  const h = (value / max) * plotHeight;
                  const barX = x + groupOffset + si * (barThickness + barGap);
                  return <path key={s.key} d={roundedTopRectPath(barX, plotHeight - h, barThickness, h)} fill={s.color} />;
                })}
              </g>
            );
          })}

          {points.map((p, i) =>
            i % labelEvery === 0 ? (
              <text key={p.date} x={i * colWidth + colWidth / 2} y={plotHeight + 14} textAnchor="middle" fontSize={10} fill="#898781">
                {dayNum(p.date)}
              </text>
            ) : null,
          )}

          {points.map((_, i) => (
            <rect
              key={i}
              x={i * colWidth}
              y={0}
              width={colWidth}
              height={plotHeight}
              fill="transparent"
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
            />
          ))}
        </svg>

        {hoverIndex !== null && (
          <div
            className="pointer-events-none absolute z-10 min-w-max -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-lg shadow-slate-200/60"
            style={{ left: Math.min(Math.max(hoverIndex * colWidth + colWidth / 2, 60), width - 60), top: 4 }}
          >
            <p className="mb-1 font-semibold text-slate-700">{new Date(points[hoverIndex].date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
            {series.map((s) => (
              <p key={s.key} className="flex items-center gap-1.5 text-slate-500">
                <span className="h-2 w-2.5 flex-shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
                {s.label}: <span className="font-semibold text-slate-800">{formatTooltipValue(valueAt(points[hoverIndex], s.key))}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MeterRow({
  label,
  value,
  max,
  color,
  valueLabel,
  Icon,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  valueLabel: string;
  Icon?: typeof CheckCircle2;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      {Icon && <Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color }} />}
      <span className={`${Icon ? 'w-20' : 'w-32'} truncate text-sm text-slate-600`}>{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: tint(color, 0.14) }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="w-28 flex-shrink-0 text-right text-sm font-medium text-slate-700">{valueLabel}</span>
    </div>
  );
}

export function ReportsPage() {
  const user = useAuthStore((state) => state.user);
  const canViewBilling = hasPermission(user, 'billing:view');
  const [from, setFrom] = useState(daysAgoIso(29));
  const [to, setTo] = useState(todayIso());

  const { data: revenueTrend, isLoading: revenueLoading } = useRevenueTrendQuery(from, to, canViewBilling);
  const { data: footfall, isLoading: footfallLoading } = usePatientFootfallQuery(from, to);
  const { data: funnel, isLoading: funnelLoading } = useAppointmentFunnelQuery(from, to);
  const { data: topMedicines, isLoading: medicinesLoading } = useTopMedicinesQuery(10);
  const { data: dues, isLoading: duesLoading } = useOutstandingDuesQuery(canViewBilling);

  const revenueByDay = new Map((revenueTrend?.points ?? []).map((p) => [p.date, p]));
  const revenuePoints = denseDateRange(from, to).map(
    (date) => revenueByDay.get(date) ?? { date, billed: 0, collected: 0 },
  );

  const footfallByDay = new Map((footfall?.points ?? []).map((p) => [p.date, p]));
  const footfallPoints = denseDateRange(from, to).map(
    (date) => footfallByDay.get(date) ?? { date, new: 0, followUp: 0, emergency: 0, total: 0 },
  );

  const maxMedicineUsage = Math.max(1, ...(topMedicines?.map((m) => m.usageCount) ?? [0]));
  const agingBuckets = bucketDues(dues);
  const maxAgingAmount = Math.max(1, ...agingBuckets.map((b) => b.amount));

  const funnelRows = funnel
    ? [
        { label: 'Booked', value: funnel.booked, color: FUNNEL_FLOW_COLORS[0] },
        { label: 'Confirmed', value: funnel.confirmed, color: FUNNEL_FLOW_COLORS[1] },
        { label: 'Arrived', value: funnel.arrived, color: FUNNEL_FLOW_COLORS[2] },
        { label: 'In Consultation', value: funnel.inConsultation, color: FUNNEL_FLOW_COLORS[3] },
        { label: 'Done', value: funnel.done, color: FUNNEL_FLOW_COLORS[4] },
        { label: 'Cancelled', value: funnel.cancelled, color: STATUS_COLORS.critical },
        { label: 'No Show', value: funnel.noShow, color: STATUS_COLORS.critical },
      ]
    : [];
  const maxFunnel = Math.max(1, ...funnelRows.map((r) => r.value));

  const totalBilled = revenuePoints.reduce((sum, p) => sum + p.billed, 0);
  const totalCollected = revenuePoints.reduce((sum, p) => sum + p.collected, 0);
  const totalPatients = footfallPoints.reduce((sum, p) => sum + p.total, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-navy)]">Reports</h1>
          <p className="text-sm text-gray-500">Trends and breakdowns over a selected date range.</p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <label className={formLabelClass}>From</label>
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={`${standardFieldInputClass} w-auto`} />
          </div>
          <div>
            <label className={formLabelClass}>To</label>
            <input type="date" value={to} min={from} max={todayIso()} onChange={(e) => setTo(e.target.value)} className={`${standardFieldInputClass} w-auto`} />
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-2 gap-4 ${canViewBilling ? 'md:grid-cols-4' : 'md:grid-cols-2'}`}>
        {canViewBilling && (
          <>
            <StatTile label="Total Billed" value={money(totalBilled)} loading={revenueLoading} />
            <StatTile label="Total Collected" value={money(totalCollected)} loading={revenueLoading} />
          </>
        )}
        <StatTile label="Patients Seen" value={String(totalPatients)} loading={footfallLoading} />
        <StatTile label="Appointments" value={String(funnel?.total ?? 0)} loading={funnelLoading} />
      </div>

      {canViewBilling && (
        <div className={sectionCardClass}>
          <div className={`${sectionHeaderClass} justify-between`}>
            <span>Revenue Trend</span>
            <div className="flex items-center gap-3">
              <LegendSwatch color={REVENUE_COLORS.billed} label="Billed" />
              <LegendSwatch color={REVENUE_COLORS.collected} label="Collected" />
            </div>
          </div>
          <p className="mb-3 text-xs text-slate-400">{fmtRange(from, to)}</p>
          {revenueLoading ? (
            <InlineSkeleton className="h-40 w-full" />
          ) : revenuePoints.every((p) => p.billed === 0 && p.collected === 0) ? (
            <div className={smallEmptyStateClass}>No bills or payments in this range</div>
          ) : (
            <MultiSeriesBarChart
              points={revenuePoints}
              mode="grouped"
              series={[
                { key: 'billed', label: 'Billed', color: REVENUE_COLORS.billed },
                { key: 'collected', label: 'Collected', color: REVENUE_COLORS.collected },
              ]}
              formatTick={compactMoney}
              formatTooltipValue={money}
            />
          )}
        </div>
      )}

      <div className={sectionCardClass}>
        <div className={`${sectionHeaderClass} justify-between`}>
          <span>Patient Footfall</span>
          <div className="flex items-center gap-3">
            <LegendSwatch color={FOOTFALL_COLORS.new} label="New" />
            <LegendSwatch color={FOOTFALL_COLORS.followUp} label="Follow-up" />
            <LegendSwatch color={FOOTFALL_COLORS.emergency} label="Emergency" />
          </div>
        </div>
        <p className="mb-3 text-xs text-slate-400">{fmtRange(from, to)}</p>
        {footfallLoading ? (
          <InlineSkeleton className="h-40 w-full" />
        ) : footfallPoints.every((p) => p.total === 0) ? (
          <div className={smallEmptyStateClass}>No visits in this range</div>
        ) : (
          <MultiSeriesBarChart
            points={footfallPoints}
            mode="stacked"
            series={[
              { key: 'new', label: 'New', color: FOOTFALL_COLORS.new },
              { key: 'followUp', label: 'Follow-up', color: FOOTFALL_COLORS.followUp },
              { key: 'emergency', label: 'Emergency', color: FOOTFALL_COLORS.emergency },
            ]}
            formatTick={(v) => String(Math.round(v))}
            formatTooltipValue={(v) => String(v)}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={sectionCardClass}>
          <div className={sectionHeaderClass}>Appointment Funnel</div>
          <p className="mb-3 text-xs text-slate-400">{fmtRange(from, to)} · {funnel?.total ?? 0} total</p>
          {funnelLoading ? (
            <InlineSkeleton className="h-40 w-full" />
          ) : !funnel || funnel.total === 0 ? (
            <div className={smallEmptyStateClass}>No appointments in this range</div>
          ) : (
            <div className="flex flex-col gap-2">
              {funnelRows.map((row) => (
                <MeterRow key={row.label} label={row.label} value={row.value} max={maxFunnel} color={row.color} valueLabel={String(row.value)} />
              ))}
            </div>
          )}
        </div>

        <div className={sectionCardClass}>
          <div className={sectionHeaderClass}>Most Prescribed Medicines</div>
          <p className="mb-3 text-xs text-slate-400">All-time usage count</p>
          {medicinesLoading ? (
            <InlineSkeleton className="h-40 w-full" />
          ) : !topMedicines || topMedicines.length === 0 ? (
            <div className={smallEmptyStateClass}>No prescriptions recorded yet</div>
          ) : (
            <div className="flex flex-col gap-2">
              {topMedicines.map((medicine, index) => (
                <MeterRow
                  key={medicine.id}
                  label={`${index + 1}. ${medicine.brandName}`}
                  value={medicine.usageCount}
                  max={maxMedicineUsage}
                  color={MEDICINE_COLOR}
                  valueLabel={String(medicine.usageCount)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {canViewBilling && (
        <div className={sectionCardClass}>
          <div className={sectionHeaderClass}>Outstanding Dues Aging</div>
          <p className="mb-3 text-xs text-slate-400">Current snapshot, by days since bill date</p>
          {duesLoading ? (
            <InlineSkeleton className="h-24 w-full" />
          ) : !dues || dues.length === 0 ? (
            <div className={smallEmptyStateClass}>No outstanding dues — all bills settled</div>
          ) : (
            <div className="flex flex-col gap-2">
              {agingBuckets.map((bucket) => (
                <MeterRow
                  key={bucket.label}
                  label={bucket.label}
                  value={bucket.amount}
                  max={maxAgingAmount}
                  color={STATUS_COLORS[bucket.status]}
                  valueLabel={`${money(bucket.amount)} (${bucket.count})`}
                  Icon={STATUS_ICONS[bucket.status]}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
