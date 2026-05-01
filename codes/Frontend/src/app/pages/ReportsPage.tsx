import { useEffect, useMemo, useState } from 'react';
import { Card, Button, Badge, RefreshButton } from '../components/UI';
import { Download } from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { apiService } from '../services/api';

const COLORS = ['#2563eb', '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const PATIENT_STATUS_ORDER = ['ACTIVE', 'CONSULTATION', 'MAINTENANCE', 'COMPLETED', 'INACTIVE'];
const PATIENT_CHART_WIDTH = 360;
const PATIENT_CHART_HEIGHT = 280;
const PATIENT_CENTER_X = PATIENT_CHART_WIDTH / 2;
const PATIENT_CENTER_Y = PATIENT_CHART_HEIGHT / 2;
const PATIENT_OUTER_RADIUS = 82;
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const VISIT_BAR_DEFAULT = '#2563eb';

type ReportPeriod = '24h' | '7d' | '30d' | '3m' | '6m' | '12m';

const toDateTimeString = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
};

const getDateRange = (period: ReportPeriod) => {
  const end = new Date();
  const start = new Date();

  if (period === '24h') {
    start.setHours(start.getHours() - 24);
  } else if (period === '7d') {
    start.setDate(start.getDate() - 7);
  } else if (period === '30d') {
    start.setDate(start.getDate() - 30);
  } else if (period === '3m') {
    start.setMonth(start.getMonth() - 3);
  } else if (period === '6m') {
    start.setMonth(start.getMonth() - 6);
  } else {
    start.setFullYear(start.getFullYear() - 1);
  }

  return {
    start_date: toDateTimeString(start),
    end_date: toDateTimeString(end),
  };
};

const getVisitGroupBy = (period: ReportPeriod) => {
  if (period === '24h') return 'hour';
  if (period === '7d') return 'day';
  if (period === '30d' || period === '3m') return 'week';
  return 'month';
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const addDays = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const addMonths = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + amount);
  return next;
};

const startOfWeek = (date: Date) => {
  const next = startOfDay(date);
  const weekday = (next.getDay() + 6) % 7;
  next.setDate(next.getDate() - weekday);
  return next;
};

const parseDateOnly = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

const formatDateKey = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatMonthKey = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
};

const formatHourKey = (date: Date) => `${formatDateKey(date)} ${String(date.getHours()).padStart(2, '0')}:00:00`;

const formatHourLabel = (hour: number) => {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour} ${suffix}`;
};

const formatWeekLabel = (weekStartKey: string) => {
  const start = parseDateOnly(weekStartKey);
  const end = addDays(start, 6);
  if (start.getMonth() === end.getMonth()) {
    return `${MONTH_LABELS[start.getMonth()]} ${start.getDate()}-${end.getDate()}`;
  }
  return `${MONTH_LABELS[start.getMonth()]} ${start.getDate()}-${MONTH_LABELS[end.getMonth()]} ${end.getDate()}`;
};

const formatMonthLabel = (monthKey: string, period: ReportPeriod) => {
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return monthKey;
  return period === '12m' ? `${MONTH_LABELS[month - 1]} ${year}` : MONTH_LABELS[month - 1];
};

const renderProcedureTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <p className="text-sm font-semibold text-gray-900">{label}</p>
      <div className="mt-2 space-y-1 text-xs text-gray-600">
        <p>Completed: {row.completed_count}</p>
        <p>Scheduled: {row.scheduled_count}</p>
        <p>Cancelled: {row.cancelled_count}</p>
        <p>Did Not Attend: {row.did_not_attend_count}</p>
        {row.other_status_count > 0 && <p>Other: {row.other_status_count}</p>}
      </div>
    </div>
  );
};

const renderVisitTrendTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <p className="text-sm font-semibold text-gray-900">{row.fullLabel || label}</p>
      <div className="mt-2 space-y-1 text-xs text-gray-600">
        <p>Patient visits: {row.total}</p>
        <p>Completed visits: {row.completed}</p>
        <p>Not completed: {row.notCompleted}</p>
      </div>
    </div>
  );
};

const renderPatientSliceLabel = ({ cx, cy, midAngle, outerRadius, value }: any) => {
  const angle = (-midAngle * Math.PI) / 180;
  const lineStartRadius = outerRadius + 4;
  const lineBendRadius = outerRadius + 18;
  const lineEndOffset = 18;

  const startX = cx + lineStartRadius * Math.cos(angle);
  const startY = cy + lineStartRadius * Math.sin(angle);
  const bendX = cx + lineBendRadius * Math.cos(angle);
  const bendY = cy + lineBendRadius * Math.sin(angle);
  const endX = bendX + (bendX >= cx ? lineEndOffset : -lineEndOffset);
  const endY = bendY;
  const textX = endX + (endX >= cx ? 4 : -4);

  return (
    <g>
      <path
        d={`M ${startX} ${startY} L ${bendX} ${bendY} L ${endX} ${endY}`}
        fill="none"
        stroke="#9ca3af"
        strokeWidth={1}
      />
      <circle cx={endX} cy={endY} r={2} fill="#9ca3af" />
      <text
        x={textX}
        y={endY}
        fill="#4b5563"
        textAnchor={endX >= cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize={12}
        fontWeight={600}
      >
        {value}
      </text>
    </g>
  );
};

const getPatientTooltipPosition = (midAngle: number) => {
  const angle = (-midAngle * Math.PI) / 180;
  const radius = PATIENT_OUTER_RADIUS + 54;
  const rawX = PATIENT_CENTER_X + radius * Math.cos(angle);
  const rawY = PATIENT_CENTER_Y + radius * Math.sin(angle);

  return {
    left: Math.min(Math.max(rawX, 70), PATIENT_CHART_WIDTH - 70),
    top: Math.min(Math.max(rawY, 44), PATIENT_CHART_HEIGHT - 44),
  };
};

export function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patient, setPatient] = useState<any>(null);
  const [visits, setVisits] = useState<any>(null);
  const [inventory, setInventory] = useState<any>(null);
  const [activePatientTooltip, setActivePatientTooltip] = useState<any>(null);
  const [period, setPeriod] = useState<ReportPeriod>('30d');
  const [alertType, setAlertType] = useState<'all' | 'critical' | 'low_stock' | 'out_of_stock'>('all');

  const loadReports = async () => {
    const dateRange = getDateRange(period);
    const visitGroupBy = getVisitGroupBy(period);
    setLoading(true);
    setError(null);

    const [p, v, i] = await Promise.allSettled([
      apiService.reports.patientStatus({ group_by: 'status', ...dateRange }),
      apiService.reports.visitSummary({ group_by: visitGroupBy, ...dateRange }),
      apiService.reports.inventoryAlerts(alertType),
    ]);

    setPatient(p.status === 'fulfilled' ? (p.value.data || null) : null);
    setVisits(v.status === 'fulfilled' ? (v.value.data || null) : null);
    setInventory(i.status === 'fulfilled' ? (i.value.data || null) : null);

    const failedLabels: string[] = [];
    if (p.status === 'rejected') failedLabels.push('patient status');
    if (v.status === 'rejected') failedLabels.push('visit summary');
    if (i.status === 'rejected') failedLabels.push('inventory alerts');

    if (failedLabels.length > 0) {
      setError(`Some report sections failed to load: ${failedLabels.join(', ')}`);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadReports();
  }, [period, alertType]);

  const patientBreakdown = useMemo(() => {
    const totalPatients = Number(patient?.overview?.total_patients || 0);
    const rows = (patient?.breakdown || [])
      .map((r: any) => ({
        name: String(r.group_key || 'Unknown').toUpperCase(),
        value: Number(r.patient_count || 0),
      }))
      .filter((r: any) => r.value > 0);

    rows.sort((a: any, b: any) => {
      const indexA = PATIENT_STATUS_ORDER.indexOf(a.name);
      const indexB = PATIENT_STATUS_ORDER.indexOf(b.name);
      if (indexA === -1 && indexB === -1) return b.value - a.value;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

    return rows.map((r: any) => ({
      ...r,
      label: r.name.replace(/_/g, ' '),
      percentage: totalPatients > 0 ? ((r.value / totalPatients) * 100).toFixed(1) : '0.0',
    }));
  }, [patient]);

  const patientChartData = useMemo(() => {
    const total = patientBreakdown.reduce((sum: number, row: any) => sum + row.value, 0);
    let currentAngle = 90;

    return patientBreakdown.map((row: any) => {
      const sweep = total > 0 ? (row.value / total) * 360 : 0;
      const midAngle = currentAngle - sweep / 2;
      currentAngle -= sweep;

      return {
        ...row,
        midAngle,
      };
    });
  }, [patientBreakdown]);

  const visitTrends = useMemo(() => {
    const rows = visits?.trends || [];
    const totalsByKey = new Map<string, { total: number; completed: number }>();

    for (const row of rows) {
      totalsByKey.set(String(row.group_key), {
        total: Number(row.total_visits || 0),
        completed: Number(row.completed_visits || 0),
      });
    }

    const range = getDateRange(period);
    const rangeStart = new Date(range.start_date.replace(' ', 'T'));
    const rangeEnd = new Date(range.end_date.replace(' ', 'T'));
    const buckets: Array<{
      rawKey: string;
      name: string;
      fullLabel: string;
      total: number;
      completed: number;
      notCompleted: number;
      color: string;
    }> = [];

    if (period === '24h') {
      const businessHours: Date[] = [];
      const cursor = new Date(rangeStart);
      cursor.setMinutes(0, 0, 0);

      while (cursor <= rangeEnd) {
        const hour = cursor.getHours();
        if (hour >= 8 && hour <= 17) {
          businessHours.push(new Date(cursor));
        }
        cursor.setHours(cursor.getHours() + 1, 0, 0, 0);
      }

      for (const slot of businessHours) {
        const key = formatHourKey(slot);
        const totals = totalsByKey.get(key) || { total: 0, completed: 0 };
        buckets.push({
          rawKey: key,
          name: formatHourLabel(slot.getHours()),
          fullLabel: `${MONTH_LABELS[slot.getMonth()]} ${slot.getDate()}, ${slot.getFullYear()} ${formatHourLabel(slot.getHours())}`,
          total: totals.total,
          completed: totals.completed,
          notCompleted: Math.max(0, totals.total - totals.completed),
          color: VISIT_BAR_DEFAULT,
        });
      }

      return buckets;
    }

    if (period === '7d') {
      let cursor = addDays(startOfDay(rangeEnd), -6);
      const end = startOfDay(rangeEnd);

      while (cursor <= end) {
        const key = formatDateKey(cursor);
        const totals = totalsByKey.get(key) || { total: 0, completed: 0 };
        buckets.push({
          rawKey: key,
          name: `${MONTH_LABELS[cursor.getMonth()]} ${cursor.getDate()}`,
          fullLabel: `${MONTH_LABELS[cursor.getMonth()]} ${cursor.getDate()}, ${cursor.getFullYear()}`,
          total: totals.total,
          completed: totals.completed,
          notCompleted: Math.max(0, totals.total - totals.completed),
          color: VISIT_BAR_DEFAULT,
        });
        cursor = addDays(cursor, 1);
      }

      return buckets;
    }

    if (period === '30d' || period === '3m') {
      const weeksToShow = period === '30d' ? 4 : 12;
      let cursor = startOfWeek(addDays(rangeEnd, -((weeksToShow - 1) * 7)));
      const lastWeek = startOfWeek(rangeEnd);

      while (cursor <= lastWeek) {
        const key = formatDateKey(cursor);
        const totals = totalsByKey.get(key) || { total: 0, completed: 0 };
        buckets.push({
          rawKey: key,
          name: formatWeekLabel(key),
          fullLabel: `Week of ${formatWeekLabel(key)}`,
          total: totals.total,
          completed: totals.completed,
          notCompleted: Math.max(0, totals.total - totals.completed),
          color: VISIT_BAR_DEFAULT,
        });
        cursor = addDays(cursor, 7);
      }

      return buckets;
    }

    const monthsToShow = period === '6m' ? 6 : 12;
    let cursor = startOfMonth(addMonths(rangeEnd, -(monthsToShow - 1)));
    const lastMonth = startOfMonth(rangeEnd);

    while (cursor <= lastMonth) {
      const key = formatMonthKey(cursor);
      const totals = totalsByKey.get(key) || { total: 0, completed: 0 };
      buckets.push({
        rawKey: key,
        name: formatMonthLabel(key, period),
        fullLabel: formatMonthLabel(key, '12m'),
        total: totals.total,
        completed: totals.completed,
        notCompleted: Math.max(0, totals.total - totals.completed),
        color: VISIT_BAR_DEFAULT,
      });
      cursor = addMonths(cursor, 1);
    }

    return buckets;
  }, [visits, period]);

  const procedureBreakdown = useMemo(
    () =>
      (visits?.procedure_breakdown || []).map((row: any) => {
        const count = Number(row.count || 0);
        const completed = Number(row.completed_count || 0);
        const pending = Math.max(0, count - completed);
        return {
          procedure_type: row.procedure_type,
          count,
          completed_count: completed,
          pending_count: pending,
          scheduled_count: Number(row.scheduled_count || 0),
          cancelled_count: Number(row.cancelled_count || 0),
          did_not_attend_count: Number(row.did_not_attend_count || 0),
          other_status_count: Number(row.other_status_count || 0),
          completion_rate: count > 0 ? Number(((completed / count) * 100).toFixed(1)) : 0,
        };
      }),
    [visits]
  );

  const inventoryAlerts = inventory?.alerts || [];
  const inventoryOverview = inventory?.overview || {};
  const totalInventoryAlerts =
    Number(inventoryOverview.out_of_stock_count || 0) +
    Number(inventoryOverview.critical_count || 0) +
    Number(inventoryOverview.low_stock_count || 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Analytics & Reports</h2>
          <p className="text-gray-500">Live data reports from patients, visits, and inventory.</p>
        </div>
        <div className="flex gap-2">
          <select
            className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm"
            value={period}
            onChange={(e) => setPeriod(e.target.value as ReportPeriod)}
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="3m">Last 3 months</option>
            <option value="6m">Last 6 months</option>
            <option value="12m">Last 12 months</option>
          </select>
          <select
            className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm"
            value={alertType}
            onChange={(e) => setAlertType(e.target.value as 'all' | 'critical' | 'low_stock' | 'out_of_stock')}
          >
            <option value="all">All Alerts</option>
            <option value="critical">Critical</option>
            <option value="low_stock">Low Stock</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>
          <RefreshButton onClick={loadReports} loading={loading} />
          <Button className="flex items-center gap-2" onClick={() => window.print()}>
            <Download className="w-4 h-4" /> Export
          </Button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs text-gray-500">Total Patients</p>
          <p className="text-2xl font-bold">{patient?.overview?.total_patients ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Active Patients</p>
          <p className="text-2xl font-bold text-blue-600">{patient?.overview?.active_patients ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Total Visits (period)</p>
          <p className="text-2xl font-bold text-green-600">{visitTrends.reduce((sum, row) => sum + row.total, 0)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Inventory Alerts</p>
          <p className="text-2xl font-bold text-amber-600">{totalInventoryAlerts}</p>
          <p className="text-xs text-gray-500 mt-1">Critical: {inventoryOverview.critical_count ?? 0}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <div className="mb-4">
            <h4 className="font-bold text-gray-900">Visit Trend</h4>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={visitTrends} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} minTickGap={12} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <Tooltip content={renderVisitTrendTooltip} />
                <Bar dataKey="total" radius={[6, 6, 0, 0]} name="Patient visits">
                  {visitTrends.map((entry: any) => (
                    <Cell key={entry.rawKey} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h4 className="font-bold mb-4">Patient Status Distribution</h4>
          <div className="space-y-4">
            <div className="relative mx-auto h-[280px] w-full max-w-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={patientChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={82}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="label"
                    stroke="#ffffff"
                    strokeWidth={2}
                    label={renderPatientSliceLabel}
                    labelLine={false}
                    startAngle={90}
                    endAngle={-270}
                    onMouseEnter={(_: any, index: number) => {
                      const row = patientChartData[index];
                      if (!row) return;
                      setActivePatientTooltip({
                        ...row,
                        ...getPatientTooltipPosition(row.midAngle),
                      });
                    }}
                    onMouseLeave={() => setActivePatientTooltip(null)}
                  >
                    {patientChartData.map((_: any, idx: number) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <p className="text-xs uppercase tracking-wide text-gray-500">Patients</p>
                <p className="text-2xl font-bold text-gray-900">{patient?.overview?.total_patients ?? 0}</p>
              </div>
              {activePatientTooltip && (
                <div
                  className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
                  style={{ left: activePatientTooltip.left, top: activePatientTooltip.top }}
                >
                  <p className="text-sm font-semibold text-gray-900">{activePatientTooltip.label}</p>
                  <div className="mt-2 space-y-1 text-xs text-gray-600">
                    <p>Count: {activePatientTooltip.value}</p>
                    <p>Percentage: {activePatientTooltip.percentage}%</p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              {patientChartData.map((status: any, idx: number) => (
                <div key={status.name} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <span className="font-medium">{status.label}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h4 className="font-bold mb-4">Top Procedures</h4>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={procedureBreakdown}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="procedure_type" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip content={renderProcedureTooltip} />
              <Legend />
              <Bar dataKey="completed_count" stackId="visits" fill="#10b981" radius={[4, 4, 0, 0]} name="Completed" />
              <Bar dataKey="pending_count" stackId="visits" fill="#6366f1" radius={[4, 4, 0, 0]} name="Not completed" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {procedureBreakdown.slice(0, 5).map((procedure: any) => (
            <div key={procedure.procedure_type} className="rounded-lg border border-gray-100 px-3 py-3 text-center">
              <p className="text-sm font-medium text-gray-900">{procedure.procedure_type}</p>
              <p className="mt-1 text-xs text-gray-500">{procedure.completion_rate}% completed</p>
              <p className="mt-2 text-xs font-medium text-gray-700">Not completed: {procedure.pending_count}</p>
              <p className="mt-1 text-xs text-gray-500">
                Scheduled {procedure.scheduled_count} | Cancelled {procedure.cancelled_count} | DNA {procedure.did_not_attend_count}
              </p>
              <p className="mt-1 text-xs text-gray-400">Other {procedure.other_status_count}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h4 className="font-bold mb-4">Inventory Alerts</h4>
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          <Badge variant="error">Out: {inventoryOverview.out_of_stock_count ?? 0}</Badge>
          <Badge variant="warning">Critical: {inventoryOverview.critical_count ?? 0}</Badge>
          <Badge variant="blue">Low: {inventoryOverview.low_stock_count ?? 0}</Badge>
        </div>
        <div className="space-y-2">
          {inventoryAlerts.length === 0 && !loading && <p className="text-sm text-gray-500">No inventory alerts.</p>}
          {inventoryAlerts.slice(0, 12).map((a: any) => (
            <div key={a.id} className="flex justify-between items-center p-3 border border-gray-100 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">{a.name}</p>
                <p className="text-xs text-gray-500">{a.category} | Qty: {a.quantity} / Min: {a.minimum_threshold}</p>
              </div>
              <Badge variant={a.alert_level === 'OUT_OF_STOCK' ? 'error' : a.alert_level === 'CRITICAL' ? 'warning' : 'blue'}>
                {a.alert_level}
              </Badge>
            </div>
          ))}
        </div>
      </Card>

      {loading && <p className="text-sm text-gray-500">Loading reports...</p>}
    </div>
  );
}
