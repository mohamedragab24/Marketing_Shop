# دليل قواعد البيانات

موقع تعليمي عربي متجاوب يشرح نظام إدارة قواعد البيانات، مستوياته الثلاثة، مكوناته، وأدوار مستخدميه. يتضمن تمرين SQL محلياً، وحفظ تقدم القراءة اختيارياً في Firebase.

## المتطلبات والتشغيل

يحتاج المشروع إلى Node.js 24.12 أو أحدث وnpm. يستخدم النشر على Vercel إصدار Node.js 26.x المتاح حالياً. من مجلد المشروع شغّل:

```bash
npm install
npm run dev
```

ستعمل المعاينة على `http://localhost:3000`. لبناء نسخة النشر محلياً:

```bash
npm run build
```

تظهر الملفات النهائية في مجلد `dist/`، ويجيب المسار `/api/health` عن حالة API محلياً.

## الرفع إلى Vercel

بعد فك ضغط ZIP، افتح الطرفية داخل مجلد المشروع وسجّل الدخول إلى Vercel CLI عند الحاجة، ثم نفّذ:

```bash
npx vercel
```

وللنشر الإنتاجي بعد ربط المشروع بحسابك:

```bash
npx vercel --prod
```

يقرأ Vercel ملف `vercel.json`، وينفّذ `npm install` ثم `npm run build`، ويقدّم محتويات `dist/`، كما ينشر دالة Node.js من `api/health.js` على `/api/health`. ويمكن بدلاً من CLI رفع مجلد المشروع إلى مستودع Git وربطه من لوحة Vercel. لا تحتاج إلى تغيير مجلد الإخراج أو أمر البناء يدوياً.

## تفعيل مزامنة Firebase

الموقع يعمل دون Firebase؛ ويحتفظ بتقدم القراءة محلياً. لتفعيل المزامنة السحابية، افتح مشروع Firebase المضمّن في `src/firebase.js`، وأنشئ قاعدة Cloud Firestore، ثم فعّل **Anonymous** ضمن **Authentication → Sign-in method**. أضف نطاق موقع Vercel إلى النطاقات المسموح بها في Firebase Authentication، وبعدها انشر القواعد المرفقة:

```bash
npx firebase-tools deploy --only firestore:rules --project studio-1284053768-822ae
```

يحتاج الأمر إلى تسجيل الدخول عبر Firebase CLI وربط المشروع. القواعد الموجودة في `firestore.rules` لا تسمح للمستخدم بقراءة أو تعديل تقدم مستخدم آخر. إعداد Web API Key الظاهر في الشيفرة الأمامية مُعرّف تطبيق عام؛ لا تستخدمه كوسيلة حماية، واعتمد على قواعد Firestore ومزوّد المصادقة. لا تضف مفاتيح Admin أو أسراراً إلى ملفات الواجهة.

## الملفات المهمة

- `index.html` و`src/`: محتوى الموقع وتفاعلاته.
- `src/firebase.js`: إعداد Firebase ومزامنة التقدم.
- `api/health.js`: نقطة فحص Node.js على Vercel.
- `firestore.rules` و`firebase.json`: قواعد وتهيئة Firebase CLI.
- `vercel.json`: أمر البناء ومجلد الإخراج.


## المتجر (app.html) والـ API

- `npm run server` يشغّل Express على المنفذ 4000 (يتطلب `.env`: راجع `.env.example`) مع `npm run dev` للواجهة (تمرر /api تلقائيًا).
- على Vercel أضف `FIREBASE_SERVICE_ACCOUNT` و`REQUIRE_REVIEW`.
- لتعيين مدير: `npm run make-admin -- email@example.com`.
- انشر القواعد: `npx firebase-tools deploy --only firestore:rules --project studio-1284053768-822ae`.

- الصور تُصغَّر في المتصفح وتُحفظ داخل Firestore (بدون Cloud Storage/Blaze).
- بيانات تجريبية: `npm run seed` أو زر «تحميل منتجات وأقسام تجريبية» في لوحة المدير.
- تشخيص الأخطاء: افتح `/api/diag`.
