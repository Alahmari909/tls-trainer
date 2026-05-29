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
    nav_home:      'الرئيسية',
    nav_modules:   'الوحدات',
    nav_badges:    'الشارات',
    nav_quiz:      'اختبار',
    nav_card:      'الهوية',

    // ── Common ──────────────────────────────────────────────────────────────
    loading:       'جاري التحميل...',
    back:          'رجوع →',
    logout:        'تسجيل الخروج',
    system_active: 'النظام نشط',
    level:         'مستوى',

    // ── Dashboard ───────────────────────────────────────────────────────────
    quick_access:        'وصول سريع',
    training_modules:    'وحدات التدريب',
    recent_activity:     'النشاط الأخير',
    view_all_modules:    'عرض جميع الوحدات التسع ←',
    streak:              'تتابع',
    xp:                  'نقاط',
    modules:             'وحدات',
    progress:            'التقدم',
    tls_basic:           'أساسيات TLS',
    manuals:             'الأدلة',
    live_status:         'الحالة المباشرة',
    chat:                'المحادثة',

    // ── Register / Login ────────────────────────────────────────────────────
    new_trainee:         'متدرب جديد',
    login:               'تسجيل الدخول',
    select_trainee:      'اختر المتدرب',
    full_name:           'الاسم الكامل *',
    rank:                'الرتبة',
    unit:                'الوحدة / القسم',
    pin_label:           'رمز PIN * (4 أرقام)',
    pin_placeholder:     'أدخل رمز PIN من 4 أرقام',
    begin_training:      'ابدأ التدريب',
    registering:         'جاري التسجيل...',
    signing_in:          'جاري الدخول...',
    select_name:         'اختر اسمك',
    pin_if_set:          'رمز PIN (إن وُجد)',
    pin_empty:           'اتركه فارغاً إن لم يكن هناك رمز',
    no_trainees:         'لا يوجد متدربون مسجلون بعد',
    sign_in:             'دخول',
    create_account:      'إنشاء حساب جديد',
    or_existing:         'أو اختر متدرباً موجوداً',
    select_to_login:     'اختر للدخول',
    registered_on:       'تسجيل',

    // ── Modules ─────────────────────────────────────────────────────────────
    modules_title:       'وحدات التدريب',
    pdf_manual:          'الدليل PDF',
    start_quiz:          'ابدأ الاختبار',
    lessons:             'دروس',
    open_manual:         'فتح الدليل',
    not_available:       'غير متاح',
    introduction:        'مقدمة',
    overview:            'نظرة عامة',
    installation:        'التركيب',
    operation:           'التشغيل',
    calibration:         'المعايرة',
    maintenance:         'الصيانة',
    deployment:          'النقل والتوزيع',
    packing:             'تعليمات التعبئة',
    atc_guide:           'دليل المراقبة الجوية',

    // ── Quiz ────────────────────────────────────────────────────────────────
    question_label:      'السؤال',
    next_question:       'السؤال التالي ←',
    submit_quiz:         'إرسال الاختبار ←',
    quiz_submitted:      'تم إرسال الاختبار',
    submitted_msg:       'تم تسجيل إجاباتك. سيراجع المشرف نتائجك ويشاركها معك.',
    all_quizzes:         'جميع الاختبارات →',
    quiz_list_title:     'اختر وحدة الاختبار',
    quiz_completed_label:'تم الاختبار',
    request_retake:      'طلب إعادة الاختبار',
    retake_requesting:   'جاري الإرسال...',
    retake_sent:         '✓ تم إرسال الطلب',
    retake_pending_msg:  'طلب الإعادة قيد مراجعة المشرف.',
    retake_denied_msg:   'تم رفض طلب الإعادة. تواصل مع مشرفك.',
    retake_locked_msg:   'أكملت هذا الاختبار مسبقاً. اطلب الإعادة للمحاولة مجدداً.',
    time_up:             'انتهى الوقت',

    // ── Settings ────────────────────────────────────────────────────────────
    settings_title:      'الإعدادات',
    language_section:    'اللغة',
    english:             'English',
    arabic:              'العربية',
    appearance_section:  'المظهر',
    sound_section:       'الصوت والتنبيهات',
    sound_effects:       'المؤثرات الصوتية',
    sound_effects_desc:  'تشغيل أصوات في الاختبارات',
    notification_sound:  'صوت الإشعارات',
    notification_desc:   'تشغيل نغمة عند رسائل المشرف',
    vibration:           'الاهتزاز',
    vibration_desc:      'اهتزاز عند التنبيهات',
    profile_section:     'الملف الشخصي',
    save_profile:        'حفظ الملف',
    saving:              'جاري الحفظ...',
    edit_profile:        'تعديل الملف',
    cancel:              'إلغاء',

    // ── Manuals ─────────────────────────────────────────────────────────────
    manuals_title:       'أدلة TLS',
    reference_docs:      'المستندات المرجعية',

    // ── Achievements ────────────────────────────────────────────────────────
    achievements_title:  'الإنجازات',
    earned:              'محقق',
    locked:              'مقفل',

    // ── Notifications ───────────────────────────────────────────────────────
    notifications_title: 'الإشعارات',
    no_notifications:    'لا توجد إشعارات بعد',

    // ── Chat ────────────────────────────────────────────────────────────────
    chat_title:          'المحادثة التكتيكية',
  },
} as const;

export type TranslationKey = keyof typeof translations.en;
