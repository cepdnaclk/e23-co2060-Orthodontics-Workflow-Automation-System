import React, { useEffect, useMemo, useState } from 'react';
import { Card, Badge, Button, Input } from './UI';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { apiService } from '../services/api';
import { toast } from 'sonner';

type ToothStatus = 'HEALTHY' | 'PATHOLOGY' | 'PLANNED' | 'TREATED' | 'MISSING';
type ToothType = 'molar' | 'premolar' | 'canine' | 'incisor';

type DentalEntry = {
  tooth_number: number;
  status: ToothStatus;
  is_pathology: boolean;
  is_planned: boolean;
  is_treated: boolean;
  is_missing: boolean;
  pathology?: string | null;
  treatment?: string | null;
  event_date?: string | null;
  updated_by_name?: string;
};

type Props = {
  patientId: string;
  canEdit: boolean;
};

const CONDITION_COLORS = {
  pathology: { stroke: '#ef4444', fill: '#fee2e2' },
  planned: { stroke: '#2563eb', fill: '#dbeafe' },
  treated: { stroke: '#16a34a', fill: '#dcfce7' },
  missing: { stroke: '#94a3b8', fill: '#f1f5f9' },
  healthy: { stroke: '#cbd5e1', fill: '#ffffff' },
};

const getToothType = (num: number): ToothType => {
  if ([1, 2, 3, 14, 15, 16, 17, 18, 19, 30, 31, 32].includes(num)) return 'molar';
  if ([4, 5, 12, 13, 20, 21, 28, 29].includes(num)) return 'premolar';
  if ([6, 11, 22, 27].includes(num)) return 'canine';
  return 'incisor';
};

const resolveFlags = (row: any): DentalEntry => {
  const status = String(row.status || 'HEALTHY').toUpperCase() as ToothStatus;
  return {
    tooth_number: row.tooth_number,
    status,
    is_pathology: Boolean(row.is_pathology ?? status === 'PATHOLOGY'),
    is_planned: Boolean(row.is_planned ?? status === 'PLANNED'),
    is_treated: Boolean(row.is_treated ?? status === 'TREATED'),
    is_missing: Boolean(row.is_missing ?? status === 'MISSING'),
    pathology: row.pathology || null,
    treatment: row.treatment || null,
    event_date: row.event_date || null,
    updated_by_name: row.updated_by_name || undefined,
  };
};

const ToothSVG = ({ id, type, entry }: { id: string; type: ToothType; entry?: DentalEntry }) => {
  const getPath = () => {
    switch (type) {
      case 'molar':
        return 'M3 10 C3 6 7 4 12 4 C17 4 21 6 21 10 C21 14 19 16 19 22 C19 26 16 28 12 28 C8 28 5 26 5 22 C5 16 3 14 3 10 M7 10 C7 10 9 8 12 8 C15 8 17 10 17 10';
      case 'premolar':
        return 'M5 12 C5 8 8 6 12 6 C16 6 19 8 19 12 C19 16 17 18 17 24 C17 27 15 28 12 28 C9 28 7 27 7 24 C7 18 5 16 5 12 M8 12 C8 12 10 10 12 10 C14 10 16 12 16 12';
      case 'canine':
        return 'M6 14 C6 10 9 4 12 4 C15 4 18 10 18 14 C18 18 16 22 16 26 C16 28 14 29 12 29 C10 29 8 28 8 26 C8 22 6 18 6 14';
      default:
        return 'M6 6 L18 6 C18 6 18 16 17 22 C16 26 14 28 12 28 C10 28 8 26 7 22 C6 16 6 6 6 6';
    }
  };

  const colors = [];
  if (entry?.is_pathology) colors.push(CONDITION_COLORS.pathology);
  if (entry?.is_planned) colors.push(CONDITION_COLORS.planned);
  if (entry?.is_treated) colors.push(CONDITION_COLORS.treated);

  const isMissing = Boolean(entry?.is_missing);
  const hasConditions = colors.length > 0;
  const gradientId = `${id}-gradient`;
  const strokeGradientId = `${id}-stroke-gradient`;

  const fillColor = !hasConditions
    ? CONDITION_COLORS.healthy.fill
    : colors.length === 1
      ? colors[0].fill
      : `url(#${gradientId})`;
  const strokeColor = isMissing
    ? CONDITION_COLORS.missing.stroke
    : hasConditions
      ? colors.length === 1
        ? colors[0].stroke
        : `url(#${strokeGradientId})`
      : CONDITION_COLORS.healthy.stroke;

  return (
    <svg viewBox="0 0 24 30" className="w-9 h-11 md:w-10 md:h-12">
      {colors.length > 1 && (
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            {colors.map((c, i) => {
              const start = (i / colors.length) * 100;
              const end = ((i + 1) / colors.length) * 100;
              return (
                <React.Fragment key={`${gradientId}-${i}`}>
                  <stop offset={`${start}%`} stopColor={c.fill} />
                  <stop offset={`${end}%`} stopColor={c.fill} />
                </React.Fragment>
              );
            })}
          </linearGradient>
          <linearGradient id={strokeGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            {colors.map((c, i) => {
              const start = (i / colors.length) * 100;
              const end = ((i + 1) / colors.length) * 100;
              return (
                <React.Fragment key={`${strokeGradientId}-${i}`}>
                  <stop offset={`${start}%`} stopColor={c.stroke} />
                  <stop offset={`${end}%`} stopColor={c.stroke} />
                </React.Fragment>
              );
            })}
          </linearGradient>
        </defs>
      )}
      <path
        d={getPath()}
        fill={isMissing ? CONDITION_COLORS.missing.fill : fillColor}
        stroke={strokeColor}
        strokeWidth="1.8"
        strokeDasharray={isMissing ? '4 2' : '0'}
      />
    </svg>
  );
};

const deriveStatus = (f: { is_missing: boolean; is_pathology: boolean; is_planned: boolean; is_treated: boolean }): ToothStatus => {
  if (f.is_missing) return 'MISSING';
  if (f.is_pathology) return 'PATHOLOGY';
  if (f.is_planned) return 'PLANNED';
  if (f.is_treated) return 'TREATED';
  return 'HEALTHY';
};

export function DentalChart({ patientId, canEdit }: Props) {
  const [entries, setEntries] = useState<Record<number, DentalEntry>>({});
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    is_pathology: false,
    is_planned: false,
    is_treated: false,
    is_missing: false,
    pathology: '',
    treatment: '',
    event_date: '',
  });

  const loadChart = async () => {
    setLoading(true);
    try {
      const response = await apiService.patients.getDentalChart(patientId);
      const rows = response.data || [];
      const map: Record<number, DentalEntry> = {};
      for (const row of rows) {
        const normalized = resolveFlags(row);
        map[normalized.tooth_number] = normalized;
      }
      setEntries(map);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load dental chart');
      setEntries({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChart();
  }, [patientId]);

  useEffect(() => {
    if (!selectedTooth) return;
    const current = entries[selectedTooth];
    setForm({
      is_pathology: Boolean(current?.is_pathology),
      is_planned: Boolean(current?.is_planned),
      is_treated: Boolean(current?.is_treated),
      is_missing: Boolean(current?.is_missing),
      pathology: current?.pathology || '',
      treatment: current?.treatment || '',
      event_date: current?.event_date ? String(current.event_date).slice(0, 10) : '',
    });
  }, [selectedTooth, entries]);

  const saveTooth = async () => {
    if (!selectedTooth) return;
    setSaving(true);
    try {
      const status = deriveStatus(form);
      const hasAnyCondition = form.is_pathology || form.is_planned || form.is_treated || form.is_missing;
      const hasExtraData = Boolean(form.pathology || form.treatment || form.event_date);
      if (!hasAnyCondition && !hasExtraData) {
        await apiService.patients.deleteDentalChartTooth(patientId, selectedTooth);
      } else {
        await apiService.patients.upsertDentalChartTooth(patientId, selectedTooth, {
          status,
          is_pathology: form.is_pathology,
          is_planned: form.is_planned,
          is_treated: form.is_treated,
          is_missing: form.is_missing,
          pathology: form.pathology || undefined,
          treatment: form.treatment || undefined,
          event_date: form.event_date || undefined,
        });
      }
      await loadChart();
      toast.success('Dental chart updated');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save tooth entry');
    } finally {
      setSaving(false);
    }
  };

  const stats = useMemo(() => {
    const values = Object.values(entries);
    return {
      pathologies: values.filter((v) => v.is_pathology).length,
      planned: values.filter((v) => v.is_planned).length,
      treated: values.filter((v) => v.is_treated).length,
      missing: values.filter((v) => v.is_missing).length,
      totalTeeth: 32 - values.filter((v) => v.is_missing).length,
    };
  }, [entries]);

  const upperTeeth = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
  const lowerTeeth = [32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17];

  const Tooth = ({ n }: { n: number }) => {
    const entry = entries[n];
    const active = selectedTooth === n;
    const dotColor = entry?.is_missing
      ? CONDITION_COLORS.missing.stroke
      : entry?.is_pathology
        ? CONDITION_COLORS.pathology.stroke
        : entry?.is_planned
          ? CONDITION_COLORS.planned.stroke
          : entry?.is_treated
            ? CONDITION_COLORS.treated.stroke
            : 'transparent';

    return (
      <button
        onClick={() => setSelectedTooth(n)}
        className={`relative flex flex-col items-center p-1 rounded-lg transition-all ${active ? 'bg-blue-50 scale-[1.03]' : 'hover:bg-gray-50'}`}
      >
        <span className={`text-[9px] font-bold mb-1 ${active ? 'text-blue-600' : 'text-slate-400'}`}>{n}</span>
        <ToothSVG id={`tooth-${n}`} type={getToothType(n)} entry={entry} />
        {dotColor !== 'transparent' && (
          <span className="absolute top-4 right-1.5 w-2.5 h-2.5 rounded-full border-2 border-white" style={{ backgroundColor: dotColor }} />
        )}
      </button>
    );
  };

  const selected = selectedTooth ? entries[selectedTooth] : null;
  const selectedConditions = [
    form.is_pathology ? 'PATHOLOGY' : null,
    form.is_planned ? 'PLANNED' : null,
    form.is_treated ? 'TREATED' : null,
    form.is_missing ? 'MISSING' : null,
  ].filter(Boolean) as string[];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <Card className="lg:col-span-3 p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h4 className="text-2xl font-bold text-slate-900">Clinical Dental Chart</h4>
            <p className="text-sm text-slate-500">Universal Numbering System (1-32)</p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm font-semibold text-slate-600">
            <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full border-2 border-red-500 bg-red-100" />Pathology</div>
            <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full border-2 border-blue-500 bg-blue-100" />Planned</div>
            <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full border-2 border-green-500 bg-green-100" />Treated</div>
            <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full border-2 border-dashed border-slate-400 bg-slate-100" />Missing</div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50/60 p-6 md:p-8">
          {loading && <p className="text-xs text-gray-500 mb-3">Loading dental chart...</p>}
          <div className="space-y-14 overflow-x-auto pb-2">
            <div className="flex justify-center gap-0.5 md:gap-1 min-w-max">
              {upperTeeth.map((n) => <Tooth key={n} n={n} />)}
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-dashed border-slate-300" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-slate-50 px-4 text-[10px] font-black text-slate-400 tracking-[0.25em]">OCCLUSAL PLANE</span>
              </div>
            </div>
            <div className="flex justify-center gap-0.5 md:gap-1 min-w-max">
              {lowerTeeth.map((n) => <Tooth key={n} n={n} />)}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="p-4 border border-slate-200 rounded-2xl bg-white">
            <p className="text-xs font-bold text-slate-400 uppercase">Total Teeth</p>
            <p className="text-4xl font-black text-slate-900 leading-tight">{stats.totalTeeth} <span className="text-2xl text-slate-400">/ 32</span></p>
          </div>
          <div className="p-4 border border-slate-200 rounded-2xl bg-white">
            <p className="text-xs font-bold text-red-400 uppercase">Pathologies</p>
            <p className="text-4xl font-black text-red-600 leading-tight">{stats.pathologies}</p>
          </div>
          <div className="p-4 border border-slate-200 rounded-2xl bg-white">
            <p className="text-xs font-bold text-blue-400 uppercase">Planned</p>
            <p className="text-4xl font-black text-blue-600 leading-tight">{stats.planned}</p>
          </div>
          <div className="p-4 border border-slate-200 rounded-2xl bg-white">
            <p className="text-xs font-bold text-green-400 uppercase">Treated</p>
            <p className="text-4xl font-black text-green-600 leading-tight">{stats.treated}</p>
          </div>
          <div className="p-4 border border-slate-200 rounded-2xl bg-white">
            <p className="text-xs font-bold text-slate-400 uppercase">Missing</p>
            <p className="text-4xl font-black text-slate-600 leading-tight">{stats.missing}</p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        {!selectedTooth && (
          <div className="text-center text-gray-500 py-12">
            <Info className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            Select a tooth to view or edit details.
          </div>
        )}

        {selectedTooth && (
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-bold text-gray-900 text-2xl leading-tight">Tooth #{selectedTooth}</h4>
              <div className="min-h-7">
                {selectedConditions.length > 0 ? (
                  <Badge variant="blue" className="whitespace-normal break-words leading-tight">
                    {selectedConditions.join(' + ')}
                  </Badge>
                ) : (
                  <Badge variant="neutral">HEALTHY</Badge>
                )}
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-3 rounded-md px-1 py-1">
                <input
                  type="checkbox"
                  checked={form.is_pathology}
                  disabled={!canEdit}
                  onChange={(e) => setForm((s) => ({ ...s, is_pathology: e.target.checked }))}
                />
                <span className="font-medium">Pathology</span>
              </label>
              <label className="flex items-center gap-3 rounded-md px-1 py-1">
                <input
                  type="checkbox"
                  checked={form.is_planned}
                  disabled={!canEdit}
                  onChange={(e) => setForm((s) => ({ ...s, is_planned: e.target.checked }))}
                />
                <span className="font-medium">Planned</span>
              </label>
              <label className="flex items-center gap-3 rounded-md px-1 py-1">
                <input
                  type="checkbox"
                  checked={form.is_treated}
                  disabled={!canEdit}
                  onChange={(e) => setForm((s) => ({ ...s, is_treated: e.target.checked }))}
                />
                <span className="font-medium">Treated</span>
              </label>
              <label className="flex items-center gap-3 rounded-md px-1 py-1">
                <input
                  type="checkbox"
                  checked={form.is_missing}
                  disabled={!canEdit}
                  onChange={(e) => setForm((s) => ({ ...s, is_missing: e.target.checked }))}
                />
                <span className="font-medium">Missing</span>
              </label>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500">Pathology</label>
              <Input value={form.pathology} onChange={(e) => setForm((s) => ({ ...s, pathology: e.target.value }))} disabled={!canEdit} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">Treatment</label>
              <Input value={form.treatment} onChange={(e) => setForm((s) => ({ ...s, treatment: e.target.value }))} disabled={!canEdit} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">Date</label>
              <Input type="date" value={form.event_date} onChange={(e) => setForm((s) => ({ ...s, event_date: e.target.value }))} disabled={!canEdit} />
            </div>

            <div className="pt-2">
              {canEdit ? (
                <Button className="w-full" onClick={saveTooth} disabled={saving}>{saving ? 'Saving...' : 'Save Tooth Entry'}</Button>
              ) : (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-3 flex gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  You can view chart entries but do not have permission to edit.
                </div>
              )}
            </div>

            {selected && !canEdit && (
              <div className="text-xs text-gray-500 flex items-center gap-2">
                <CheckCircle2 className="w-3 h-3 text-green-600" />
                Last updated by {selected.updated_by_name || 'system'}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
