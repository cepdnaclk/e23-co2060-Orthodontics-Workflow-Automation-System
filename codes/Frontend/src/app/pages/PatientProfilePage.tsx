import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Card, Badge, Button, Table, Input } from '../components/UI';
import { ArrowLeft, User, Calendar, FileText, Grid, Upload, Plus } from 'lucide-react';
import { DentalChart } from '../components/DentalChart';
import { DocumentPortal } from '../components/DocumentPortal';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api';
import { toast } from 'sonner';

type TabId = 'overview' | 'visits' | 'history' | 'chart' | 'documents' | 'notes';

const canEditMedical = (role?: string) => ['ORTHODONTIST', 'DENTAL_SURGEON'].includes(role || '');
const canCreateNotes = (role?: string) => ['ORTHODONTIST', 'DENTAL_SURGEON'].includes(role || '');
const canUploadDocuments = (role?: string) => ['ORTHODONTIST', 'DENTAL_SURGEON'].includes(role || '');
const canDeleteDocuments = (role?: string) => role === 'ORTHODONTIST';
const canManageAppointments = (role?: string) => ['RECEPTION', 'NURSE'].includes(role || '');
const canReadDentalChart = (role?: string) => ['ORTHODONTIST', 'DENTAL_SURGEON', 'STUDENT', 'ADMIN'].includes(role || '');
const canReadDocuments = (role?: string) => ['ORTHODONTIST', 'DENTAL_SURGEON', 'STUDENT', 'ADMIN'].includes(role || '');
const canReadTreatmentNotes = (role?: string) => ['ORTHODONTIST', 'DENTAL_SURGEON', 'STUDENT', 'ADMIN'].includes(role || '');
const canReadPatientHistory = (role?: string) => ['ORTHODONTIST', 'DENTAL_SURGEON', 'STUDENT', 'ADMIN'].includes(role || '');

export function PatientProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [patient, setPatient] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [historyAuto, setHistoryAuto] = useState<any>(null);
  const [historyData, setHistoryData] = useState<Record<string, any>>({});
  const [historyMeta, setHistoryMeta] = useState<any>(null);

  const patientId = String(id || '');

  const loadPatient = async () => {
    if (!patientId) return;
    setLoading(true);
    setError(null);
    try {
      const patientResponse = await apiService.patients.getById(patientId);
      const [visitResponse, noteResponse, historyResponse] = await Promise.allSettled([
        apiService.visits.getPatientVisits(patientId, { page: 1, limit: 100 }),
        apiService.clinicalNotes.getPatientNotes(patientId, { page: 1, limit: 100 }),
        apiService.patients.getHistory(patientId),
      ]);

      const payload = patientResponse.data || {};
      setPatient(payload.patient || null);
      setAssignments(payload.assignments || []);
      setVisits(visitResponse.status === 'fulfilled' ? (visitResponse.value.data?.visits || visitResponse.value.data?.items || []) : []);
      setNotes(noteResponse.status === 'fulfilled' ? (noteResponse.value.data?.notes || noteResponse.value.data?.items || []) : []);
      if (historyResponse.status === 'fulfilled') {
        setHistoryAuto(historyResponse.value.data?.auto || null);
        setHistoryData(historyResponse.value.data?.history || {});
        setHistoryMeta(historyResponse.value.data?.metadata || null);
      } else {
        setHistoryAuto(null);
        setHistoryData({});
        setHistoryMeta(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load patient profile');
      setPatient(null);
      setAssignments([]);
      setVisits([]);
      setNotes([]);
      setHistoryAuto(null);
      setHistoryData({});
      setHistoryMeta(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatient();
  }, [patientId]);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'visits', label: 'Visits', icon: Calendar },
    { id: 'history', label: 'Patient History', icon: FileText },
    { id: 'chart', label: 'Dental Chart', icon: Grid },
    { id: 'documents', label: 'Documents', icon: Upload },
    { id: 'notes', label: 'Treatment Notes', icon: FileText },
  ];

  const attendingOrthodontist = useMemo(
    () => assignments.find((a) => a.assignment_role === 'ORTHODONTIST')?.user_name || 'Unassigned',
    [assignments]
  );
  const assignedStudent = useMemo(
    () => assignments.find((a) => a.assignment_role === 'STUDENT')?.user_name || 'Unassigned',
    [assignments]
  );
  const assignedSurgeon = useMemo(
    () => assignments.find((a) => a.assignment_role === 'DENTAL_SURGEON')?.user_name || 'Unassigned',
    [assignments]
  );

  if (loading) {
    return <div className="p-6 text-gray-500">Loading patient profile...</div>;
  }

  if (error || !patient) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/patients')} className="w-fit">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Patients
        </Button>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
          {error || 'Patient not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/patients')} className="p-2">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-900">{patient.first_name} {patient.last_name}</h2>
            <Badge variant="blue">MRN: {patient.patient_code}</Badge>
            <Badge variant={patient.status === 'ACTIVE' ? 'success' : 'neutral'}>{patient.status}</Badge>
          </div>
          <p className="text-gray-500 text-sm">Born {String(patient.date_of_birth).slice(0, 10)} ({patient.age ?? '-'}y) • {patient.gender}</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabId)}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-all relative whitespace-nowrap ${
              activeTab === tab.id ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {activeTab === 'overview' && (
          <OverviewTab
            patientId={patientId}
            role={user?.role}
            patient={patient}
            attendingOrthodontist={attendingOrthodontist}
            assignedSurgeon={assignedSurgeon}
            assignedStudent={assignedStudent}
            visits={visits}
            onChanged={loadPatient}
          />
        )}
        {activeTab === 'visits' && <VisitsTab visits={visits} role={user?.role} onChanged={loadPatient} />}
        {activeTab === 'history' && (
          canReadPatientHistory(user?.role)
            ? (
              <HistoryTab
                patientId={patientId}
                role={user?.role}
                auto={historyAuto}
                history={historyData}
                metadata={historyMeta}
                onSaved={loadPatient}
              />
            )
            : <AccessDeniedSection />
        )}
        {activeTab === 'chart' && (
          canReadDentalChart(user?.role)
            ? <DentalChart patientId={patientId} canEdit={canEditMedical(user?.role)} />
            : <AccessDeniedSection />
        )}
        {activeTab === 'documents' && (
          canReadDocuments(user?.role)
            ? (
              <DocumentPortal
                patientId={patientId}
                canUpload={canUploadDocuments(user?.role)}
                canDelete={canDeleteDocuments(user?.role)}
              />
            )
            : <AccessDeniedSection />
        )}
        {activeTab === 'notes' && (
          canReadTreatmentNotes(user?.role)
            ? (
              <NotesTab
                notes={notes}
                patientId={patientId}
                role={user?.role}
                canCreate={canCreateNotes(user?.role)}
                onCreated={loadPatient}
              />
            )
            : <AccessDeniedSection />
        )}
      </div>
    </div>
  );
}

function AccessDeniedSection() {
  return (
    <Card className="p-6">
      <p className="text-sm text-red-600 font-medium">You do not have access to this section.</p>
    </Card>
  );
}

function OverviewTab({ patientId, role, patient, attendingOrthodontist, assignedSurgeon, assignedStudent, visits, onChanged }: any) {
  const [appointmentDate, setAppointmentDate] = useState('');
  const [procedureType, setProcedureType] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [sendingReminderId, setSendingReminderId] = useState<number | null>(null);
  const [reminderStatus, setReminderStatus] = useState<Record<number, 'sent' | 'simulated'>>({});

  const canManage = canManageAppointments(role);
  const upcoming = (visits || []).filter((v: any) => v.status === 'SCHEDULED').slice(0, 5);

  const scheduleAppointment = async () => {
    if (!appointmentDate) {
      toast.error('Please choose an appointment date and time');
      return;
    }
    setScheduling(true);
    try {
      await apiService.visits.create(String(patientId), {
        visit_date: appointmentDate,
        procedure_type: procedureType || 'Follow-up',
        status: 'SCHEDULED'
      });
      toast.success('Appointment scheduled');
      setAppointmentDate('');
      setProcedureType('');
      await onChanged();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to schedule appointment');
    } finally {
      setScheduling(false);
    }
  };

  const sendReminder = async (visitId: number) => {
    setSendingReminderId(visitId);
    try {
      const response = await apiService.visits.sendReminder(String(visitId));
      const delivered = response?.data?.simulated === false;
      setReminderStatus((prev) => ({
        ...prev,
        [visitId]: delivered ? 'sent' : 'simulated'
      }));
      toast.success(response?.message || 'Reminder sent');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to send reminder');
    } finally {
      setSendingReminderId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2 p-6 space-y-8">
        <div>
          <h4 className="font-bold text-gray-900 mb-4">Patient Information</h4>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase">Contact Email</p>
              <p className="text-sm font-medium mt-1">{patient.email || '-'}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase">Contact Phone</p>
              <p className="text-sm font-medium mt-1">{patient.phone || '-'}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase">Attending Orthodontist</p>
              <p className="text-sm font-medium mt-1">{attendingOrthodontist}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase">Assigned Dental Surgeon</p>
              <p className="text-sm font-medium mt-1">{assignedSurgeon}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase">Assigned Student</p>
              <p className="text-sm font-medium mt-1">{assignedStudent}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h4 className="font-bold text-gray-900 mb-4">Upcoming Appointments</h4>
        {canManage && (
          <div className="space-y-2 mb-4">
            <Input
              type="datetime-local"
              value={appointmentDate}
              onChange={(e) => setAppointmentDate(e.target.value)}
            />
            <Input
              placeholder="Appointment type (optional)"
              value={procedureType}
              onChange={(e) => setProcedureType(e.target.value)}
            />
            <Button onClick={scheduleAppointment} disabled={scheduling || !appointmentDate} className="w-full">
              {scheduling ? 'Scheduling...' : 'Schedule Appointment'}
            </Button>
          </div>
        )}
        <div className="space-y-3">
          {upcoming.length === 0 && <p className="text-sm text-gray-500">No upcoming visits.</p>}
          {upcoming.map((visit: any) => (
            <div key={visit.id} className="p-3 border border-gray-100 rounded-lg">
              <p className="text-sm font-semibold text-gray-900">{visit.procedure_type || 'Visit'}</p>
              <p className="text-xs text-gray-500 mt-1">{String(visit.visit_date).slice(0, 16).replace('T', ' ')}</p>
              {canManage && (
                <div className="mt-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="bg-green-600 text-white hover:bg-green-700 active:bg-green-800 border border-green-600"
                    onClick={() => sendReminder(visit.id)}
                    disabled={sendingReminderId === visit.id}
                  >
                    {sendingReminderId === visit.id ? 'Sending...' : 'Send Reminder'}
                  </Button>
                  {reminderStatus[visit.id] === 'sent' && (
                    <p className="text-xs text-green-700 mt-1 font-medium">Reminder was sent.</p>
                  )}
                  {reminderStatus[visit.id] === 'simulated' && (
                    <p className="text-xs text-amber-700 mt-1 font-medium">Reminder was recorded (SMTP simulation).</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function VisitsTab({
  visits,
  role,
  onChanged
}: {
  visits: any[];
  role?: string;
  onChanged: () => Promise<void>;
}) {
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const canManage = canManageAppointments(role);

  const statusVariant = (status: string) => {
    if (status === 'COMPLETED') return 'success';
    if (status === 'DID_NOT_ATTEND') return 'error';
    if (status === 'SCHEDULED') return 'blue';
    return 'neutral';
  };

  const markVisit = async (visitId: number, status: 'COMPLETED' | 'DID_NOT_ATTEND') => {
    setUpdatingId(visitId);
    try {
      await apiService.visits.update(String(visitId), { status });
      toast.success(status === 'COMPLETED' ? 'Marked as attended' : 'Marked as did not attend');
      await onChanged();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update visit');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <Card>
      <Table>
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100 text-left">
            <th className="px-6 py-4 font-semibold text-gray-600">Date</th>
            <th className="px-6 py-4 font-semibold text-gray-600">Type</th>
            <th className="px-6 py-4 font-semibold text-gray-600">Provider</th>
            <th className="px-6 py-4 font-semibold text-gray-600">Notes</th>
            <th className="px-6 py-4 font-semibold text-gray-600">Status</th>
            {canManage && <th className="px-6 py-4 font-semibold text-gray-600">Reception Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {visits.length === 0 && (
            <tr>
              <td className="px-6 py-6 text-sm text-gray-500" colSpan={canManage ? 6 : 5}>No visits found for this patient.</td>
            </tr>
          )}
          {visits.map((v) => (
            <tr key={v.id} className="hover:bg-gray-50/50">
              <td className="px-6 py-4 font-medium">{String(v.visit_date).slice(0, 16).replace('T', ' ')}</td>
              <td className="px-6 py-4"><Badge variant="blue">{v.procedure_type || 'Visit'}</Badge></td>
              <td className="px-6 py-4 text-gray-600">{v.provider_name || '-'}</td>
              <td className="px-6 py-4 text-gray-500 max-w-xs truncate">{v.notes || '-'}</td>
              <td className="px-6 py-4"><Badge variant={statusVariant(v.status)}>{v.status}</Badge></td>
              {canManage && (
                <td className="px-6 py-4">
                  {v.status === 'SCHEDULED' ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => markVisit(v.id, 'COMPLETED')}
                        disabled={updatingId === v.id}
                      >
                        Attended
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => markVisit(v.id, 'DID_NOT_ATTEND')}
                        disabled={updatingId === v.id}
                      >
                        Did Not Attend
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">Finalized</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

function HistoryTab({
  patientId,
  role,
  auto,
  history,
  metadata,
  onSaved
}: {
  patientId: string;
  role?: string;
  auto: any;
  history: Record<string, any>;
  metadata: any;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const canEdit = canEditMedical(role);

  useEffect(() => {
    setForm(history || {});
  }, [history]);

  const setValue = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  const saveHistory = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await apiService.patients.updateHistory(patientId, form);
      toast.success('Patient history saved');
      await onSaved();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save patient history');
    } finally {
      setSaving(false);
    }
  };

  const investigationOptions = ['Periapical', 'Upper Standard Occlusal', 'OPG', 'Cephalometric', 'CBCT'];
  const selectedInvestigations: string[] = Array.isArray(form.special_investigations) ? form.special_investigations : [];

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Orthodontics Case History</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div><span className="font-semibold text-gray-600">Name:</span> {auto?.name || '-'}</div>
          <div><span className="font-semibold text-gray-600">Age:</span> {auto?.age ?? '-'}</div>
          <div><span className="font-semibold text-gray-600">Birthday:</span> {auto?.birthday || '-'}</div>
          <div><span className="font-semibold text-gray-600">Address:</span> {auto?.address || '-'}</div>
          <div><span className="font-semibold text-gray-600">Sex:</span> {auto?.sex || '-'}</div>
          <div><span className="font-semibold text-gray-600">Telephone No:</span> {auto?.telephone || '-'}</div>
          <div><span className="font-semibold text-gray-600">Province:</span> {auto?.province || '-'}</div>
          <div><span className="font-semibold text-gray-600">Date of Examination:</span> {auto?.date_of_examination || '-'}</div>
          {metadata?.updated_at && (
            <div><span className="font-semibold text-gray-600">Last Updated:</span> {String(metadata.updated_at).slice(0, 16).replace('T', ' ')}</div>
          )}
        </div>
      </Card>

      <Card className="p-6 space-y-5">
        <h4 className="font-bold text-gray-900">Past History</h4>
        <Input placeholder="Past Dental History" value={form.past_dental_history || ''} onChange={(e) => setValue('past_dental_history', e.target.value)} disabled={!canEdit} />
        <Input placeholder="Past Medical History" value={form.past_medical_history || ''} onChange={(e) => setValue('past_medical_history', e.target.value)} disabled={!canEdit} />
        <Input placeholder="Family History" value={form.family_history || ''} onChange={(e) => setValue('family_history', e.target.value)} disabled={!canEdit} />
        <Input placeholder="Social History" value={form.social_history || ''} onChange={(e) => setValue('social_history', e.target.value)} disabled={!canEdit} />
        <Input placeholder="Allergies" value={form.allergies || ''} onChange={(e) => setValue('allergies', e.target.value)} disabled={!canEdit} />
      </Card>

      <Card className="p-6 space-y-5">
        <h4 className="font-bold text-gray-900">Clinical Examination</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input placeholder="Periodontal Health" value={form.periodontal_health || ''} onChange={(e) => setValue('periodontal_health', e.target.value)} disabled={!canEdit} />
          <Input placeholder="Teeth Present" value={form.teeth_present || ''} onChange={(e) => setValue('teeth_present', e.target.value)} disabled={!canEdit} />
          <Input placeholder="Caries" value={form.caries || ''} onChange={(e) => setValue('caries', e.target.value)} disabled={!canEdit} />
          <Input placeholder="Habits" value={form.habits || ''} onChange={(e) => setValue('habits', e.target.value)} disabled={!canEdit} />
          <Input placeholder="Facial Profile" value={form.facial_profile || ''} onChange={(e) => setValue('facial_profile', e.target.value)} disabled={!canEdit} />
          <Input placeholder="Facial Asymmetry" value={form.facial_asymmetry || ''} onChange={(e) => setValue('facial_asymmetry', e.target.value)} disabled={!canEdit} />
          <Input placeholder="Airway" value={form.airway || ''} onChange={(e) => setValue('airway', e.target.value)} disabled={!canEdit} />
          <Input placeholder="Skeletal Pattern" value={form.skeletal_pattern || ''} onChange={(e) => setValue('skeletal_pattern', e.target.value)} disabled={!canEdit} />
          <Input placeholder="Vertical (FMPA)" value={form.vertical_fmpa || ''} onChange={(e) => setValue('vertical_fmpa', e.target.value)} disabled={!canEdit} />
          <Input placeholder="Transverse Discrepancy" value={form.transverse_discrepancy || ''} onChange={(e) => setValue('transverse_discrepancy', e.target.value)} disabled={!canEdit} />
        </div>
      </Card>

      <Card className="p-6 space-y-5">
        <h4 className="font-bold text-gray-900">Soft Tissues & Dento-Alveolar</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input placeholder="Lips Competency" value={form.lips_competency || ''} onChange={(e) => setValue('lips_competency', e.target.value)} disabled={!canEdit} />
          <Input placeholder="Lip Line" value={form.lip_line || ''} onChange={(e) => setValue('lip_line', e.target.value)} disabled={!canEdit} />
          <Input placeholder="Lip Contour" value={form.lip_contour || ''} onChange={(e) => setValue('lip_contour', e.target.value)} disabled={!canEdit} />
          <Input placeholder="Tongue" value={form.tongue || ''} onChange={(e) => setValue('tongue', e.target.value)} disabled={!canEdit} />
          <Input placeholder="Mandibular Path of Closure" value={form.mandibular_path_of_closure || ''} onChange={(e) => setValue('mandibular_path_of_closure', e.target.value)} disabled={!canEdit} />
          <Input placeholder="Lower Anterior Segment" value={form.lower_anterior_segment || ''} onChange={(e) => setValue('lower_anterior_segment', e.target.value)} disabled={!canEdit} />
          <Input placeholder="Lower Buccal Segment" value={form.lower_buccal_segment || ''} onChange={(e) => setValue('lower_buccal_segment', e.target.value)} disabled={!canEdit} />
          <Input placeholder="Upper Anterior Segment" value={form.upper_anterior_segment || ''} onChange={(e) => setValue('upper_anterior_segment', e.target.value)} disabled={!canEdit} />
          <Input placeholder="Upper Buccal Segment" value={form.upper_buccal_segment || ''} onChange={(e) => setValue('upper_buccal_segment', e.target.value)} disabled={!canEdit} />
          <Input placeholder="Canine Angulation" value={form.canine_angulation || ''} onChange={(e) => setValue('canine_angulation', e.target.value)} disabled={!canEdit} />
        </div>
      </Card>

      <Card className="p-6 space-y-5">
        <h4 className="font-bold text-gray-900">Occlusion, IOTN & Suitability</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input placeholder="Incisor Relationship" value={form.incisor_relationship || ''} onChange={(e) => setValue('incisor_relationship', e.target.value)} disabled={!canEdit} />
          <Input placeholder="Right Molar Relationship" value={form.right_molar_relationship || ''} onChange={(e) => setValue('right_molar_relationship', e.target.value)} disabled={!canEdit} />
          <Input placeholder="Left Molar Relationship" value={form.left_molar_relationship || ''} onChange={(e) => setValue('left_molar_relationship', e.target.value)} disabled={!canEdit} />
          <Input placeholder="Canine Relationship" value={form.canine_relationship || ''} onChange={(e) => setValue('canine_relationship', e.target.value)} disabled={!canEdit} />
          <Input placeholder="Overjet" value={form.overjet || ''} onChange={(e) => setValue('overjet', e.target.value)} disabled={!canEdit} />
          <Input placeholder="Overbite" value={form.overbite || ''} onChange={(e) => setValue('overbite', e.target.value)} disabled={!canEdit} />
          <Input placeholder="Cross/Scissor Bites" value={form.cross_scissor_bites || ''} onChange={(e) => setValue('cross_scissor_bites', e.target.value)} disabled={!canEdit} />
          <Input placeholder="Centre Line" value={form.centre_line || ''} onChange={(e) => setValue('centre_line', e.target.value)} disabled={!canEdit} />
          <Input placeholder="Classification" value={form.classification || ''} onChange={(e) => setValue('classification', e.target.value)} disabled={!canEdit} />
          <Input placeholder="IOTN Dental Health Component Grade" value={form.iotn_dhc_grade || ''} onChange={(e) => setValue('iotn_dhc_grade', e.target.value)} disabled={!canEdit} />
          <Input placeholder="IOTN Aesthetic Component Grade" value={form.iotn_ac_grade || ''} onChange={(e) => setValue('iotn_ac_grade', e.target.value)} disabled={!canEdit} />
          <Input placeholder="Suitability" value={form.suitability || ''} onChange={(e) => setValue('suitability', e.target.value)} disabled={!canEdit} />
          <Input placeholder="Referral / Further Management" value={form.referral || ''} onChange={(e) => setValue('referral', e.target.value)} disabled={!canEdit} />
          <Input placeholder="Treatment Categories" value={form.treatment_categories || ''} onChange={(e) => setValue('treatment_categories', e.target.value)} disabled={!canEdit} />
          <Input placeholder="Priority" value={form.priority || ''} onChange={(e) => setValue('priority', e.target.value)} disabled={!canEdit} />
          <Input placeholder="Consultant Verification" value={form.consultant_verification || ''} onChange={(e) => setValue('consultant_verification', e.target.value)} disabled={!canEdit} />
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h4 className="font-bold text-gray-900">Special Investigations</h4>
        <div className="flex flex-wrap gap-4">
          {investigationOptions.map((item) => {
            const checked = selectedInvestigations.includes(item);
            return (
              <label key={item} className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!canEdit}
                  onChange={(e) => {
                    if (!canEdit) return;
                    if (e.target.checked) {
                      setValue('special_investigations', [...selectedInvestigations, item]);
                    } else {
                      setValue('special_investigations', selectedInvestigations.filter((v) => v !== item));
                    }
                  }}
                />
                {item}
              </label>
            );
          })}
        </div>
      </Card>

      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={saveHistory} disabled={saving}>
            {saving ? 'Saving...' : 'Save Patient History'}
          </Button>
        </div>
      )}
    </div>
  );
}

function NotesTab({
  notes,
  patientId,
  role,
  canCreate,
  onCreated,
}: {
  notes: any[];
  patientId: string;
  role?: string;
  canCreate: boolean;
  onCreated: () => Promise<void>;
}) {
  const [content, setContent] = useState('');
  const [noteType, setNoteType] = useState('PROGRESS');
  const [saving, setSaving] = useState(false);

  const addNote = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await apiService.clinicalNotes.create(patientId, { content: content.trim(), note_type: noteType });
      setContent('');
      setNoteType('PROGRESS');
      toast.success('Treatment note added');
      await onCreated();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to add note');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-3 space-y-6">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-gray-900">Chronological Notes</h4>
          {canCreate && (
            <Button size="sm" className="flex items-center gap-2" onClick={addNote} disabled={saving || !content.trim()}>
              <Plus className="w-4 h-4" />
              {saving ? 'Saving...' : 'Add Note'}
            </Button>
          )}
        </div>

        {notes.length === 0 && (
          <Card className="p-6 text-sm text-gray-500">No treatment notes found for this patient.</Card>
        )}

        <div className="space-y-4">
          {notes.map((note) => (
            <Card key={note.id} className="p-4 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="font-bold text-sm text-gray-900">{note.author_name || 'Unknown Author'}</span>
                  <Badge variant="neutral" className="ml-2">{note.note_type || 'NOTE'}</Badge>
                </div>
                <span className="text-xs text-gray-400">{String(note.created_at).slice(0, 16).replace('T', ' ')}</span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{note.content}</p>
              {Boolean(note.is_verified) && <p className="text-xs text-green-700 mt-3">Verified by {note.verifier_name || 'Supervisor'}</p>}
            </Card>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <Card className="p-5">
          <h4 className="text-xs font-bold text-gray-400 uppercase mb-4">New Note</h4>
          {canCreate ? (
            <div className="space-y-3">
              <select
                className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                value={noteType}
                onChange={(e) => setNoteType(e.target.value)}
              >
                <option value="PROGRESS">Progress</option>
                <option value="TREATMENT">Treatment</option>
                <option value="OBSERVATION">Observation</option>
                {role === 'ORTHODONTIST' && <option value="SUPERVISOR_REVIEW">Supervisor Review</option>}
              </select>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write clinical note..."
                className="w-full min-h-[220px] resize-y rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              <p className="text-xs text-gray-400 text-right">{content.length} characters</p>
            </div>
          ) : (
            <p className="text-xs text-gray-500">You can view notes but do not have permission to create them.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
