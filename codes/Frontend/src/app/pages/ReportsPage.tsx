import React, { useEffect, useMemo, useState } from 'react';
import { Card, Button, Badge, RefreshButton, Input } from '../components/UI';
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
  LineChart,
  Line,
} from 'recharts';
import { apiService } from '../services/api';

const COLORS = ['#2563eb', '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const buildCsv = (rows: Array<Record<string, unknown>>) => {
  if (!rows.length) {
    return 'No data available\n';
  }

  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>())
  );

  const escapeCell = (value: unknown) => {
    const text = value == null ? '' : String(value);
    const escaped = text.replace(/"/g, '""');
    return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
  };

  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(','))
  ];

  return `${lines.join('\n')}\n`;
};

const downloadCsv = (filename: string, rows: Array<Record<string, unknown>>) => {
  const blob = new Blob([buildCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const toNumber = (value: unknown) => Number(value || 0);

export function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [patient, setPatient] = useState<any>(null);
  const [visits, setVisits] = useState<any>(null);
  const [payments, setPayments] = useState<any>(null);
  const [inventory, setInventory] = useState<any>(null);
  const [filters, setFilters] = useState({
    period: 'month',
    start_date: '',
    end_date: '',
    patient_group_by: 'status',
    visit_group_by: 'month',
    payment_group_by: 'month',
    inventory_alert_type: 'all',
  });
  const [exportTarget, setExportTarget] = useState('dashboard');

  const loadReports = async () => {
    setLoading(true);
    setError(null);

    const [dashboardResult, patientResult, visitResult, paymentResult, inventoryResult] = await Promise.allSettled([
      apiService.reports.dashboard(filters.period as 'week' | 'month' | 'quarter' | 'year'),
      apiService.reports.patientStatus({
        group_by: filters.patient_group_by,
        start_date: filters.start_date || undefined,
        end_date: filters.end_date || undefined,
      }),
      apiService.reports.visitSummary({
        group_by: filters.visit_group_by,
        start_date: filters.start_date || undefined,
        end_date: filters.end_date || undefined,
      }),
      apiService.reports.paymentSummary({
        group_by: filters.payment_group_by,
        start_date: filters.start_date || undefined,
        end_date: filters.end_date || undefined,
      }),
      apiService.reports.inventoryAlerts(filters.inventory_alert_type),
    ]);

    setDashboard(dashboardResult.status === 'fulfilled' ? (dashboardResult.value.data || null) : null);
    setPatient(patientResult.status === 'fulfilled' ? (patientResult.value.data || null) : null);
    setVisits(visitResult.status === 'fulfilled' ? (visitResult.value.data || null) : null);
    setPayments(paymentResult.status === 'fulfilled' ? (paymentResult.value.data || null) : null);
    setInventory(inventoryResult.status === 'fulfilled' ? (inventoryResult.value.data || null) : null);

    const failedLabels: string[] = [];
    if (dashboardResult.status === 'rejected') failedLabels.push('dashboard');
    if (patientResult.status === 'rejected') failedLabels.push('patient status');
    if (visitResult.status === 'rejected') failedLabels.push('visit summary');
    if (paymentResult.status === 'rejected') failedLabels.push('payment summary');
    if (inventoryResult.status === 'rejected') failedLabels.push('inventory alerts');

    if (failedLabels.length > 0) {
      setError(`Some report sections failed to load: ${failedLabels.join(', ')}`);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadReports();
  }, []);

  const patientBreakdown = useMemo(
    () => (patient?.breakdown || []).map((row: any) => ({ name: row.group_key || 'Unknown', value: toNumber(row.patient_count) })),
    [patient]
  );

  const visitTrends = useMemo(
    () => (visits?.trends || []).map((row: any) => ({ name: String(row.group_key), total: toNumber(row.total_visits), completed: toNumber(row.completed_visits) })).reverse(),
    [visits]
  );

  const paymentTrends = useMemo(
    () => (payments?.trends || []).map((row: any) => ({ name: String(row.group_key), total: toNumber(row.total_amount), average: toNumber(row.average_amount) })).reverse(),
    [payments]
  );

  const paymentMethods = useMemo(
    () => (payments?.method_breakdown || []).map((row: any) => ({ name: row.payment_method || 'Unknown', value: toNumber(row.total_amount) })),
    [payments]
  );

  const topProcedures = useMemo(
    () => (dashboard?.top_procedures || []).map((row: any) => ({ procedure_type: row.procedure_type || 'Unknown', count: toNumber(row.count) })),
    [dashboard]
  );

  const studentProgress = dashboard?.student_progress || [];
  const inventoryAlerts = inventory?.alerts || [];

  const exportRows = useMemo(() => {
    switch (exportTarget) {
      case 'patient':
        return (patient?.breakdown || []).map((row: any) => ({
          report: 'patient_status',
          group_key: row.group_key,
          patient_count: row.patient_count,
          average_age: row.average_age,
          male_count: row.male_count,
          female_count: row.female_count,
          nhi_verified_count: row.nhi_verified_count,
        }));
      case 'visits':
        return (visits?.trends || []).map((row: any) => ({
          report: 'visit_summary',
          group_key: row.group_key,
          total_visits: row.total_visits,
          completed_visits: row.completed_visits,
          scheduled_visits: row.scheduled_visits,
          cancelled_visits: row.cancelled_visits,
          avg_duration_minutes: row.avg_duration_minutes,
        }));
      case 'payments':
        return (payments?.trends || []).map((row: any) => ({
          report: 'payment_summary',
          group_key: row.group_key,
          total_records: row.total_records,
          total_amount: row.total_amount,
          average_amount: row.average_amount,
          paid_records: row.paid_records,
          pending_records: row.pending_records,
          refunded_records: row.refunded_records,
        }));
      case 'inventory':
        return inventoryAlerts.map((row: any) => ({
          report: 'inventory_alerts',
          name: row.name,
          category: row.category,
          quantity: row.quantity,
          minimum_threshold: row.minimum_threshold,
          alert_level: row.alert_level,
          shortage_quantity: row.shortage_quantity,
          shortage_percentage: row.shortage_percentage,
        }));
      case 'dashboard':
      default:
        return [
          {
            report: 'dashboard_metrics',
            total_patients: dashboard?.metrics?.total_patients,
            active_patients: dashboard?.metrics?.active_patients,
            period_visits: dashboard?.metrics?.period_visits,
            completed_visits: dashboard?.metrics?.completed_visits,
            period_cases: dashboard?.metrics?.period_cases,
            verified_cases: dashboard?.metrics?.verified_cases,
            inventory_alerts: dashboard?.metrics?.inventory_alerts,
            active_users: dashboard?.metrics?.active_users,
          },
          ...(dashboard?.department_activity || []).map((row: any) => ({
            report: 'dashboard_department_activity',
            department: row.department,
            user_count: row.user_count,
            visit_count: row.visit_count,
            case_count: row.case_count,
          })),
          ...(dashboard?.student_progress || []).map((row: any) => ({
            report: 'dashboard_student_progress',
            student_name: row.student_name,
            total_cases: row.total_cases,
            verified_cases: row.verified_cases,
            completion_rate: row.completion_rate,
          })),
        ];
    }
  }, [dashboard, exportTarget, inventoryAlerts, patient, payments, visits]);

  const handleExport = () => {
    downloadCsv(`${exportTarget}-report.csv`, exportRows);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Analytics & Reports</h2>
          <p className="text-gray-500">Dashboard metrics, patient trends, visits, payments, and inventory risk in one place.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RefreshButton onClick={loadReports} loading={loading} />
          <select
            className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700"
            value={exportTarget}
            onChange={(event) => setExportTarget(event.target.value)}
          >
            <option value="dashboard">Export dashboard</option>
            <option value="patient">Export patients</option>
            <option value="visits">Export visits</option>
            <option value="payments">Export payments</option>
            <option value="inventory">Export inventory</option>
          </select>
          <Button className="flex items-center gap-2" onClick={handleExport}>
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <Card className="p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">Dashboard Period</label>
            <select
              className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700"
              value={filters.period}
              onChange={(event) => setFilters((current) => ({ ...current, period: event.target.value }))}
            >
              <option value="week">Week</option>
              <option value="month">Month</option>
              <option value="quarter">Quarter</option>
              <option value="year">Year</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">Start Date</label>
            <Input type="date" value={filters.start_date} onChange={(event) => setFilters((current) => ({ ...current, start_date: event.target.value }))} />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">End Date</label>
            <Input type="date" value={filters.end_date} onChange={(event) => setFilters((current) => ({ ...current, end_date: event.target.value }))} />
          </div>
          <div className="flex items-end">
            <Button className="w-full" onClick={loadReports}>Apply Filters</Button>
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">Patient Grouping</label>
            <select
              className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700"
              value={filters.patient_group_by}
              onChange={(event) => setFilters((current) => ({ ...current, patient_group_by: event.target.value }))}
            >
              <option value="status">Status</option>
              <option value="gender">Gender</option>
              <option value="age_group">Age Group</option>
              <option value="month">Month</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">Visit Grouping</label>
            <select
              className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700"
              value={filters.visit_group_by}
              onChange={(event) => setFilters((current) => ({ ...current, visit_group_by: event.target.value }))}
            >
              <option value="month">Month</option>
              <option value="week">Week</option>
              <option value="day">Day</option>
              <option value="status">Status</option>
              <option value="provider">Provider</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">Payment Grouping</label>
            <select
              className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700"
              value={filters.payment_group_by}
              onChange={(event) => setFilters((current) => ({ ...current, payment_group_by: event.target.value }))}
            >
              <option value="month">Month</option>
              <option value="week">Week</option>
              <option value="day">Day</option>
              <option value="payment_method">Payment Method</option>
              <option value="status">Status</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">Inventory Alert Type</label>
            <select
              className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700"
              value={filters.inventory_alert_type}
              onChange={(event) => setFilters((current) => ({ ...current, inventory_alert_type: event.target.value }))}
            >
              <option value="all">All alerts</option>
              <option value="critical">Critical</option>
              <option value="low_stock">Low stock</option>
              <option value="out_of_stock">Out of stock</option>
            </select>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-gray-500">Total Patients</p>
          <p className="text-2xl font-bold">{dashboard?.metrics?.total_patients ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Visits In Period</p>
          <p className="text-2xl font-bold text-blue-600">{dashboard?.metrics?.period_visits ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Total Revenue</p>
          <p className="text-2xl font-bold text-emerald-600">LKR {toNumber(payments?.overview?.total_amount).toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Inventory Alerts</p>
          <p className="text-2xl font-bold text-amber-600">{dashboard?.metrics?.inventory_alerts ?? 0}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <h4 className="mb-4 font-bold">Visit Trend</h4>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={visitTrends}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2} />
                <Line type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h4 className="mb-4 font-bold">Patient Distribution</h4>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={patientBreakdown} cx="50%" cy="50%" outerRadius={85} dataKey="value" nameKey="name" label>
                  {patientBreakdown.map((_: any, index: number) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <h4 className="mb-4 font-bold">Payment Trend</h4>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={paymentTrends}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="average" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h4 className="mb-4 font-bold">Payment Methods</h4>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={paymentMethods} cx="50%" cy="50%" outerRadius={85} dataKey="value" nameKey="name" label>
                  {paymentMethods.map((_: any, index: number) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="font-bold">Top Procedures</h4>
          <Badge variant="blue">{topProcedures.length} items</Badge>
        </div>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topProcedures}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="procedure_type" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="font-bold">Student Progress</h4>
            <Badge variant="success">{studentProgress.length} students</Badge>
          </div>
          <div className="space-y-3">
            {studentProgress.length === 0 && !loading && <p className="text-sm text-gray-500">No student case data available.</p>}
            {studentProgress.map((row: any) => (
              <div key={row.student_name} className="rounded-lg border border-gray-100 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <p className="font-medium text-gray-900">{row.student_name}</p>
                  <Badge variant="blue">{row.completion_rate}% complete</Badge>
                </div>
                <p className="text-xs text-gray-500">Verified {row.verified_cases} of {row.total_cases} cases</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="font-bold">Inventory Alerts</h4>
            <Badge variant="warning">{inventoryAlerts.length} flagged</Badge>
          </div>
          <div className="space-y-2">
            {inventoryAlerts.length === 0 && !loading && <p className="text-sm text-gray-500">No inventory alerts.</p>}
            {inventoryAlerts.slice(0, 12).map((row: any) => (
              <div key={row.id} className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                <div>
                  <p className="font-medium text-gray-900">{row.name}</p>
                  <p className="text-xs text-gray-500">{row.category} | Qty: {row.quantity} / Min: {row.minimum_threshold}</p>
                </div>
                <Badge variant={row.alert_level === 'OUT_OF_STOCK' ? 'error' : row.alert_level === 'CRITICAL' ? 'warning' : 'blue'}>
                  {row.alert_level}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading reports...</p>}
    </div>
  );
}
