import React, { useEffect, useMemo, useState } from 'react';
import { Card, Table, Button, Input, Badge } from '../components/UI';
import { Search, Filter, UserPlus, Pencil, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { apiService } from '../services/api';
import { useAuth } from '../context/AuthContext';

type PatientRecord = {
  id: number;
  patient_code: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  age?: number;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  province?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  status: 'ACTIVE' | 'COMPLETED' | 'CONSULTATION' | 'MAINTENANCE' | 'INACTIVE';
  display_status?: 'ACTIVE' | 'COMPLETED' | 'CONSULTATION' | 'MAINTENANCE' | 'INACTIVE';
  is_inactive?: boolean;
  last_visit?: string | null;
  assigned_orthodontist_name?: string | null;
  assigned_surgeon_name?: string | null;
  assigned_student_name?: string | null;
};

type StaffMember = {
  id: number;
  name: string;
  email: string;
  role?: 'ORTHODONTIST' | 'DENTAL_SURGEON' | 'NURSE' | 'STUDENT';
};

type DirectoryFilters = {
  assignedOrthodontist: string;
  registrationDate: string;
};

const initialForm = {
  first_name: '',
  last_name: '',
  registration_date: '',
  date_of_birth: '',
  age: '',
  gender: 'FEMALE',
  phone: '',
  email: '',
  address: '',
  province: ''
};

const calculateAgeFromDob = (dobValue: string) => {
  if (!dobValue) return '';
  const dob = new Date(dobValue);
  if (Number.isNaN(dob.getTime())) return '';
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  if (age < 0) return '';
  return String(age);
};

export function PatientListPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [orthodontists, setOrthodontists] = useState<StaffMember[]>([]);
  const [assignableStaff, setAssignableStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [adminDeletedFilter, setAdminDeletedFilter] = useState<'active' | 'inactive'>('active');
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState<DirectoryFilters>({
    assignedOrthodontist: '',
    registrationDate: ''
  });
  const [draftFilters, setDraftFilters] = useState<DirectoryFilters>({
    assignedOrthodontist: '',
    registrationDate: ''
  });

  const [createForm, setCreateForm] = useState(initialForm);
  const [editForm, setEditForm] = useState(initialForm);
  const [createOrthodontistId, setCreateOrthodontistId] = useState('');
  const [assignRole, setAssignRole] = useState<'ORTHODONTIST' | 'DENTAL_SURGEON' | 'STUDENT'>('ORTHODONTIST');
  const [assignMemberId, setAssignMemberId] = useState('');

  const navigate = useNavigate();
  const { user } = useAuth();

  const canCreatePatients = user?.role === 'RECEPTION';
  const canManagePatientDirectory = ['RECEPTION', 'NURSE'].includes(user?.role || '');
  const canDeletePatients = user?.role === 'ADMIN';
  const canOrthoAssignCareTeam = user?.role === 'ORTHODONTIST';
  const canFilterByAssignedOrthodontist = ['ADMIN', 'RECEPTION', 'DENTAL_SURGEON', 'STUDENT', 'NURSE'].includes(user?.role || '');

  const loadPatients = async (
    search = '',
    deletedFilter = adminDeletedFilter,
    showLoader = true,
    filtersOverride?: DirectoryFilters
  ) => {
    if (showLoader) {
      setLoading(true);
      setError(null);
    }
    const filters = filtersOverride || activeFilters;
    try {
      const response = await apiService.patients.getList({
        page: 1,
        limit: 100,
        search: search || undefined,
        deleted: canDeletePatients ? deletedFilter : 'active',
        sort: 'id',
        order: 'DESC',
        assigned_orthodontist: canFilterByAssignedOrthodontist ? (filters.assignedOrthodontist || undefined) : undefined,
        registered_from: filters.registrationDate || undefined,
        registered_to: filters.registrationDate || undefined
      });
      const rows = response.data?.patients || response.data?.items || [];
      setPatients(rows);
    } catch (err: any) {
      if (showLoader) {
        setError(err?.message || 'Failed to load patients');
      }
      setPatients([]);
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  };

  const loadOrthodontists = async () => {
    if (!canFilterByAssignedOrthodontist) return;
    try {
      const response = await apiService.patients.getOrthodontists();
      const rows = response.data || [];
      setOrthodontists(rows);
    } catch {
      setOrthodontists([]);
    }
  };

  const loadAssignableStaff = async () => {
    if (!canOrthoAssignCareTeam) return;
    try {
      const response = await apiService.patients.getAssignableStaff(['DENTAL_SURGEON', 'STUDENT']);
      const rows = response.data || [];
      setAssignableStaff(rows);
    } catch {
      setAssignableStaff([]);
    }
  };

  useEffect(() => {
    loadPatients('', adminDeletedFilter);
    loadOrthodontists();
    loadAssignableStaff();
  }, [user?.role]);

  useEffect(() => {
    const refreshPatients = () => {
      if (document.visibilityState !== 'visible') return;
      if (createOpen || editOpen || assignOpen) return;
      loadPatients(searchTerm, adminDeletedFilter, false);
    };

    window.addEventListener('focus', refreshPatients);
    document.addEventListener('visibilitychange', refreshPatients);

    return () => {
      window.removeEventListener('focus', refreshPatients);
      document.removeEventListener('visibilitychange', refreshPatients);
    };
  }, [searchTerm, adminDeletedFilter, createOpen, editOpen, assignOpen, activeFilters]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'patients_updated_at') {
        loadPatients(searchTerm, adminDeletedFilter, false);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [searchTerm, adminDeletedFilter, activeFilters]);

  const applyFilters = async () => {
    setActiveFilters(draftFilters);
    await loadPatients(searchTerm, adminDeletedFilter, true, draftFilters);
    setShowFilters(false);
  };

  const resetFilters = async () => {
    const emptyFilters = {
      assignedOrthodontist: '',
      registrationDate: ''
    };
    setDraftFilters(emptyFilters);
    setActiveFilters(emptyFilters);
    await loadPatients(searchTerm, adminDeletedFilter, true, emptyFilters);
    setShowFilters(false);
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (canFilterByAssignedOrthodontist && activeFilters.assignedOrthodontist) count += 1;
    if (activeFilters.registrationDate) count += 1;
    return count;
  }, [activeFilters, canFilterByAssignedOrthodontist]);

  const getTodayDate = () => new Date().toISOString().slice(0, 10);

  const filteredPatients = useMemo(() => {
    if (!searchTerm.trim()) return patients;
    const q = searchTerm.toLowerCase();
    return patients.filter((p) =>
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
      p.patient_code.toLowerCase().includes(q)
    );
  }, [patients, searchTerm]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const createPayload = {
        first_name: createForm.first_name,
        last_name: createForm.last_name,
        registration_date: createForm.registration_date || undefined,
        date_of_birth: createForm.date_of_birth || undefined,
        age: createForm.age ? Number(createForm.age) : undefined,
        gender: createForm.gender,
        phone: createForm.phone || undefined,
        email: createForm.email || undefined,
        address: createForm.address || undefined,
        province: createForm.province || undefined
      };

      const created = await apiService.patients.create(createPayload);
      const patientId = created.data?.id;

      if (patientId && createOrthodontistId) {
        await apiService.patients.assign(String(patientId), {
          user_id: Number(createOrthodontistId),
          assignment_role: 'ORTHODONTIST'
        });
      }

      setCreateForm(initialForm);
      setCreateOrthodontistId('');
      setCreateOpen(false);
      await loadPatients(searchTerm);
    } catch (err: any) {
      setError(err?.message || 'Failed to create patient');
    } finally {
      setSaving(false);
    }
  };

  const openCreateModal = () => {
    setCreateForm({
      ...initialForm,
      registration_date: getTodayDate()
    });
    setCreateOpen(true);
  };

  const openEditModal = async (patientId: number) => {
    setSaving(true);
    setError(null);
    try {
      const response = await apiService.patients.getById(String(patientId));
      const patient = response.data?.patient;
      if (!patient) throw new Error('Patient details not found');
      setSelectedPatientId(patientId);
      setEditForm({
        first_name: patient.first_name || '',
        last_name: patient.last_name || '',
        registration_date: patient.created_at ? String(patient.created_at).slice(0, 10) : '',
        date_of_birth: patient.date_of_birth ? String(patient.date_of_birth).slice(0, 10) : '',
        age: patient.age ? String(patient.age) : '',
        gender: patient.gender || 'FEMALE',
        phone: patient.phone || '',
        email: patient.email || '',
        address: patient.address || '',
        province: patient.province || ''
      });
      setEditOpen(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to load patient details');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) return;
    setSaving(true);
    setError(null);
    try {
      await apiService.patients.update(String(selectedPatientId), {
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        date_of_birth: editForm.date_of_birth || undefined,
        age: editForm.age ? Number(editForm.age) : undefined,
        gender: editForm.gender,
        phone: editForm.phone || undefined,
        email: editForm.email || undefined,
        address: editForm.address || undefined,
        province: editForm.province || undefined
      });
      setEditOpen(false);
      setSelectedPatientId(null);
      await loadPatients(searchTerm);
    } catch (err: any) {
      setError(err?.message || 'Failed to update patient');
    } finally {
      setSaving(false);
    }
  };

  const openAssignModal = (patientId: number) => {
    setSelectedPatientId(patientId);
    if (canOrthoAssignCareTeam) {
      setAssignRole('DENTAL_SURGEON');
    } else {
      setAssignRole('ORTHODONTIST');
    }
    setAssignMemberId('');
    setAssignOpen(true);
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !assignMemberId) return;
    setSaving(true);
    setError(null);
    try {
      await apiService.patients.assign(String(selectedPatientId), {
        user_id: Number(assignMemberId),
        assignment_role: assignRole
      });
      setAssignOpen(false);
      setSelectedPatientId(null);
      setAssignMemberId('');
      await loadPatients(searchTerm);
    } catch (err: any) {
      setError(err?.message || 'Failed to assign care team member');
    } finally {
      setSaving(false);
    }
  };

  const assignCandidates = useMemo(() => {
    if (assignRole === 'ORTHODONTIST') return orthodontists;
    return assignableStaff.filter((s) => s.role === assignRole);
  }, [assignRole, orthodontists, assignableStaff]);

  const handleDeletePatient = async (patientId: number, patientName: string, permanent = false) => {
    const confirmed = window.confirm(
      permanent
        ? `Permanently delete patient "${patientName}"? This cannot be undone.`
        : `Delete patient "${patientName}"? This will mark the record as inactive.`
    );
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    try {
      await apiService.patients.delete(String(patientId), permanent);
      localStorage.setItem('patients_updated_at', String(Date.now()));
      await loadPatients(searchTerm, adminDeletedFilter);
    } catch (err: any) {
      setError(err?.message || (permanent ? 'Failed to permanently delete patient' : 'Failed to delete patient'));
    } finally {
      setSaving(false);
    }
  };

  const handleReactivatePatient = async (patientId: number, patientName: string) => {
    const confirmed = window.confirm(`Reactivate patient "${patientName}"?`);
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    try {
      await apiService.patients.reactivate(String(patientId));
      localStorage.setItem('patients_updated_at', String(Date.now()));
      await loadPatients(searchTerm, adminDeletedFilter);
    } catch (err: any) {
      setError(err?.message || 'Failed to reactivate patient');
    } finally {
      setSaving(false);
    }
  };

  const statusVariant = (status: PatientRecord['status']) => {
    if (status === 'ACTIVE') return 'blue';
    if (status === 'INACTIVE') return 'neutral';
    if (status === 'COMPLETED') return 'success';
    return 'neutral';
  };

  const genderLabel = (gender: PatientRecord['gender']) => {
    if (gender === 'MALE') return 'M';
    if (gender === 'FEMALE') return 'F';
    return 'O';
  };

  const formatDate = (iso?: string | null) => {
    if (!iso) return '-';
    return String(iso).slice(0, 10);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Patient Directory</h2>
          <p className="text-gray-500">Manage hospital patient records and cases.</p>
        </div>
        {canCreatePatients && (
          <Button className="flex items-center gap-2" onClick={openCreateModal}>
            <UserPlus className="w-4 h-4" />
            Add New Patient
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      <Card>
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-4 justify-between bg-gray-50/50">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by name or MRN..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            {canDeletePatients && (
              <div className="inline-flex rounded-md border border-gray-200 overflow-hidden">
                <button
                  type="button"
                  className={`px-3 h-10 text-sm ${adminDeletedFilter === 'active' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
                  onClick={() => {
                    setAdminDeletedFilter('active');
                    loadPatients(searchTerm, 'active');
                  }}
                >
                  Active
                </button>
                <button
                  type="button"
                  className={`px-3 h-10 text-sm border-l border-gray-200 ${adminDeletedFilter === 'inactive' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
                  onClick={() => {
                    setAdminDeletedFilter('inactive');
                    loadPatients(searchTerm, 'inactive');
                  }}
                >
                  Inactive
                </button>
              </div>
            )}
            <Button
              variant="secondary"
              className="flex items-center gap-2"
              onClick={() => setShowFilters((prev) => !prev)}
            >
              <Filter className="w-4 h-4" />
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Button>
            <Button variant="secondary" onClick={() => loadPatients(searchTerm, adminDeletedFilter)}>Refresh</Button>
          </div>
        </div>
        {showFilters && (
          <div className="px-4 pb-4 border-b border-gray-100 bg-gray-50/40">
            <div className={`grid grid-cols-1 ${canFilterByAssignedOrthodontist ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-3`}>
              {canFilterByAssignedOrthodontist && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Assigned Orthodontist</label>
                  <select
                    className="w-full h-10 rounded-md border border-gray-200 px-3 text-sm"
                    value={draftFilters.assignedOrthodontist}
                    onChange={(e) => setDraftFilters((prev) => ({ ...prev, assignedOrthodontist: e.target.value }))}
                  >
                    <option value="">All</option>
                    <option value="unassigned">Unassigned</option>
                    {orthodontists.map((o) => (
                      <option key={o.id} value={String(o.id)}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Registration Date</label>
                <Input
                  type="date"
                  value={draftFilters.registrationDate}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, registrationDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <Button variant="secondary" onClick={resetFilters}>
                Reset
              </Button>
              <Button onClick={applyFilters}>
                Apply Filters
              </Button>
            </div>
          </div>
        )}

        <Table>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-6 py-4 font-semibold text-gray-600">Patient ID</th>
              <th className="px-6 py-4 font-semibold text-gray-600">Full Name</th>
              <th className="px-6 py-4 font-semibold text-gray-600">Age / Sex</th>
              <th className="px-6 py-4 font-semibold text-gray-600">Assigned Care Team</th>
              <th className="px-6 py-4 font-semibold text-gray-600">Last Visit</th>
              <th className="px-6 py-4 font-semibold text-gray-600">Status</th>
              <th className="px-6 py-4 font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {!loading && filteredPatients.map((p) => (
              <tr
                key={p.id}
                className="hover:bg-blue-50/30 transition-colors cursor-pointer"
                onClick={() => {
                  if (p.is_inactive) return;
                  navigate(`/patients/${p.id}`);
                }}
              >
                <td className="px-6 py-4 font-mono text-xs font-bold text-blue-600">#{p.patient_code}</td>
                <td className="px-6 py-4 font-medium text-gray-900">{p.first_name} {p.last_name}</td>
                <td className="px-6 py-4 text-gray-500">{p.age ?? '-'}y / {genderLabel(p.gender)}</td>
                <td className="px-6 py-4 text-gray-600">
                  <div className="space-y-0.5">
                    <div><span className="text-gray-400">Ortho:</span> {p.assigned_orthodontist_name || 'Unassigned'}</div>
                    <div><span className="text-gray-400">Surgeon:</span> {p.assigned_surgeon_name || 'Unassigned'}</div>
                    <div><span className="text-gray-400">Student:</span> {p.assigned_student_name || 'Unassigned'}</div>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-500">{formatDate(p.last_visit)}</td>
                <td className="px-6 py-4">
                  <Badge variant={statusVariant((p.display_status || p.status) as PatientRecord['status'])}>
                    {p.display_status || p.status}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-right">
                  {canManagePatientDirectory && (
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(p.id);
                        }}
                      >
                        <Pencil className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openAssignModal(p.id);
                        }}
                      >
                        Assign Ortho
                      </Button>
                    </div>
                  )}
                  {canOrthoAssignCareTeam && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        openAssignModal(p.id);
                      }}
                    >
                      Assign Team
                    </Button>
                  )}
                  {canDeletePatients && (
                    <div className="flex justify-end gap-2">
                      {adminDeletedFilter === 'inactive' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="bg-green-600 text-white border border-green-600 hover:bg-green-700 active:bg-green-800"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReactivatePatient(p.id, `${p.first_name} ${p.last_name}`);
                          }}
                          disabled={saving}
                        >
                          Reactivate
                        </Button>
                      )}
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePatient(p.id, `${p.first_name} ${p.last_name}`, adminDeletedFilter === 'inactive');
                        }}
                        disabled={saving}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        {adminDeletedFilter === 'inactive' ? 'Delete Permanently' : 'Delete'}
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>

        {loading && (
          <div className="p-12 text-center text-gray-500">
            Loading patients...
          </div>
        )}

        {!loading && filteredPatients.length === 0 && (
          <div className="p-12 text-center text-gray-500">
            No patients found matching "{searchTerm}"
          </div>
        )}
      </Card>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Add New Patient</h3>
            <form className="space-y-4" onSubmit={handleCreate}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  placeholder="First name"
                  value={createForm.first_name}
                  onChange={(e) => setCreateForm((s) => ({ ...s, first_name: e.target.value }))}
                  required
                />
                <Input
                  placeholder="Last name"
                  value={createForm.last_name}
                  onChange={(e) => setCreateForm((s) => ({ ...s, last_name: e.target.value }))}
                  required
                />
                <Input
                  type="date"
                  value={createForm.registration_date}
                  onChange={(e) => setCreateForm((s) => ({ ...s, registration_date: e.target.value }))}
                />
                <Input
                  type="date"
                  value={createForm.date_of_birth}
                  onChange={(e) =>
                    setCreateForm((s) => {
                      const date_of_birth = e.target.value;
                      return {
                        ...s,
                        date_of_birth,
                        age: calculateAgeFromDob(date_of_birth)
                      };
                    })
                  }
                  required
                />
                <Input
                  type="number"
                  min={0}
                  max={130}
                  placeholder="Age"
                  value={createForm.age}
                  readOnly
                />
                <select
                  className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={createForm.gender}
                  onChange={(e) => setCreateForm((s) => ({ ...s, gender: e.target.value }))}
                >
                  <option value="FEMALE">Female</option>
                  <option value="MALE">Male</option>
                  <option value="OTHER">Other</option>
                </select>
                <Input
                  placeholder="Phone"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm((s) => ({ ...s, phone: e.target.value }))}
                />
                <Input
                  type="email"
                  placeholder="Email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((s) => ({ ...s, email: e.target.value }))}
                />
              </div>
              <Input
                placeholder="Address"
                value={createForm.address}
                onChange={(e) => setCreateForm((s) => ({ ...s, address: e.target.value }))}
              />
              <Input
                placeholder="Province"
                value={createForm.province}
                onChange={(e) => setCreateForm((s) => ({ ...s, province: e.target.value }))}
              />

              <div>
                <label className="block text-sm text-gray-600 mb-1">Assign Orthodontist (optional)</label>
                <select
                  className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={createOrthodontistId}
                  onChange={(e) => setCreateOrthodontistId(e.target.value)}
                >
                  <option value="">No assignment</option>
                  {orthodontists.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Create Patient'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Edit Patient (General Details)</h3>
            <form className="space-y-4" onSubmit={handleEdit}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  placeholder="First name"
                  value={editForm.first_name}
                  onChange={(e) => setEditForm((s) => ({ ...s, first_name: e.target.value }))}
                  required
                />
                <Input
                  placeholder="Last name"
                  value={editForm.last_name}
                  onChange={(e) => setEditForm((s) => ({ ...s, last_name: e.target.value }))}
                  required
                />
                <Input
                  type="date"
                  value={editForm.registration_date}
                  disabled
                />
                <Input
                  type="date"
                  value={editForm.date_of_birth}
                  onChange={(e) =>
                    setEditForm((s) => {
                      const date_of_birth = e.target.value;
                      return {
                        ...s,
                        date_of_birth,
                        age: calculateAgeFromDob(date_of_birth)
                      };
                    })
                  }
                />
                <Input
                  type="number"
                  min={0}
                  max={130}
                  placeholder="Age"
                  value={editForm.age}
                  readOnly
                />
                <select
                  className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={editForm.gender}
                  onChange={(e) => setEditForm((s) => ({ ...s, gender: e.target.value }))}
                >
                  <option value="FEMALE">Female</option>
                  <option value="MALE">Male</option>
                  <option value="OTHER">Other</option>
                </select>
                <Input
                  placeholder="Phone"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((s) => ({ ...s, phone: e.target.value }))}
                />
                <Input
                  type="email"
                  placeholder="Email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((s) => ({ ...s, email: e.target.value }))}
                />
                <Input
                  placeholder="Province"
                  value={editForm.province}
                  onChange={(e) => setEditForm((s) => ({ ...s, province: e.target.value }))}
                />
              </div>
              <Input
                placeholder="Address"
                value={editForm.address}
                onChange={(e) => setEditForm((s) => ({ ...s, address: e.target.value }))}
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setEditOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Update Patient'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {assignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              {canOrthoAssignCareTeam ? 'Assign Care Team Member' : 'Assign Orthodontist'}
            </h3>
            <form className="space-y-4" onSubmit={handleAssign}>
              {canOrthoAssignCareTeam && (
                <select
                  className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={assignRole}
                  onChange={(e) => {
                    const role = e.target.value as 'DENTAL_SURGEON' | 'STUDENT';
                    setAssignRole(role);
                    setAssignMemberId('');
                  }}
                >
                  <option value="DENTAL_SURGEON">Dental Surgeon</option>
                  <option value="STUDENT">Student</option>
                </select>
              )}
              <select
                className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={assignMemberId}
                onChange={(e) => setAssignMemberId(e.target.value)}
                required
              >
                <option value="">
                  {assignRole === 'ORTHODONTIST' ? 'Select orthodontist' : `Select ${assignRole === 'DENTAL_SURGEON' ? 'dental surgeon' : 'student'}`}
                </option>
                {assignCandidates.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.email})
                  </option>
                ))}
              </select>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setAssignOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Assign'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
