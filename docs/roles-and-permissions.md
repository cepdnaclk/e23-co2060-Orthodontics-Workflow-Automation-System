# Roles and Permissions

The system uses role-based access control. Some roles can only access patients assigned to them.

## Roles

- `ADMIN`
- `ORTHODONTIST`
- `DENTAL_SURGEON`
- `NURSE`
- `RECEPTION`
- `STUDENT`

## Simple Role Summary

| Role | Main Purpose |
| --- | --- |
| `ADMIN` | Full system administration |
| `ORTHODONTIST` | Clinical supervision, patient care, approvals |
| `DENTAL_SURGEON` | Clinical patient care and treatment documentation |
| `NURSE` | Queue support, appointments, materials access |
| `RECEPTION` | Patient registration, visits, payments, queue workflow |
| `STUDENT` | Assigned patient/case workflow under supervision |

## Feature Access Summary

| Feature | Main Roles |
| --- | --- |
| User management | Admin |
| Audit logs | Admin |
| Reports | Admin |
| Patient registration | Admin, Reception |
| Patient profile viewing | Clinical and assigned roles |
| Patient assignment | Admin, Orthodontist/Dental Surgeon approval flow |
| Visits | Admin, Reception, Nurse, clinical roles |
| Clinic queue | Admin, Nurse, Reception, Orthodontist, Dental Surgeon, Student |
| Dental chart | Admin, assigned clinical roles, assigned students |
| Documents | Admin and permitted patient-care roles |
| Diagnosis/treatment notes | Clinical roles and assigned students, depending on permission |
| Payments | Admin and Reception; read access for selected clinical roles |
| Inventory | Admin and Nurse |
| Student cases | Admin, Orthodontist, Student |

## Assignment-Based Access

Some users do not automatically see every patient.

Examples:

- A student normally works with assigned patients/cases.
- Dental surgeons and orthodontists can be scoped by assignment.
- Reception and admin roles have broader operational access.

## Practical Maintenance Note

When testing permissions, create one user for each role and verify:

- visible sidebar items
- patient access
- create/update/delete permissions
- reports and audit-log access
- queue access

