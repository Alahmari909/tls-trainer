# TLS Trainer — Full Backup
**Date:** 2026-06-16  
**Commit:** 7b590f3

## What's included
- Full source code (all packages)
- All static assets (simulator, PDFs, HTML files)
- Database schema (50 tables)

## Database (Turso)
- **URL:** libsql://tls-trainer-alahmari909.aws-us-east-1.turso.io
- **Tables:** 50 tables
- **Documents:** 42 PDFs stored as base64
- **Trainees:** 4 registered
- **Error Codes:** 126 entries
- **Questions:** 60 quiz questions

## Restore
To restore code: checkout this branch `backup/2026-06-16`
To restore DB: use the database_dump.json file with the Turso restore script

## Last working features
- Trainee app (cyan theme) — all pages working
- Admin app (green theme) — all pages working  
- Simulator — fixed iframe X-Frame-Options
- Documents — 42 PDFs uploaded
- Nav: Home + About added
