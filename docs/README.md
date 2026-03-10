---
layout: home
permalink: index.html

# Please update this with your repository name and project title
repository-name: e23-co2060-Orthodontics-Workflow-Automation-System
title: Orthodontics Workflow Automation System
---

[comment]: # "This is the standard layout for the project, but you can clean this and use your own template, and add more information required for your own project"

<!-- Once you fill the index.json file inside /docs/data, please make sure the syntax is correct. (You can use this tool to identify syntax errors)

Please include the "correct" email address of your supervisors. (You can find them from https://people.ce.pdn.ac.lk/ )

Please include an appropriate cover page image ( cover_page.jpg ) and a thumbnail image ( thumbnail.jpg ) in the same folder as the index.json (i.e., /docs/data ). The cover page image must be cropped to 940×352 and the thumbnail image must be cropped to 640×360 . Use https://croppola.com/ for cropping and https://squoosh.app/ to reduce the file size.

If your followed all the given instructions correctly, your repository will be automatically added to the department's project web site (Update daily)

A HTML template integrated with the given GitHub repository templates, based on github.com/cepdnaclk/eYY-project-theme . If you like to remove this default theme and make your own web page, you can remove the file, docs/_config.yml and create the site using HTML. -->

# Project Title

Orthodontics Workflow Automation System

## Team
-  E/23/182, R.K. Kulasooriya, [email](mailto:e23182@eng.pdn.ac.lk)
-  E/23/292, K.S. Rambukkanage, [email](mailto:e23292@eng.pdn.ac.lk)
-  E/23/299, R.D.K.D. Ranasinghe, [email](mailto:e23299@eng.pdn.ac.lk)
-  E/23/302, T.G.D. Randeep, [email](mailto:e23302@eng.pdn.ac.lk)

<!-- Image (photo/drawing of the final hardware) should be here -->

<!-- This is a sample image, to show how to add images to your page. To learn more options, please refer [this](https://projects.ce.pdn.ac.lk/docs/faq/how-to-add-an-image/) -->

<!-- ![Sample Image](./images/sample.png) -->

## Supervisors
- Dr. Asitha Bandaranayake - [asithab@eng.pdn.ac.lk](mailto:asithab@eng.pdn.ac.lk)
- Dr. H.S.K. Ratnatilake - [ksandamala2002@dental.pdn.ac.lk](mailto:ksandamala2002@dental.pdn.ac.lk)
- Dr. D.D. Vithanachchi - [dinakad@dental.pdn.ac.lk](mailto:dinakad@dental.pdn.ac.lk)

## Table of Contents
1. [Introduction](#introduction)
2. [Solution Architecture](#solution-architecture)
3. [Software Designs](#software-designs)
4. [Testing](#testing)
5. [Conclusion](#conclusion)
6. [Links](#links)

## Introduction

Orthodontic clinics still depend heavily on paper files, fragmented patient histories, and manual coordination between clinicians, students, and administrative staff. This leads to delays in record retrieval, duplicated effort, limited traceability, and reduced visibility into treatment progress and clinic operations.

The Orthodontics Workflow Automation System addresses this by centralizing patient records, visits, clinical notes, diagnostic context, documents, approvals, and operational reporting into a single web platform. The resulting system improves continuity of care, supports role-based collaboration, and provides a stronger digital foundation for future expansion within the Dental Hospital environment.


## Solution Architecture

The implemented solution follows a web-based client-server architecture. The backend in `codes/Backend` provides a REST API built with Express and MySQL, handling authentication, authorization, validation, persistence, file uploads, reminders, and audit-related workflows. The frontend in `codes/Frontend` is a React and Vite application that consumes those APIs and presents role-aware interfaces for administrators, clinicians, students, nurses, and reception staff.

At the system level, the main architectural elements are:

- a MySQL-backed backend service for business logic and data management
- a React frontend for browser-based clinical and administrative workflows
- JWT-based authentication with refresh-token support and inactivity timeout handling
- supporting services for email notifications, document handling, and audit-retention processing

## Software Designs

The software design is organized around the major workflows required in an orthodontic clinical setting. The backend exposes dedicated route and controller layers for authentication, patients, visits, queue handling, documents, clinical notes, cases, inventory, users, and reports. Validation and access-control middleware are used to enforce input quality and role-based restrictions across these modules.

On the frontend, the application is structured around route-based pages and reusable components. Current implemented designs cover the dashboard, patient directory, detailed patient profiles, dental-chart and document views, queue management, student case handling, inventory workflows, administrative reporting, audit-log review, and approval requests for clinician assignment changes.

## Testing

Testing has been carried out through iterative functional verification of both backend APIs and frontend workflows. The current repository includes working implementations for authentication, patient management, queue operations, inventory actions, reports, audit-log access, and role-specific navigation and authorization behavior.

In addition to local execution checks, the system has been validated through endpoint health checks, seeded-account login flows, patient and queue operations, administrative workflows, and frontend route coverage for the currently implemented pages. This has helped confirm that the main operational flows work together as an integrated full-stack system.

## Conclusion

The project has established a working digital workflow platform for orthodontic clinic operations, replacing key manual processes with a centralized web-based system. The current implementation already supports patient-centered clinical work, administrative control, operational reporting, and role-aware collaboration across multiple user groups.

Future development can extend the system with broader deployment support, additional analytics, richer document and imaging workflows, tighter integration with external clinical systems, and further usability improvements for real-world institutional use.

## Links

- [Project Repository](https://github.com/cepdnaclk/e23-co2060-Orthodontics-Workflow-Automation-System)
- [Project Page](https://cepdnaclk.github.io/e23-co2060-Orthodontics-Workflow-Automation-System)
- [Department of Computer Engineering](http://www.ce.pdn.ac.lk/)
- [University of Peradeniya](https://eng.pdn.ac.lk/)

[//]: # (Please refer this to learn more about Markdown syntax)
[//]: # (https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet)
