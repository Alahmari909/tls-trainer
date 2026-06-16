# TLS Trainer — Development Tasks

## TODO
1. [x] Read codebase
2. [ ] Fix /menu blank page issue (investigate why /menu shows blank)
3. [ ] Admin Reports: Add visual charts (XP ranking bar chart, module progress)
4. [ ] Notifications: Already works (bell icon polling) — verify it's fully functional
5. [ ] Manuals: Add inline PDF viewer (instead of opening new tab)
6. [ ] Common Faults: Search already exists ✅ — skip
7. [ ] Error Codes: Search already exists ✅ — skip
8. [ ] Admin Reports: Add progress chart per trainee

## Analysis
- /menu: Not a real route in app.tsx — after login, trainee lands on "/" (Index/HomePage). 
  The /menu blank might be from old deep link or page persistence restoring a bad route.
  Fix: Add /menu route redirect to "/" OR add a proper menu page.
- XP=0 issue: API works correctly (quiz/submit updates streaks). 
  Test user "test" just hasn't taken any quizzes yet — not a bug.
- Notifications: BellIcon polls every 15s — works. Notifications page exists.
- PDF viewer: manuals.tsx opens PDFs in new tab — need inline viewer.
- Admin Reports charts: No visual charts currently, only text ranking.

## Plan
1. Add /menu redirect → "/" in app.tsx
2. Add bar charts in admin Reports view (pure CSS, no external lib needed)
3. Add inline PDF viewer in manuals.tsx (using <iframe> or <embed>)
