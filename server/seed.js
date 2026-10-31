// الاستخدام: npm run seed  (يتطلب .env محليًا). يمكن أيضًا الضغط على زر البيانات التجريبية في لوحة المدير.
import { getFirestore } from 'firebase-admin/firestore';
import './app.js';
import { seed } from './seed-data.js';
console.log('تم:', await seed(getFirestore()));
process.exit(0);
