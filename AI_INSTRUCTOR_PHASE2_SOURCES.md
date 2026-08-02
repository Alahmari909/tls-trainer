# تقرير موقع الملفات الأصلية (المصادر) — قبل أي تعديل

**الفرع:** `ai-instructor-v2`
**التاريخ:** 2026-08-02
**نطاق هذا التقرير:** تحديد موقع تخزين الملفات الأصلية فقط. **لم يتم تعديل أي كود، ولا الواجهة، ولا البرومبت، ولا الموديل، ولا نشر، ولا دمج.**

---

## 1. النتيجة المختصرة

**تم العثور على كل المصادر. الكتيبات M1–M9 موجودة كاملة داخل المستودع نفسه.**

| | |
|---|---|
| عدد المصادر المفهرسة في `ai_doc_chunks` | **43** |
| مصادر لها ملف أصلي متاح الآن | **43 (100%)** |
| مصادر مفقودة | **0** |

> **تصحيح مهم لاستنتاج سابق:** في المرحلة الأولى استنتجتُ أن الكتيبات `m1`–`m9` غير قابلة لإعادة الاستخراج. **هذا الاستنتاج خاطئ.** السبب أنني بحثت في `packages/web/public/` و `packages/web/src/` فقط، بينما الملفات الكبيرة (PDF + صور الصفحات) تُخزَّن في مجلد مختلف تمامًا: **`packages/web/static/`**.

---

## 2. أماكن التخزين الثلاثة

| # | المسار / المكان | المحتوى | يُخدَم على |
|---|---|---|---|
| **A** | `packages/web/static/pdfs/` | **9 كتيبات رسمية** = M1–M9 (ملفات PDF أصلية) | `/pdfs/<file>.pdf` |
| **B** | `packages/web/static/admin-docs/` | 41 PDF + 1 PPTX (نسخ من مستندات الأدمن) | ثابت |
| **C** | جدول `document_files` في Turso | 35 صفًّا فيها بايتات PDF حقيقية (base64) لمستندات الأدمن | `/api/doc-page/<id>/<page>` |
| **D** | `packages/web/static/doc-pages/` | **871 صورة صفحة** جاهزة في 40 مجلدًا (`m1`–`m9`, `d25`–`d65`) | `/doc-pages/<id>/pXXX.jpg` |
| **E** | `packages/web/public/slides/` | 145 صورة سلايد | `/slides/pXXX.jpg` |

**كود الخدمة:** `packages/web/src/server.ts:56` — الخادم يبحث أولًا في `dist`، ثم في `static/` للملفات الكبيرة (PDF + المكوّنات). ولهذا كانت الصور تُخدَم `200` في الإنتاج بينما لم أجد المجلد في `public/`.

**كود الفهرسة:** `packages/web/src/api/index.ts:3438–3445` — مسار `POST /admin/ai/index-pdfs` يقرأ من مجلدين فقط:
- `static/admin-docs`
- `static/pdfs`

---

## 3. خريطة M1–M9 (مؤكَّدة بمطابقة عدد الصفحات)

كل كتيب: عدد صفحات ملف PDF على القرص = عدد صور الصفحات في `doc-pages` = عدد الصفحات في قاعدة البيانات. **تطابق 100%.**

| ID | العنوان في التطبيق | ملف PDF الأصلي (`static/pdfs/`) | الحجم | صفحات PDF | صور `doc-pages/` | صفحات في DB | Chunks |
|---|---|---|---|---|---|---|---|
| **m1** | TLS ANPC English (Introduction) | `TLS_ANPC_English.pdf` | 4.9 MB | 5 | 5 | 5 | 5 |
| **m2** | TLS Training June 2021 KSA (Overview) | `TLS_Training_June_2021_KSA.pdf` | 6.6 MB | 134 | 134 | 134 | 134 |
| **m3** | 020-00073 Rev F — Installation | `020-00073_RevF.pdf` | 3.9 MB | 87 | 87 | 87 | 87 |
| **m4** | 020-00072 Rev F — Operation | `020-00072_RevF.pdf` | 19.4 MB | 84 | 84 | 84 | 84 |
| **m5** | 020-00071 Rev E — Calibration | `020-00071_RevE.pdf` | 1.4 MB | 47 | 47 | 47 | 47 |
| **m6** | 020-00074 Rev G — Maintenance | `020-00074_RevG.pdf` | 5.0 MB | 153 | 153 | 153 | 153 |
| **m7** | 020-00076 Rev D — Container & Deployment | `020-00076_RevD.pdf` | 13.1 MB | 50 | 50 | 50 | 50 |
| **m8** | 020-00077 Rev C — Packing Instructions | `020-00077_RevC.pdf` | 7.3 MB | 65 | 65 | 65 | 65 |
| **m9** | ATC Quick Guide TLS | `ATC_quick_guide_TLS.pdf` | 0.36 MB | 2 | 2 | 2 | 4 |
| | **المجموع** | **9 ملفات** | **62.0 MB** | **627** | **627** | **627** | **629** |

**مصدر التعريف في الكود:** `packages/web/src/web/pages/manuals.tsx:16–26` (مصفوفة `MANUALS`، الحقل `file`)، والفتح عبر `window.open('/pdfs/' + manual.file)` في السطر 120.

**دليل ربط إضافي:** الجواب الصحيح المُتحقَّق منه سابقًا (المسافة بين ATA و ASA) كان يستشهد بـ `020-00073 Rev F، صفحة 11` ويعرض `/doc-pages/m3/p011.jpg` — والملف موجود فعليًا على القرص: `packages/web/static/doc-pages/m3/p011.jpg`، حجم 208,279 بايت، أبعاد 1300×1683، سطوع طبيعي (ليست صفحة بيضاء). ✅

---

## 4. باقي المصادر (34 مصدرًا)

كلها لها بايتات PDF أصلية في `document_files` — **لا يوجد مفقود**:

| doc_id | الملف الأصلي | بايتات (base64) |
|---|---|---|
| 25 | `TLS_System_Overview_EN_XdDZEY.pdf` | 7,602,700 |
| 28 | `TLS_all_four_Palau_RWY9_(1)_JA6-eo.pdf` | 2,342,164 |
| 29 | `020-00089_RevA_Ss6ib-.pdf` | 5,709,232 |
| 32 | `8D7799AD-C01F-4EC9-8AB9-E6C3E8B23537_Vc1Yf8.pdf` | 5,318,160 |
| 33 | `B26FC8A9-237C-4A2B-A3C1-BCBC9CC6A897_x9tQEs.pdf` | 2,173,052 |
| 35 | `Calibration_Procedure_PQD-Zg.pdf` | 1,422,228 |
| 36 | `Application_of_the_TLS_to_Achieve_Airport_Accessibility_Y4HusN.pdf` | 940,568 |
| 37 | `TLS_Preliminary_Guide_gyH-Pw.pdf` | 738,416 |
| 38 | `Survey_procedure_sWQ5M1.pdf` | 1,032,012 |
| 39 | `Extracted_3333333333_XOJpCr.pdf` | 1,011,628 |
| 40 | `FTM___Checklists44444444_64-t6u.pdf` | 693,956 |
| 42 | `Att.-B-FAA-8200.47-Transponder-Landing-System_KX697D.pdf` | 1,279,240 |
| 43 | `GetAtt.html_rHz4zv.pdf` | 742,192 |
| 44 | `GTU_Program55555555_74mZkW.pdf` | 1,892,080 |
| 45 | `patria-anpc-a4-brochure-0124pdf_HJOevD.pdf` | 638,984 |
| 46 | `ATC_quick_guide_TLS_V2XMt-.pdf` | 481,808 |
| 48 | `Setting_Pulse_in_the_frame_wDGg3M.pdf` | 566,016 |
| 49 | `Extracted_pages_from_020-00103_Rev_B_dnf_mZ.pdf` | 331,152 |
| 51 | `خطوات_مسح_موقع_جهاز_الثيودوليت_3M8mdS.pdf` | 604,920 |
| 52 | `Pre-Calibration_Procedure_bm2wH6.pdf` | 358,552 |
| 54 | `Setting_Monitor_Limits_and_computing_nominals_jQCTke.pdf` | 669,868 |
| 55 | `TLS_Antenna_System_Advantages_AllHeadersWhite_UqYnEl.pdf` | 7,976 |
| 56 | `transponder-landing-system-material-2_bONCvb.pptx` | 83,508 |
| 57 | `Input_survey_111111111_EVbIGM.pdf` | 278,688 |
| 58 | `020-00098_Rev_B_dhymJt.pdf` | 228,324 |
| 59 | `Transponder_Landing_System_Flight_Inspection_2Rvqwg.pdf` | 318,480 |
| 60 | `FTM_Theodolite_Survey_and_Calibration_94dcKy.pdf` | 7,032 |
| 61 | `Input_survey_data_procedure_0FsOCf.pdf` | 278,688 |
| 62 | `GTU_setup_phE3iT.pdf` | 277,136 |
| 64 | `TLS_Approach_Guidance.._lY1mbL.pdf` | 279,888 |
| 65 | `DME_TLS_Report_Clean_DVfX_M.pdf` | 3,260 |
| **70** | `TLS_Training_Slides_compressed.pdf` (145 سلايد) | 23,124,472 |
| **71** | `300-00038-RevD-1.pdf` (TLS Flight Inspection Procedure) | 1,179,384 |
| **72** | `Frequently Asked Questions TLS/TTLS...pdf` | 565,964 |

---

## 5. ملاحظات مهمة اكتُشفت أثناء البحث

1. **تكرار:** `ATC Quick Guide TLS` مفهرس **مرتين** — مرة كـ `m9` (من `static/pdfs`) ومرة كـ `d46` (من قاعدة البيانات). هذا يسبب نتائج مكرّرة في البحث.
2. **مستند بلا فهرسة:** `document_files` رقم **69** = `TLS_Training_Slides.pdf` بحجم 32.4 MB، **ليس له أي chunks**. السبب: حد الحجم `30 MB` في `index.ts:3459`. النسخة المضغوطة منه (doc 70, 23 MB) هي المفهرسة فعليًا.
3. **صفٌّ ناقص:** `doc_id = 72` له chunks وله بايتات في `document_files`، لكن **لا يوجد له صف في جدول `documents`**.
4. **`documents.file_data` فارغ (0 بايت) لكل الصفوف** — البايتات الحقيقية في `document_files` فقط.
5. **ثلاث أنماط لمسارات الصور** (غير موحّدة) — وهذا من أسباب مشكلة الصور الخاطئة:
   - `/doc-pages/<id>/pXXX.jpg` → ملف ثابت في `static/doc-pages/` (40 مصدرًا، 871 صورة)
   - `/slides/pXXX.jpg` → ملف ثابت في `public/slides/` (145 صورة، doc 70)
   - `/api/doc-page/<docId>/<page>` → مُولَّد من قاعدة البيانات (docs 71, 72)
6. **صور الصفحات كلها متعقَّبة في Git** — 871 صورة + 9 ملفات PDF، لا شيء منها في `.gitignore`.
7. **`static/admin-docs/` فيه 42 ملفًا** بأسماء أصلية نظيفة، وهي نسخ من نفس مستندات قاعدة البيانات (بأسماء بلا لواحق عشوائية). يمكن استخدامها كبديل أنظف لإعادة الاستخراج.

---

## 6. الخلاصة: إعادة البناء ممكنة بالكامل

| المتطلب | الحالة |
|---|---|
| إعادة استخراج النص من كل PDF بأعلى جودة | ✅ ممكن — كل الـ43 مصدرًا متاح |
| ربط كل chunk بـ (اسم الملف + رقم الصفحة الحقيقي) | ✅ ممكن — الترقيم متطابق 1:1 مع ملفات PDF |
| إصلاح الصور بربطها بـ (اسم الملف + الصفحة) | ✅ ممكن — 871 صورة صفحة موجودة ومطابقة |
| استخراج أسماء الفصول/الأقسام | ✅ ممكن — يحتاج عمود جديد في `ai_doc_chunks` |

**لا يوجد أي عائق في المصادر. جاهز للانتقال لتنفيذ إعادة البناء عند موافقتك.**

---

## 7. حالة الفرع الآن

| | |
|---|---|
| الفرع الحالي | `ai-instructor-v2` |
| `main` | لم يُلمَس — عند `e788301` |
| نشر Railway | ❌ لم يحدث |
| دمج | ❌ لم يحدث |
| تعديل واجهة / برومبت / موديل | ❌ لم يحدث |
| تعديل غير مُودَع (uncommitted) | `packages/web/src/api/index.ts` — حارس رفض OCR من الجلسة السابقة (لم يُودَع، ولا يمسّ الواجهة أو البرومبت). يمكن الاحتفاظ به أو التراجع عنه بأمر واحد. |
