# Reporting System Task

## WHAT EXISTS
- trainees table: id, name, rank, unit, created_at, last_login_at, login_count, is_online, last_page, last_active_at, status
- activity_log table: trainee_id, event, detail, page, ts
- quiz_attempts table: trainee_id, module_id, module_name, score, total, correct, wrong, pct, passed, ts
- trainee_module_progress: trainee_id, module_id, module_name, progress, completed, assigned_by_admin
- instructor_notes table: trainee_id, note, author_id, ts
- Admin trainee detail page has: overview, activity, quiz, modules, notes, messages, moderation tabs
- Activity API: POST /activity logs events (module_open, quiz_start, quiz_finish, manual_view, etc.)
- Quiz submit: POST /quiz/attempt saves score

## WHAT'S MISSING

### DB Tables needed:
1. `trainee_evaluations` — rating (Excellent/Good/Weak/Needs Review), recommendation, technical_observations, admin_id, ts
2. `module_time_log` — trainee_id, module_id, module_name, duration_ms, ts (time spent tracking)
3. Add `failed_quizzes` stat computation (already in quiz_attempts where passed=0)
4. `manual_view_log` — trainee_id, manual_name, file, duration_ms, ts

### API endpoints needed:
1. POST /admin/evaluation — save evaluation (rating, recommendation, observations)
2. GET /admin/trainee/:id/evaluation — get evaluation
3. GET /admin/report/:id — full report data for PDF generation
4. POST /activity with time_spent type — track module time
5. POST /manual/view — log manual view with duration

### Frontend: Admin side
1. Add "evaluation" tab to TraineeDetail modal
   - Rating selector: Excellent/Good/Weak/Needs Review
   - Recommendation textarea
   - Technical observations textarea
   - Save button
2. Add "report" tab or export button
   - Generate HTML report → print/save as PDF via browser
   - Include: trainee info, stats, module progress bars, quiz history, evaluation, notes
3. Real-time activity column in trainees list (what they're doing NOW)

### Frontend: Trainee side
1. Trainee can view own report at /card or new /report route
   - Own stats only (no editing)

### Tracking improvements:
1. manuals.tsx: POST /activity when PDF opened (manual_view event)
2. quiz.tsx: already calls /quiz/attempt — add pass/fail Telegram alert
3. modules.tsx/basics.tsx: track module open time → POST time_spent on exit
4. Add heartbeat page tracking (already done via heartbeat page field)

### Telegram alerts needed:
1. module_complete → already partially there
2. quiz pass/fail → send specific pass vs fail message
3. trainee inactive >30min → sweep catches it 
4. training milestone (e.g. 3 modules complete)

## IMPLEMENTATION ORDER
1. DB migrations (new tables)
2. API: evaluation CRUD + report endpoint + time tracking
3. Admin: evaluation tab + export report button (HTML→print PDF)
4. Trainee: activity tracking in manuals.tsx + basics.tsx + modules.tsx
5. Admin list: live activity column
6. Trainee self-report view (status page or card page enhancement)
7. Telegram alert improvements
8. TypeScript check + build verify
