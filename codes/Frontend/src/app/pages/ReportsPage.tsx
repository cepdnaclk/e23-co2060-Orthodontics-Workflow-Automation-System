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
  LineChart,
  Line,
} from 'recharts';
import { apiService } from '../services/api';

const COLORS = ['#2563eb', '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const PATIENT_STATUS_ORDER = ['ACTIVE', 'CONSULTATION', 'MAINTENANCE', 'COMPLETED', 'INACTIVE'];

const toDateTimeString = (date: Date) => date.toISOString().slice(0, 19).replace('T', ' ');

const getDateRange = (period: '24h' | '7d' | '30d' | '3m' | '6m' | '12m') => {
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
    end_date: toDateTimeString(end)
  };
};

export function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patient, setPatient] = useState<any>(null);
  const [visits, setVisits] = useState<any>(null);
  const [inventory, setInventory] = useState<any>(null);
  const [period, setPeriod] = useState<'24h' | '7d' | '30d' | '3m' | '6m' | '12m'>('30d');
  const [alertType, setAlertType] = useState<'all' | 'critical' | 'low_stock' | 'out_of_stock'>('all');

  const loadReports = async () => {
    const dateRange = getDateRange(period);
    const visitGroupBy = period === '24h' || period === '7d' ? 'day' : period === '30d' ? 'week' : 'month';
    setLoading(true);
    setError(null);
    const [p, v, i] = await Promise.allSettled([
      apiService.reports.patientStatus({ group_by: 'status', ...dateRange }),
      apiService.reports.visitSummary({ group_by: visitGroupBy, ...dateRange }),
      apiService.reports.inventoryAlerts(alertType)
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
        value: Number(r.patient_count || 0)
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
      percentage: totalPatients > 0 ? ((r.value / totalPatients) * 100).toFixed(1) : '0.0'
    }));
  }, [patient]);

  const visitTrends = useMemo(
    () =>
      (visits?.trends || [])
        .map((r: any) => ({
          name: String(r.group_key),
          total: Number(r.total_visits || 0),
          completed: Number(r.completed_visits || 0)
        }))
        .reverse(),
    [visits]
  );

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
          completion_rate: count > 0 ? Number(((completed / count) * 100).toFixed(1)) : 0
        };
      }),
    [visits]
  );

  const inventoryAlerts = inventory?.alerts || [];
  const inventoryOverview = inventory?.overview || {};
  const totalInventoryAlerts = Number(inventoryOverview.out_of_stock_count || 0) + Number(inventoryOverview.low_stock_count || 0);

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
            onChange={(e) => setPeriod(e.target.value as '24h' | '7d' | '30d' | '3m' | '6m' | '12m')}
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
          <p className="text-2xl font-bold text-green-600">{visitTrends.reduce((s, v) => s + v.total, 0)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Inventory Alerts</p>
          <p className="text-2xl font-bold text-amber-600">{totalInventoryAlerts}</p>
          <p className="text-xs text-gray-500 mt-1">Critical: {inventoryOverview.critical_count ?? 0}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <h4 className="font-bold mb-4">Visit Trend</h4>
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
          <h4 className="font-bold mb-4">Patient Status Distribution</h4>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={patientBreakdown} cx="50%" cy="50%" outerRadius={85} dataKey="value" nameKey="label" label>
                  {patientBreakdown.map((_: any, idx: number) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1">
            {patientBreakdown.map((status: any) => (
              <div key={status.name} className="flex justify-between text-xs text-gray-600">
                <span>{status.label}</span>
                <span>{status.value} ({status.percentage}%)</span>
              </div>
            ))}
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
              <Tooltip />
              <Legend />
              <Bar dataKey="completed_count" stackId="visits" fill="#10b981" radius={[4, 4, 0, 0]} name="Completed" />
              <Bar dataKey="pending_count" stackId="visits" fill="#6366f1" radius={[4, 4, 0, 0]} name="Other statuses" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 space-y-1">
          {procedureBreakdown.slice(0, 5).map((procedure: any) => (
            <div key={procedure.procedure_type} className="flex justify-between text-xs text-gray-600">
              <span>{procedure.procedure_type}</span>
              <span>{procedure.completion_rate}% completed</span>
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
                <p className="text-xs text-gray-500">{a.category} • Qty: {a.quantity} / Min: {a.minimum_threshold}</p>
              </div>
              <Badge variant={a.alert_level === 'OUT_OF_STOCK' ? 'error' : a.alert_level === 'CRITICAL' ? 'warning' : 'blue'}>{a.alert_level}</Badge>
            </div>
          ))}
        </div>
      </Card>

      {loading && <p className="text-sm text-gray-500">Loading reports...</p>}
    </div>
  );
}
