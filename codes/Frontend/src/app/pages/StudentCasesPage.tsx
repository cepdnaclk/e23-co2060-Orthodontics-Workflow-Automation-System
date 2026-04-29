import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Badge, Button, Card, Input, RefreshButton, cn } from '../components/UI';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api';
import { toast } from 'sonner';

type CaseStatus = 'ASSIGNED' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED';
type TaskStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'REVIEWED';

type CaseListRow = {
  id: number;
  patient_id: number;
  patient_code: string;
  patient_name: string;
  student_id: number;
  student_name: string;
  supervisor_id: number;
  supervisor_name: string;
  status: CaseStatus;
  progress_percentage: number;
  total_tasks: number;
  completed_tasks: number;
  reviewed_tasks: number;
  pending_tasks: number;
  overdue_tasks: number;
  updated_at: string;
  last_task_update_at?: string | null;
};

type CaseTask = {
  id: number;
  title: string;
  description?: string | null;
  deadline_at?: string | null;
  status: TaskStatus;
  completion_notes?: string | null;
  completed_at?: string | null;
  review_notes?: string | null;
  reviewed_at?: string | null;
  reviewed_by_name?: string | null;
  is_overdue?: boolean;
};

type CaseLogEntry = {
  id: number;
  actor_name: string;
  actor_role: string;
  title: string;
  entry_text?: string | null;
  evaluation?: string | null;
  created_at: string;
};

type CaseDetailResponse = {
  case: CaseListRow;
  tasks: CaseTask[];
  logbook: CaseLogEntry[];
};

type TaskUpdateDraft = {
  status: '' | TaskStatus;
  completion_notes: string;
};

type TaskReviewDraft = {
  status: '' | TaskStatus;
  review_notes: string;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
};

const caseVariant = (status: CaseStatus) => {
  if (status === 'VERIFIED') return 'success';
  if (status === 'PENDING_VERIFICATION') return 'warning';
  if (status === 'REJECTED') return 'error';
  return 'blue';
};

const taskVariant = (status: TaskStatus, overdue?: boolean) => {
  if (overdue) return 'error';
  if (status === 'REVIEWED') return 'success';
  if (status === 'COMPLETED') return 'blue';
  if (status === 'IN_PROGRESS') return 'warning';
  return 'neutral';
};

export function StudentCasesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState<CaseListRow[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [detail, setDetail] = useState<CaseDetailResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [savingReview, setSavingReview] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    deadline_at: ''
  });
  const [taskUpdates, setTaskUpdates] = useState<Record<number, TaskUpdateDraft>>({});
  const [taskReviews, setTaskReviews] = useState<Record<number, TaskReviewDraft>>({});

  const isStudent = user?.role === 'STUDENT';
  const isSupervisor = user?.role === 'ORTHODONTIST';
  const isAdmin = user?.role === 'ADMIN';

  const loadCases = async () => {
    setLoadingList(true);
    setError(null);
    try {
      const [listRes, statsRes] = await Promise.all([
        apiService.cases.getList({
          page: 1,
          limit: 100,
          status: statusFilter || undefined,
          search: search.trim() || undefined
        }),
        apiService.cases.getStats()
      ]);

      const nextRows = listRes.data?.cases || [];
      setRows(nextRows);
      setStats(statsRes.data?.overview || null);
      setSelectedCaseId((current) => {
        if (current && nextRows.some((row: CaseListRow) => row.id === current)) return current;
        return nextRows[0]?.id ?? null;
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to load student cases');
      setRows([]);
      setStats(null);
      setSelectedCaseId(null);
    } finally {
      setLoadingList(false);
    }
  };

  const loadCaseDetail = async (caseId: number) => {
    setLoadingDetail(true);
    try {
      const response = await apiService.cases.getById(String(caseId));
      const payload = response.data || null;
      setDetail(payload);

      const nextUpdates: Record<number, TaskUpdateDraft> = {};
      const nextReviews: Record<number, TaskReviewDraft> = {};
      for (const task of payload?.tasks || []) {
        nextUpdates[task.id] = {
          status: '',
          completion_notes: ''
        };
        nextReviews[task.id] = {
          status: '',
          review_notes: ''
        };
      }
      setTaskUpdates(nextUpdates);
      setTaskReviews(nextReviews);
    } catch (err: any) {
      setDetail(null);
      toast.error(err?.message || 'Failed to load case details');
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadCases();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search, statusFilter]);

  useEffect(() => {
    if (!selectedCaseId) {
      setDetail(null);
      return;
    }
    loadCaseDetail(selectedCaseId);
  }, [selectedCaseId]);

  const selectedCase = detail?.case || rows.find((row) => row.id === selectedCaseId) || null;
  const tasks = detail?.tasks || [];
  const activeTasks = tasks.filter((task) => task.status !== 'REVIEWED');
  const reviewedTasks = tasks.filter((task) => task.status === 'REVIEWED');

  const statsCards = useMemo(() => ([
    { label: 'Cases', value: stats?.total_cases ?? 0, tone: 'text-slate-900' },
    { label: 'Assigned Tasks', value: stats?.total_tasks ?? 0, tone: 'text-blue-600' },
    { label: 'Completed Tasks', value: stats?.completed_tasks ?? 0, tone: 'text-emerald-600' },
    { label: 'Pending Tasks', value: stats?.pending_tasks ?? 0, tone: 'text-amber-600' },
    { label: 'Overdue Tasks', value: stats?.overdue_tasks ?? 0, tone: 'text-red-600' }
  ]), [stats]);

  const assignTask = async () => {
    if (!selectedCase) return;
    if (!taskForm.title.trim()) {
      toast.error('Task title is required');
      return;
    }

    setSavingAssignment(true);
    try {
      await apiService.cases.assignTask(String(selectedCase.id), {
        title: taskForm.title.trim(),
        description: taskForm.description.trim() || undefined,
        deadline_at: taskForm.deadline_at || undefined
      });
      toast.success('Task assigned to student');
      setTaskForm({ title: '', description: '', deadline_at: '' });
      await loadCases();
      await loadCaseDetail(selectedCase.id);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to assign task');
    } finally {
      setSavingAssignment(false);
    }
  };

  const updateTask = async (taskId: number) => {
    if (!selectedCase) return;
    const form = taskUpdates[taskId];
    if (!form) return;
    if (!form.status) {
      toast.error('Select the current task progress before saving');
      return;
    }

    setSavingTask(true);
    try {
      await apiService.cases.updateTask(String(selectedCase.id), String(taskId), form);
      toast.success('Task progress updated');
      setTaskUpdates((prev) => ({
        ...prev,
        [taskId]: { status: '', completion_notes: '' }
      }));
      await loadCases();
      await loadCaseDetail(selectedCase.id);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update task');
    } finally {
      setSavingTask(false);
    }
  };

  const reviewTask = async (taskId: number) => {
    if (!selectedCase) return;
    const form = taskReviews[taskId];
    if (!form) return;
    if (!form.status && !form.review_notes.trim()) {
      toast.error('Select a review result or enter review notes before saving');
      return;
    }

    setSavingReview(true);
    try {
      const payload: { status?: string; review_notes?: string } = {};
      if (form.status) payload.status = form.status;
      if (form.review_notes.trim()) payload.review_notes = form.review_notes.trim();

      await apiService.cases.reviewTask(String(selectedCase.id), String(taskId), payload);
      toast.success('Task review recorded');
      setTaskReviews((prev) => ({
        ...prev,
        [taskId]: { status: '', review_notes: '' }
      }));
      await loadCases();
      await loadCaseDetail(selectedCase.id);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to review task');
    } finally {
      setSavingReview(false);
    }
  };

  const deleteTask = async (taskId: number, title: string) => {
    if (!selectedCase) return;
    if (!window.confirm(`Delete the task "${title}"? This keeps a logbook entry but removes the task from the active list.`)) {
      return;
    }

    setSavingAssignment(true);
    try {
      await apiService.cases.deleteTask(String(selectedCase.id), String(taskId));
      toast.success('Task deleted');
      await loadCases();
      await loadCaseDetail(selectedCase.id);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete task');
    } finally {
      setSavingAssignment(false);
    }
  };

  const deleteCase = async (caseRow: CaseListRow) => {
    if (!window.confirm(`Remove ${caseRow.patient_name} from Accessible Cases? This removes the case from the supervisor and student task bars.`)) {
      return;
    }

    setSavingAssignment(true);
    try {
      await apiService.cases.deleteCase(String(caseRow.id));
      toast.success('Case removed from Accessible Cases');
      await loadCases();
      if (selectedCaseId === caseRow.id) {
        setDetail(null);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to remove case');
    } finally {
      setSavingAssignment(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Student Case Management</h2>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Search patient or student"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64"
          />
          <select
            className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All case statuses</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="PENDING_VERIFICATION">Pending Verification</option>
            <option value="VERIFIED">Verified</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <RefreshButton onClick={loadCases} loading={loadingList} />
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        {statsCards.map((item) => (
          <Card key={item.label} className="p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{item.label}</p>
            <p className={cn('mt-2 text-2xl font-bold', item.tone)}>{item.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <div className="border-b border-gray-100 px-4 py-3">
            <h3 className="font-semibold text-slate-900">Accessible Cases</h3>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {loadingList && <div className="p-4 text-sm text-slate-500">Loading cases...</div>}
            {!loadingList && rows.length === 0 && <div className="p-4 text-sm text-slate-500">No student cases found.</div>}
            {rows.map((row) => (
              <div
                key={row.id}
                className={cn(
                  'border-b border-gray-100 px-4 py-4 transition-colors hover:bg-slate-50',
                  selectedCaseId === row.id && 'bg-blue-50'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedCaseId(row.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="font-semibold text-slate-900">{row.patient_name}</p>
                    <p className="text-xs text-slate-500">{row.patient_code} • Student: {row.student_name}</p>
                  </button>
                  <div className="flex items-center gap-2">
                    <Badge variant={caseVariant(row.status)}>{row.status}</Badge>
                    {isSupervisor && (
                      <Button
                        variant="danger"
                        onClick={() => deleteCase(row)}
                        disabled={savingAssignment}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <span>Tasks: {row.total_tasks}</span>
                  <span>Done: {row.completed_tasks}</span>
                  <span>Reviewed: {row.reviewed_tasks}</span>
                  <span>Overdue: {row.overdue_tasks}</span>
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                    <span>Task progress</span>
                    <span>{row.progress_percentage || 0}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-blue-600 transition-all"
                      style={{ width: `${Math.max(0, Math.min(100, row.progress_percentage || 0))}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          {!selectedCase && (
            <Card className="p-6 text-sm text-slate-500">
              Select a case to view assigned tasks, deadlines, student completion state, and supervisor review.
            </Card>
          )}

          {selectedCase && (
            <>
              <Card className="p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-slate-900">{selectedCase.patient_name}</h3>
                      <Badge variant={caseVariant(selectedCase.status)}>{selectedCase.status}</Badge>
                    </div>
                    <p className="text-sm text-slate-500">
                      {selectedCase.patient_code} • Student: {selectedCase.student_name} • Supervisor: {selectedCase.supervisor_name}
                    </p>
                  </div>
                  <Button variant="secondary" onClick={() => navigate(`/patients/${selectedCase.patient_id}`)}>
                    Open Patient
                  </Button>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
                  <MetricCard label="Assigned Tasks" value={selectedCase.total_tasks} />
                  <MetricCard label="Completed" value={selectedCase.completed_tasks} tone="text-emerald-600" />
                  <MetricCard label="Pending" value={selectedCase.pending_tasks} tone="text-amber-600" />
                  <MetricCard label="Overdue" value={selectedCase.overdue_tasks} tone="text-red-600" />
                </div>

                {loadingDetail && <p className="mt-4 text-sm text-slate-500">Loading task workspace...</p>}
              </Card>

              {isSupervisor && (
                <Card className="p-6">
                  <h4 className="text-lg font-semibold text-slate-900">Assign New Task</h4>
                  <div className="mt-5 space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Task title</label>
                      <Input value={taskForm.title} onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</label>
                      <textarea
                        value={taskForm.description}
                        onChange={(e) => setTaskForm((prev) => ({ ...prev, description: e.target.value }))}
                        className="min-h-28 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Example: Record the patient's medical history and confirm any drug allergies."
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Deadline</label>
                      <Input
                        type="datetime-local"
                        value={taskForm.deadline_at}
                        onChange={(e) => setTaskForm((prev) => ({ ...prev, deadline_at: e.target.value }))}
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={assignTask} disabled={savingAssignment}>
                        {savingAssignment ? 'Assigning...' : 'Assign Task'}
                      </Button>
                    </div>
                  </div>
                </Card>
              )}

              <Card className="p-6">
                <h4 className="text-lg font-semibold text-slate-900">Task Progress</h4>
                <div className="mt-5 space-y-4">
                  {activeTasks.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                      No active tasks.
                    </div>
                  )}
                  {activeTasks.map((task) => (
                    <div key={task.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-slate-900">{task.title}</p>
                            <Badge variant={taskVariant(task.status, task.is_overdue) as any}>
                              {task.is_overdue ? 'OVERDUE' : task.status}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-slate-600">{task.description || 'No description provided.'}</p>
                          <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
                            <span>Deadline: {formatDateTime(task.deadline_at)}</span>
                            <span>Completed: {formatDateTime(task.completed_at)}</span>
                            <span>Reviewed: {formatDateTime(task.reviewed_at)}</span>
                          </div>
                        </div>
                        {isSupervisor && (
                          <div className="flex justify-end">
                            <Button
                              variant="danger"
                              onClick={() => deleteTask(task.id, task.title)}
                              disabled={savingAssignment}
                            >
                              Delete Task
                            </Button>
                          </div>
                        )}
                      </div>

                      {task.completion_notes && (
                        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Student notes</p>
                          <p className="mt-1 whitespace-pre-wrap">{task.completion_notes}</p>
                        </div>
                      )}

                      {task.review_notes && (
                        <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-slate-700">
                          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Supervisor review</p>
                          <p className="mt-1 whitespace-pre-wrap">{task.review_notes}</p>
                          <p className="mt-1 text-xs text-emerald-700">Reviewed by {task.reviewed_by_name || 'Supervisor'}</p>
                        </div>
                      )}

                      {isStudent && (
                        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
                          <p className="text-sm font-semibold text-slate-900">Update your task progress</p>
                          <div className="mt-3 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_auto]">
                            <select
                              className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm"
                              value={taskUpdates[task.id]?.status || ''}
                              onChange={(e) => setTaskUpdates((prev) => ({
                                ...prev,
                                [task.id]: {
                                  ...(prev[task.id] || { completion_notes: '' }),
                                  status: e.target.value as '' | TaskStatus
                                }
                              }))}
                            >
                              <option value="">Select progress</option>
                              <option value="ASSIGNED">Assigned</option>
                              <option value="IN_PROGRESS">In Progress</option>
                              <option value="COMPLETED">Completed</option>
                            </select>
                            <textarea
                              value={taskUpdates[task.id]?.completion_notes || ''}
                              onChange={(e) => setTaskUpdates((prev) => ({
                                ...prev,
                                [task.id]: {
                                  status: prev[task.id]?.status || '',
                                  completion_notes: e.target.value
                                }
                              }))}
                              className="min-h-24 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Explain what was completed for this task."
                            />
                            <div className="flex items-end">
                              <Button onClick={() => updateTask(task.id)} disabled={savingTask}>
                                {savingTask ? 'Saving...' : 'Update Task'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      {isSupervisor && (
                        <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
                          <p className="text-sm font-semibold text-slate-900">Supervisor review</p>
                          <div className="mt-3 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_auto]">
                            <select
                              className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm"
                              value={taskReviews[task.id]?.status || ''}
                              onChange={(e) => setTaskReviews((prev) => ({
                                ...prev,
                                [task.id]: {
                                  ...(prev[task.id] || { review_notes: '' }),
                                  status: e.target.value as '' | TaskStatus
                                }
                              }))}
                            >
                              <option value="">Select review result</option>
                              <option value="IN_PROGRESS">Needs More Work</option>
                              <option value="COMPLETED">Completed</option>
                              <option value="REVIEWED">Reviewed / Accepted</option>
                            </select>
                            <textarea
                              value={taskReviews[task.id]?.review_notes || ''}
                              onChange={(e) => setTaskReviews((prev) => ({
                                ...prev,
                                [task.id]: {
                                  status: prev[task.id]?.status || '',
                                  review_notes: e.target.value
                                }
                              }))}
                              className="min-h-24 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Review the student’s work on this task."
                            />
                            <div className="flex items-end">
                              <Button onClick={() => reviewTask(task.id)} disabled={savingReview}>
                                {savingReview ? 'Saving...' : 'Save Review'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>

              {reviewedTasks.length > 0 && (
                <Card className="p-6">
                  <h4 className="text-lg font-semibold text-slate-900">Reviewed Tasks</h4>
                  <p className="mt-1 text-sm text-slate-500">
                    Accepted tasks are kept here as part of the case record after they leave the active student and supervisor task bars.
                  </p>
                  <div className="mt-5 space-y-4">
                    {reviewedTasks.map((task) => (
                      <div key={task.id} className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-slate-900">{task.title}</p>
                          <Badge variant="success">REVIEWED</Badge>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">{task.description || 'No description provided.'}</p>
                        <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
                          <span>Deadline: {formatDateTime(task.deadline_at)}</span>
                          <span>Completed: {formatDateTime(task.completed_at)}</span>
                          <span>Reviewed: {formatDateTime(task.reviewed_at)}</span>
                        </div>
                        {task.completion_notes && (
                          <div className="mt-3 rounded-lg bg-white/80 p-3 text-sm text-slate-700">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Student notes</p>
                            <p className="mt-1 whitespace-pre-wrap">{task.completion_notes}</p>
                          </div>
                        )}
                        {task.review_notes && (
                          <div className="mt-3 rounded-lg bg-white/80 p-3 text-sm text-slate-700">
                            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Supervisor review</p>
                            <p className="mt-1 whitespace-pre-wrap">{task.review_notes}</p>
                            <p className="mt-1 text-xs text-emerald-700">Reviewed by {task.reviewed_by_name || 'Supervisor'}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <Card className="p-6">
                <h4 className="text-lg font-semibold text-slate-900">Chronological Logbook</h4>
                <div className="mt-5 space-y-4">
                  {detail?.logbook?.length ? detail.logbook.map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">{entry.title}</p>
                          <p className="text-xs text-slate-500">
                            {entry.actor_name} • {entry.actor_role.replace(/_/g, ' ')}
                          </p>
                        </div>
                        <p className="text-xs text-slate-500">{formatDateTime(entry.created_at)}</p>
                      </div>
                      {entry.entry_text && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{entry.entry_text}</p>}
                      {entry.evaluation && (
                        <p className="mt-3 text-xs font-medium text-slate-500">Result: {entry.evaluation}</p>
                      )}
                    </div>
                  )) : (
                    <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                      No logbook entries yet.
                    </div>
                  )}
                </div>
              </Card>

              {isAdmin && (
                <Card className="p-5 text-sm text-slate-600">
                  Admin access is read-only for student task progress and supervisor review.
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, tone = 'text-slate-900' }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn('mt-2 text-3xl font-black', tone)}>{value}</p>
    </div>
  );
}
