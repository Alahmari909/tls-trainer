// ── TLS Trainer — UI Translations ─────────────────────────────────────────────
// Arabic (ar) and English (en) strings for the trainee-facing interface.
// Component names (ASA, ESA, ATA, GTU, etc.) are NOT translated — they stay
// in English as technical identifiers.

export type Lang = 'en' | 'ar';

export const translations = {
  en: {
    // ── Navigation ──────────────────────────────────────────────────────────
    nav_home:      'HOME',
    nav_modules:   'MODULES',
    nav_badges:    'BADGES',
    nav_quiz:      'QUIZ',
    nav_card:      'ID CARD',

    // ── Common ──────────────────────────────────────────────────────────────
    loading:       'LOADING...',
    back:          '← BACK',
    logout:        'LOGOUT',
    system_active: 'SYSTEM ACTIVE',
    level:         'LVL',

    // ── Dashboard ───────────────────────────────────────────────────────────
    quick_access:        'QUICK ACCESS',
    training_modules:    'TRAINING MODULES',
    recent_activity:     'RECENT ACTIVITY',
    view_all_modules:    'VIEW ALL 9 MODULES →',
    streak:              'STREAK',
    xp:                  'XP',
    modules:             'MODULES',
    progress:            'PROGRESS',
    tls_basic:           'TLS BASIC',
    manuals:             'MANUALS',
    live_status:         'LIVE STATUS',
    chat:                'CHAT',

    // ── Register / Login ────────────────────────────────────────────────────
    new_trainee:         'NEW TRAINEE',
    login:               'LOGIN',
    select_trainee:      'SELECT TRAINEE',
    full_name:           'FULL NAME *',
    rank:                'RANK',
    unit:                'UNIT / SECTION',
    pin_label:           'PIN * (4 digits)',
    pin_placeholder:     'Enter a 4-digit PIN',
    begin_training:      'BEGIN TRAINING',
    registering:         'REGISTERING...',
    signing_in:          'SIGNING IN...',
    select_name:         'SELECT YOUR NAME',
    pin_if_set:          'PIN (if set)',
    pin_empty:           'Leave empty if no PIN',
    no_trainees:         'No trainees registered yet',
    sign_in:             'SIGN IN',
    create_account:      'CREATE NEW ACCOUNT',
    or_existing:         'OR SELECT EXISTING TRAINEE',
    select_to_login:     'Select to login',
    registered_on:       'Registered',

    // ── Modules ─────────────────────────────────────────────────────────────
    modules_title:       'TRAINING MODULES',
    pdf_manual:          'PDF MANUAL',
    start_quiz:          'START QUIZ',
    lessons:             'LESSONS',
    open_manual:         'OPEN MANUAL',
    not_available:       'Not available',
    introduction:        'Introduction',
    overview:            'Overview',
    installation:        'Installation',
    operation:           'Operation',
    calibration:         'Calibration',
    maintenance:         'Maintenance',
    deployment:          'Container & Deployment',
    packing:             'Packing Instructions',
    atc_guide:           'ATC Quick Guide',

    // ── Quiz ────────────────────────────────────────────────────────────────
    question_label:      'QUESTION',
    next_question:       'NEXT QUESTION →',
    submit_quiz:         'SUBMIT QUIZ →',
    quiz_submitted:      'QUIZ SUBMITTED',
    submitted_msg:       'Your answers have been recorded. Your instructor will review your results and share them with you.',
    all_quizzes:         '← ALL QUIZZES',
    quiz_list_title:     'SELECT MODULE QUIZ',
    quiz_completed_label:'QUIZ COMPLETED',
    request_retake:      'REQUEST RETAKE',
    retake_requesting:   'SENDING...',
    retake_sent:         '✓ REQUEST SENT',
    retake_pending_msg:  'Your retake request is pending instructor approval.',
    retake_denied_msg:   'Your retake request was denied. Contact your instructor.',
    retake_locked_msg:   'You have already completed this quiz. Request a retake to attempt it again.',
    time_up:             'TIME\'S UP',

    // ── Settings ────────────────────────────────────────────────────────────
    settings_title:      'SETTINGS',
    language_section:    'LANGUAGE',
    english:             'English',
    arabic:              'العربية',
    appearance_section:  'APPEARANCE',
    sound_section:       'SOUND & FEEDBACK',
    sound_effects:       'Sound Effects',
    sound_effects_desc:  'Play tones on quiz answers',
    notification_sound:  'Notification Sound',
    notification_desc:   'Play alert tone on instructor messages',
    vibration:           'Vibration',
    vibration_desc:      'Vibrate on alerts',
    profile_section:     'PROFILE',
    save_profile:        'SAVE PROFILE',
    saving:              'SAVING...',
    edit_profile:        'EDIT PROFILE',
    cancel:              'CANCEL',

    // ── Manuals ─────────────────────────────────────────────────────────────
    manuals_title:       'TLS MANUALS',
    reference_docs:      'REFERENCE DOCUMENTS',

    // ── Achievements ────────────────────────────────────────────────────────
    achievements_title:  'ACHIEVEMENTS',
    earned:              'EARNED',
    locked:              'LOCKED',

    // ── Notifications ───────────────────────────────────────────────────────
    notifications_title: 'NOTIFICATIONS',
    no_notifications:    'No notifications yet',

    // ── Chat ────────────────────────────────────────────────────────────────
    chat_title:          'TACTICAL CHAT',
  },

  ar: {
    // ── Navigation ──────────────────────────────────────────────────────────
    nav_home:      'HOME',
    nav_modules:   'MODULES',
    nav_badges:    'BADGES',
    nav_quiz:      'QUIZ',
    nav_card:      'ID CARD',

    // ── Common ──────────────────────────────────────────────────────────────
    loading:       'LOADING...',
    back:          '← BACK',
    logout:        'LOGOUT',
    system_active: 'SYSTEM ACTIVE',
    level:         'LVL',

    // ── Dashboard ───────────────────────────────────────────────────────────
    quick_access:        'QUICK ACCESS',
    training_modules:    'TRAINING MODULES',
    recent_activity:     'RECENT ACTIVITY',
    view_all_modules:    'VIEW ALL 9 MODULES →',
    streak:              'STREAK',
    xp:                  'XP',
    modules:             'MODULES',
    progress:            'PROGRESS',
    tls_basic:           'TLS BASIC',
    manuals:             'MANUALS',
    live_status:         'LIVE STATUS',
    chat:                'CHAT',

    // ── Register / Login ────────────────────────────────────────────────────
    new_trainee:         'NEW TRAINEE',
    login:               'LOGIN',
    select_trainee:      'SELECT TRAINEE',
    full_name:           'FULL NAME *',
    rank:                'RANK',
    unit:                'UNIT / SECTION',
    pin_label:           'PIN * (4 digits)',
    pin_placeholder:     'Enter a 4-digit PIN',
    begin_training:      'BEGIN TRAINING',
    registering:         'REGISTERING...',
    signing_in:          'SIGNING IN...',
    select_name:         'SELECT YOUR NAME',
    pin_if_set:          'PIN (if set)',
    pin_empty:           'Leave empty if no PIN',
    no_trainees:         'No trainees registered yet',
    sign_in:             'SIGN IN',
    create_account:      'CREATE NEW ACCOUNT',
    or_existing:         'OR SELECT EXISTING TRAINEE',
    select_to_login:     'Select to login',
    registered_on:       'Registered',

    // ── Modules ─────────────────────────────────────────────────────────────
    modules_title:       'TRAINING MODULES',
    pdf_manual:          'PDF MANUAL',
    start_quiz:          'START QUIZ',
    lessons:             'LESSONS',
    open_manual:         'OPEN MANUAL',
    not_available:       'Not available',
    introduction:        'Introduction',
    overview:            'Overview',
    installation:        'Installation',
    operation:           'Operation',
    calibration:         'Calibration',
    maintenance:         'Maintenance',
    deployment:          'Container & Deployment',
    packing:             'Packing Instructions',
    atc_guide:           'ATC Quick Guide',

    // ── Quiz ────────────────────────────────────────────────────────────────
    question_label:      'QUESTION',
    next_question:       'NEXT QUESTION →',
    submit_quiz:         'SUBMIT QUIZ →',
    quiz_submitted:      'QUIZ SUBMITTED',
    submitted_msg:       'Your answers have been recorded. Your instructor will review your results and share them with you.',
    all_quizzes:         '← ALL QUIZZES',
    quiz_list_title:     'SELECT MODULE QUIZ',
    quiz_completed_label:'QUIZ COMPLETED',
    request_retake:      'REQUEST RETAKE',
    retake_requesting:   'SENDING...',
    retake_sent:         '✓ REQUEST SENT',
    retake_pending_msg:  'Your retake request is pending instructor approval.',
    retake_denied_msg:   'Your retake request was denied. Contact your instructor.',
    retake_locked_msg:   'You have already completed this quiz. Request a retake to attempt it again.',
    time_up:             'TIME\'S UP',

    // ── Settings ────────────────────────────────────────────────────────────
    settings_title:      'SETTINGS',
    language_section:    'LANGUAGE',
    english:             'English',
    arabic:              'العربية',
    appearance_section:  'APPEARANCE',
    sound_section:       'SOUND & FEEDBACK',
    sound_effects:       'Sound Effects',
    sound_effects_desc:  'Play tones on quiz answers',
    notification_sound:  'Notification Sound',
    notification_desc:   'Play alert tone on instructor messages',
    vibration:           'Vibration',
    vibration_desc:      'Vibrate on alerts',
    profile_section:     'PROFILE',
    save_profile:        'SAVE PROFILE',
    saving:              'SAVING...',
    edit_profile:        'EDIT PROFILE',
    cancel:              'CANCEL',

    // ── Manuals ─────────────────────────────────────────────────────────────
    manuals_title:       'TLS MANUALS',
    reference_docs:      'REFERENCE DOCUMENTS',

    // ── Achievements ────────────────────────────────────────────────────────
    achievements_title:  'ACHIEVEMENTS',
    earned:              'EARNED',
    locked:              'LOCKED',

    // ── Notifications ───────────────────────────────────────────────────────
    notifications_title: 'NOTIFICATIONS',
    no_notifications:    'No notifications yet',

    // ── Chat ────────────────────────────────────────────────────────────────
    chat_title:          'TACTICAL CHAT',
  },
} as const;

export type TranslationKey = keyof typeof translations.en;
