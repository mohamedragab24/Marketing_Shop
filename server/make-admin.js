// الاستخدام: node server/make-admin.js email@example.com  (الحساب يجب أن يكون مسجّلًا في Firebase Auth)
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import './app.js';
const user = await getAuth().getUserByEmail(process.argv[2]);
await getFirestore().collection('users').doc(user.uid).set({ name: user.displayName || 'Admin', role: 'admin', createdAt: FieldValue.serverTimestamp() }, { merge: true });
console.log('تم تعيين المدير:', user.uid);
process.exit(0);
