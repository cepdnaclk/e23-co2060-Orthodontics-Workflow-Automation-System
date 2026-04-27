import React, { useEffect, useMemo, useState } from 'react';
import { Card, Badge, Button, Input, RefreshButton, Table, cn } from '../components/UI';
import { Clock, Plus, Search, Trash2, X } from 'lucide-react';
import { apiService } from '../services/api';
import { useAuth } from '../context/AuthContext';

const QUEUE_STATUSES = ['IN_WAITING_ROOM', 'UNDER_TREATMENT', 'UNDER_CONSULTATION', 'COMPLETED'] as const;

type QueueStatus = typeof QUEUE_STATUSES[number];

type QueueItem = {
  id: number;
  patient_id: number;
  patient_name: string;
  patient_code: string;
  priority?: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
  status: QueueStatus;
  arrival_time: string;
  wait_time_minutes?: number;
  assigned_clinical_staff?: string | null;
};

type PatientOption = {
  id: number;
  patient_code: string;
  first_name: string;
  last_name: string;
};

const STATUS_META: Record<QueueStatus, {
  label: string;
  shortLabel: string;
  text: string;
  badge: string;
}> = {
  IN_WAITING_ROOM: {
    label: 'In waiting room',
    shortLabel: 'In waiting room',
    text: 'text-amber-600',
    badge: 'border-amber-200 bg-amber-50 text-amber-700'
  },
  UNDER_CONSULTATION: {
    label: 'Under consultation',
    shortLabel: 'Under consultation',
    text: 'text-sky-600',
    badge: 'border-sky-200 bg-sky-50 text-sky-700'
  },
  UNDER_TREATMENT: {
    label: 'Under treatment',
    shortLabel: 'Under treatment',
    text: 'text-violet-600',
    badge: 'border-violet-200 bg-violet-50 text-violet-700'
  },
  COMPLETED: {
    label: 'Completed',
    shortLabel: 'Completed',
    text: 'text-emerald-600',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }
};

const QUEUE_ROLES = ['ADMIN', 'NURSE', 'RECEPTION', 'ORTHODONTIST', 'DENTAL_SURGEON', 'STUDENT'];
const QUEUE_MUTATION_ROLES = ['ADMIN', 'ORTHODONTIST', 'DENTAL_SURGEON', 'RECEPTION'];

export function ClinicQueuePage() {
  const { user } = useAuth();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [initialStatus, setInitialStatus] = useState<QueueStatus>('IN_WAITING_ROOM');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QueueItem | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const role = user?.role || '';
  const canViewQueue = QUEUE_ROLES.includes(role);
  const canMutateQueue = QUEUE_MUTATION_ROLES.includes(role);
  const canAddToQueue = canMutateQueue;
  const canDeleteQueue = role === 'RECEPTION';
  const canUpdateQueue = canMutateQueue;
  const isReadOnly = !canMutateQueue;

  const loadPatientOptions = async () => {
    if (!canAddToQueue) return;
    const patientRes = await apiService.patients.getList({
      page: 1,
      limit: 100,
      deleted: 'active',
      sort: 'id',
      order: 'DESC'
    });
    setPatients(patientRes?.data?.patients || []);
  };

  const loadQueue = async () => {
    if (!canViewQueue) return;
    setLoading(true);
    setError(null);
    try {
      const queueRes = await apiService.queue.getList();
      setItems(queueRes.data?.queue || []);
      setStats(queueRes.data?.statistics || null);
      await loadPatientOptions();
    } catch (err: any) {
      setError(err?.message || 'Failed to load clinic queue');
      setItems([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, [role]);

  const filteredPatients = useMemo(() => {
    const term = patientSearch.trim().toLowerCase();
    const sorted = [...patients].sort((a, b) => b.id - a.id);
    if (!term) return sorted.slice(0, 12);
    return sorted
      .filter((p) => {
        const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
        return fullName.includes(term) || String(p.patient_code || '').toLowerCase().includes(term);
      })
      .slice(0, 12);
  }, [patients, patientSearch]);

  const selectedPatient = useMemo(
    () => patients.find((p) => String(p.id) === selectedPatientId) || null,
    [patients, selectedPatientId]
  );

  const addToQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) {
      setError('Select a registered patient before adding to the queue');
      return;
    }

    setAdding(true);
    setError(null);
    try {
      await apiService.queue.addToQueue({
        patient_id: Number(selectedPatientId),
        status: initialStatus
      });
      setAddOpen(false);
      setPatientSearch('');
      setSelectedPatientId('');
      setInitialStatus('IN_WAITING_ROOM');
      await loadQueue();
    } catch (err: any) {
      setError(err?.message || 'Failed to add patient to queue');
    } finally {
      setAdding(false);
    }
  };

  const updateStatus = async (item: QueueItem, status: QueueStatus) => {
    if (item.status === status) return;
    setUpdatingId(item.id);
    setError(null);
    try {
      await apiService.queue.updateStatus(String(item.id), { status });
      await loadQueue();
    } catch (err: any) {
      setError(err?.message || 'Failed to update queue status');
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteQueueEntry = async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    setError(null);
    try {
      await apiService.queue.remove(String(deleteTarget.id));
      setDeleteTarget(null);
      await loadQueue();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete queue entry');
    } finally {
      setDeletingId(null);
    }
  };

  const statusBadge = (status: QueueStatus) => (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold', STATUS_META[status].badge)}>
      {STATUS_META[status].label}
    </span>
  );

  const statCards = [
    { label: 'Total in Queue', value: stats?.total_in_queue ?? 0, className: 'text-gray-900' },
    { label: 'In waiting room', value: stats?.waiting_count ?? 0, className: STATUS_META.IN_WAITING_ROOM.text },
    { label: 'Under treatment', value: stats?.under_treatment_count ?? 0, className: STATUS_META.UNDER_TREATMENT.text },
    { label: 'Under consultation', value: stats?.under_consultation_count ?? 0, className: STATUS_META.UNDER_CONSULTATION.text },
    { label: 'Completed', value: stats?.completed_count ?? 0, className: STATUS_META.COMPLETED.text },
  ];

  if (!canViewQueue) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        You do not have access to the live clinic queue.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Live Clinic Queue</h2>
          <p className="text-gray-500">
            {isReadOnly
              ? 'Read-only global clinic queue.'
              : 'Global clinic queue for registered patients.'}
          </p>
        </div>
        <div className="flex gap-2">
          <RefreshButton onClick={loadQueue} loading={loading} />
          {canAddToQueue && (
            <Button className="flex items-center gap-2" onClick={() => setAddOpen(true)}>
              <Plus className="w-4 h-4" />
              Add to Queue
            </Button>
          )}
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {statCards.map((card) => (
          <Card key={card.label} className="p-5">
            <p className="text-sm font-medium text-gray-500">{card.label}</p>
            <p className={cn('mt-2 text-3xl font-extrabold', card.className)}>{card.value}</p>
          </Card>
        ))}
      </div>

      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-6 py-4">
          <div>
            <h3 className="font-bold text-gray-900">Queue Entries</h3>
            <p className="text-xs text-gray-500">
              {items.length} {items.length === 1 ? 'patient' : 'patients'} visible in this queue view.
            </p>
          </div>
        </div>
        <Table tableClassName="w-full min-w-max text-sm text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-6 py-4 font-semibold text-gray-600 whitespace-nowrap">Patient</th>
              <th className="px-6 py-4 font-semibold text-gray-600 whitespace-nowrap">Status</th>
              <th className="px-6 py-4 font-semibold text-gray-600 whitespace-nowrap">Assigned Staff</th>
              <th className="px-6 py-4 font-semibold text-gray-600 whitespace-nowrap">Wait</th>
              <th className="px-6 py-4 font-semibold text-gray-600 whitespace-nowrap">Arrival</th>
              {!isReadOnly && <th className="px-6 py-4 font-semibold text-gray-600 text-center whitespace-nowrap">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {!loading && items.map((item) => (
              <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                <td className="px-6 py-4 align-middle whitespace-nowrap">
                  <p className="font-semibold text-gray-900">{item.patient_name}</p>
                  <p className="text-xs font-medium text-blue-600">MRN: {item.patient_code}</p>
                </td>
                <td className="px-6 py-4 align-middle whitespace-nowrap">{statusBadge(item.status)}</td>
                <td className="px-6 py-4 align-middle text-gray-600 whitespace-nowrap">
                  {item.assigned_clinical_staff || 'Unassigned'}
                </td>
                <td className="px-6 py-4 align-middle text-gray-600 whitespace-nowrap">
                  {item.wait_time_minutes ?? '-'} min
                </td>
                <td className="px-6 py-4 align-middle text-gray-600 whitespace-nowrap">
                  {String(item.arrival_time || '').slice(0, 16).replace('T', ' ')}
                </td>
                {!isReadOnly && (
                  <td className="px-6 py-4 align-middle text-center whitespace-nowrap">
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {canUpdateQueue && (
                        <select
                          className="h-9 min-w-[12rem] rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-800"
                          value={item.status}
                          onChange={(e) => updateStatus(item, e.target.value as QueueStatus)}
                          disabled={updatingId === item.id}
                        >
                          {QUEUE_STATUSES.map((status) => (
                            <option key={status} value={status}>{STATUS_META[status].label}</option>
                          ))}
                        </select>
                      )}
                      {canDeleteQueue && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setDeleteTarget(item)}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>

        {loading && <div className="p-8 text-sm text-gray-500 flex items-center gap-2"><Clock className="w-4 h-4" /> Loading queue...</div>}
        {!loading && items.length === 0 && <div className="p-8 text-sm text-gray-500">No queue entries found.</div>}
      </Card>

      {addOpen && canAddToQueue && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/45 backdrop-blur-[1px] p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 bg-blue-50 px-5 py-4">
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                Add Patient to Queue
              </h3>
              <Button
                variant="secondary"
                size="icon"
                className="h-9 w-9 border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                onClick={() => setAddOpen(false)}
                disabled={adding}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <form className="space-y-5 px-5 py-4" onSubmit={addToQueue}>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-600">Search Registered Patient</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    className="pl-9"
                    placeholder="Search by full name or MRN"
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                  />
                </div>
                <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-100">
                  {filteredPatients.length === 0 ? (
                    <div className="p-4 text-sm text-gray-400">No registered patients found.</div>
                  ) : filteredPatients.map((p) => {
                    const selected = selectedPatientId === String(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPatientId(String(p.id))}
                        className={cn(
                          'flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors',
                          selected ? 'bg-blue-50 text-blue-700' : 'bg-white text-gray-700 hover:bg-gray-50'
                        )}
                      >
                        <span className="font-semibold">{p.first_name} {p.last_name}</span>
                        <span className="text-xs">MRN: {p.patient_code}</span>
                      </button>
                    );
                  })}
                </div>
                {selectedPatient && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                    Selected: <strong>{selectedPatient.first_name} {selectedPatient.last_name}</strong> ({selectedPatient.patient_code})
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-600">Current Queue Status</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {QUEUE_STATUSES.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setInitialStatus(status)}
                      className={cn(
                        'rounded-lg border px-3 py-3 text-left text-sm font-semibold transition-all',
                        STATUS_META[status].badge,
                        initialStatus === status ? 'ring-2 ring-blue-500 ring-offset-1' : 'opacity-80 hover:opacity-100'
                      )}
                    >
                      {STATUS_META[status].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setAddOpen(false)} disabled={adding}>
                  Cancel
                </Button>
                <Button type="submit" disabled={adding || !selectedPatientId}>
                  {adding ? 'Adding...' : 'Add to Queue'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/45 backdrop-blur-[1px] p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="border-b border-red-100 bg-red-50 px-5 py-4">
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-600" />
                Delete Queue Entry
              </h3>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800">
                Remove <strong>{deleteTarget.patient_name}</strong> from the live clinic queue?
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deletingId !== null}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={deleteQueueEntry}
                  disabled={deletingId !== null}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  {deletingId !== null ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
