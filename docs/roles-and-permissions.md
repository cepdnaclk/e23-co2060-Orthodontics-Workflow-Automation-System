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
| `ORTHODONTIST` | Clinical supervision, patient care, approvals, and student case assignment |
| `DENTAL_SURGEON` | Clinical patient care, treatment documentation, and assigned student supervision |
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
| Patient assignment | Reception can initiate assignment requests; orthodontists/dental surgeons approve requests addressed to them; orthodontists can assign dental surgeons and students; dental surgeons can assign students |
| Visits | Admin, Reception, Nurse, clinical roles |
| Clinic queue | All roles can view; Reception manages queue membership; Reception, Orthodontist, Dental Surgeon, and Student can update status |
| Dental chart | Admin, assigned clinical roles, assigned students |
| Documents | Admin and permitted patient-care roles |
| Diagnosis/treatment notes | Clinical roles and assigned students, depending on permission |
| Payments | Admin and Reception; read access for selected clinical roles |
| Inventory | Admin can view; Nurse can view and manage items and stock |
| Student cases | Admin, Orthodontist, Dental Surgeon, Student |

## Assignment-Based Access

Some users do not automatically see every patient.

Examples:

- A student normally works with assigned patients/cases.
- Dental surgeons and orthodontists can be scoped by assignment.
- Orthodontists and dental surgeons can view and manage student cases for students they supervise.
- Admins can view student case progress and delete removed student cases when cleanup is needed.
- Reception and admin roles have broader operational access.

## Practical Maintenance Note

When testing permissions, create one user for each role and verify:

- visible sidebar items
- patient access
- create/update/delete permissions
- reports and audit-log access
- queue access
