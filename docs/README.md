---
layout: home
permalink: index.html
repository-name: e23-co2060-Orthodontics-Workflow-Automation-System
title: OrthoFlow Documentation
---

# OrthoFlow Documentation

OrthoFlow is an orthodontics workflow automation system built for patient care, clinic queue handling, student case supervision, records management, reporting, and administrative auditing.

This documentation is written for future maintainers, technical officers, IT staff, and project stakeholders who need to understand, deploy, and maintain the system.

## Recommended Reading Order

1. [System Overview](system-overview.md)
2. [Architecture](architecture.md)
3. [Data Storage](data-storage.md)
4. [Cloud Deployment](cloud-deployment.md)
5. [Environment Variables](environment-variables.md)
6. [Operations and Maintenance](operations-maintenance.md)
7. [Troubleshooting](troubleshooting.md)

## Quick Links

- [Local Development](local-development.md)
- [Roles and Permissions](roles-and-permissions.md)
- [Detailed Production Deployment Runbook](../codes/PRODUCTION_DEPLOYMENT_RUNBOOK.md)
- [Cloudflare R2 Storage Notes](../codes/Backend/docs/cloudflare-r2-storage.md)

## Repository Layout

```text
.
├── codes/
│   ├── Backend/      Node.js/Express API
│   └── Frontend/     React/Vite frontend
├── docs/             Handover and maintenance documentation
└── README.md         Project entry point
```

## Key Services Used in Production

- Render for frontend and backend hosting.
- Aiven MySQL for the production database.
- Cloudflare R2 for uploaded documents/images.
- SMTP2GO or Brevo for email sending.
- Google OAuth for Google Sign-In.
