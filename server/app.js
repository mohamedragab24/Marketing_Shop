import express from 'express';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT; // JSON كامل في متغير بيئة، لا يُرفع للمستودع أبدًا
  initializeApp({
    credential: sa ? cert(JSON.parse(sa)) : applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || 'studio-1284053768-822ae',
  });
}
const db = getFirestore();
const ORDER_STATUSES = ['new', 'reviewing', 'confirmed', 'preparing', 'shipped', 'completed', 'cancelled'];
const err = (status, message) => Object.assign(new Error(message), { status });
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const notif = (uid, type, text) => [db.collection('notifications').doc(), { uid, type, text, read: false, createdAt: FieldValue.serverTimestamp() }];

// يتحقق من توكن Firebase ثم من الدور المخزّن في Firestore (وليس من الواجهة)
const auth = (...roles) => wrap(async (req, _res, ) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) throw err(401, 'يجب تسجيل الدخول');
  const decoded = await getAuth().verifyIdToken(token).catch(() => { throw err(401, 'جلسة غير صالحة'); });
  const snap = await db.collection('users').doc(decoded.uid).get();
  req.uid = decoded.uid;
  req.user = snap.exists ? snap.data() : null;
  if (roles.length && (!req.user || !roles.includes(req.user.role))) throw err(403, 'ليست لديك صلاحية');
});
const guard = (...roles) => async (req, res, next) => { try { await auth(...roles)(req, res, (e) => { if (e) throw e; }); next(); } catch (e) { next(e); } };

function cleanProduct(b) {
  const price = Number(b.price), stock = Number(b.stock);
  const discountPrice = b.discountPrice ? Number(b.discountPrice) : null;
  if (!String(b.name || '').trim() || String(b.name).length > 150) throw err(400, 'اسم المنتج مطلوب');
  if (!(price > 0)) throw err(400, 'السعر غير صحيح');
  if (!Number.isInteger(stock) || stock < 0) throw err(400, 'الكمية غير صحيحة');
  if (discountPrice !== null && !(discountPrice > 0 && discountPrice < price)) throw err(400, 'سعر الخصم يجب أن يكون أقل من السعر');
  if (!String(b.category || '').trim()) throw err(400, 'التصنيف مطلوب');
  return {
    name: String(b.name).trim(), price, discountPrice, stock, category: String(b.category).trim(),
    brand: String(b.brand || '').slice(0, 80), description: String(b.description || '').slice(0, 5000),
    specs: String(b.specs || '').slice(0, 3000), keywords: Array.isArray(b.keywords) ? b.keywords.slice(0, 20).map(String) : [],
    images: Array.isArray(b.images) ? b.images.filter((u) => /^https:\/\//.test(u)).slice(0, 8) : [],
    weight: String(b.weight || ''), dimensions: String(b.dimensions || ''), origin: String(b.origin || ''),
    returnPolicy: String(b.returnPolicy || '').slice(0, 1000),
  };
}

export const app = express();
app.use(express.json({ limit: '200kb' }));

app.post('/api/register', guard(), wrap(async (req, res) => {
  if (req.user) throw err(409, 'الحساب موجود مسبقًا');
  const { role, name, phone, storeName } = req.body;
  if (!['buyer', 'seller'].includes(role)) throw err(400, 'نوع الحساب غير صحيح'); // admin لا يُنشأ من الواجهة
  if (!String(name || '').trim()) throw err(400, 'الاسم مطلوب');
  const batch = db.batch();
  batch.set(db.collection('users').doc(req.uid), { name: String(name).trim(), phone: String(phone || ''), role, createdAt: FieldValue.serverTimestamp() });
  if (role === 'seller') batch.set(db.collection('sellers').doc(req.uid), { storeName: String(storeName || name).trim() });
  batch.set(...notif(req.uid, 'welcome', 'تم إنشاء حسابك بنجاح'));
  await batch.commit();
  res.status(201).json({ role });
}));

app.get('/api/me', guard(), (req, res) => res.json({ uid: req.uid, ...req.user }));

app.get('/api/products', wrap(async (req, res) => {
  const { q = '', category, min, max } = req.query;
  const snap = await db.collection('products').where('status', '==', 'published').get();
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => {
    const price = p.discountPrice || p.price;
    return (!category || p.category === category) && (!min || price >= +min) && (!max || price <= +max)
      && (!q || p.name.includes(q) || p.keywords?.some((k) => k.includes(q)));
  });
  res.json(list);
}));

app.post('/api/products', guard('seller'), wrap(async (req, res) => {
  const data = cleanProduct(req.body);
  const wantsPublish = req.body.publish === true;
  const status = !wantsPublish ? 'draft' : process.env.REQUIRE_REVIEW === 'true' ? 'pending' : 'published';
  const ref = await db.collection('products').add({ ...data, sellerId: req.uid, status, views: 0, sales: 0, createdAt: FieldValue.serverTimestamp() });
  const [r, d] = notif(req.uid, 'product', status === 'published' ? 'تم نشر المنتج' : status === 'pending' ? 'المنتج قيد المراجعة' : 'تم حفظ المسودة');
  await r.set(d);
  res.status(201).json({ id: ref.id, status });
}));

async function ownProduct(req) {
  const ref = db.collection('products').doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) throw err(404, 'المنتج غير موجود');
  if (req.user.role !== 'admin' && snap.data().sellerId !== req.uid) throw err(403, 'لا يمكنك تعديل منتجات بائع آخر');
  return ref;
}
app.put('/api/products/:id', guard('seller', 'admin'), wrap(async (req, res) => {
  const ref = await ownProduct(req);
  await ref.update({ ...cleanProduct(req.body), updatedAt: FieldValue.serverTimestamp() });
  res.json({ ok: true });
}));
app.delete('/api/products/:id', guard('seller', 'admin'), wrap(async (req, res) => {
  await (await ownProduct(req)).delete();
  res.json({ ok: true });
}));
app.patch('/api/products/:id/review', guard('admin'), wrap(async (req, res) => {
  const ref = db.collection('products').doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) throw err(404, 'المنتج غير موجود');
  const approve = req.body.approve === true;
  await ref.update({ status: approve ? 'published' : 'rejected' });
  const [r, d] = notif(snap.data().sellerId, 'review', approve ? 'تم قبول منتجك ونشره' : 'تم رفض منتجك');
  await r.set(d);
  res.json({ ok: true });
}));

app.post('/api/orders', guard('buyer'), wrap(async (req, res) => {
  const { address, paymentMethod } = req.body;
  if (!['cod', 'card_sim'].includes(paymentMethod)) throw err(400, 'طريقة الدفع غير صحيحة'); // لا نستقبل أرقام بطاقات أبدًا
  if (!address?.name || !address?.phone || !address?.line) throw err(400, 'بيانات التوصيل ناقصة');
  const merged = new Map();
  for (const i of req.body.items || []) {
    const qty = Number(i.qty);
    if (!i.productId || !Number.isInteger(qty) || qty < 1 || qty > 50) throw err(400, 'عنصر غير صحيح في السلة');
    merged.set(i.productId, (merged.get(i.productId) || 0) + qty);
  }
  if (!merged.size) throw err(400, 'السلة فارغة');
  const orderRef = db.collection('orders').doc();
  const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${orderRef.id.slice(0, 4).toUpperCase()}`;
  let total = 0;
  await db.runTransaction(async (t) => {
    total = 0;
    const entries = [...merged];
    const refs = entries.map(([id]) => db.collection('products').doc(id));
    const snaps = await Promise.all(refs.map((r) => t.get(r)));
    const items = snaps.map((s, k) => {
      const p = s.data(), qty = entries[k][1];
      if (!s.exists || p.status !== 'published') throw err(400, 'منتج غير متاح');
      if (p.stock < qty) throw err(400, `الكمية غير كافية: ${p.name}`); // السعر يُحسب من الخادم لا من العميل
      const price = p.discountPrice || p.price;
      total += price * qty;
      return { productId: s.id, sellerId: p.sellerId, name: p.name, qty, price, listPrice: p.price };
    });
    const sellerIds = [...new Set(items.map((i) => i.sellerId))];
    items.forEach((i, k) => t.update(refs[k], { stock: FieldValue.increment(-i.qty), sales: FieldValue.increment(i.qty) }));
    t.set(orderRef, { orderNumber, buyerId: req.uid, buyerName: req.user.name, items, sellerIds, address, paymentMethod, total, status: 'new', createdAt: FieldValue.serverTimestamp() });
    t.set(db.collection('payments').doc(), { orderId: orderRef.id, method: paymentMethod, amount: total, status: paymentMethod === 'card_sim' ? 'simulated_paid' : 'pending_cod', createdAt: FieldValue.serverTimestamp() });
    t.set(...notif(req.uid, 'order', `تم تأكيد طلبك ${orderNumber}`));
    sellerIds.forEach((s) => t.set(...notif(s, 'order', `طلب جديد ${orderNumber}`)));
  });
  res.status(201).json({ id: orderRef.id, orderNumber, total });
}));

app.get('/api/orders', guard('buyer', 'seller', 'admin'), wrap(async (req, res) => {
  const col = db.collection('orders'), role = req.user.role;
  const q = role === 'buyer' ? col.where('buyerId', '==', req.uid) : role === 'seller' ? col.where('sellerIds', 'array-contains', req.uid) : col;
  const snap = await q.get();
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  // البائع يرى بنود منتجاته فقط
  if (role === 'seller') list.forEach((o) => { o.items = o.items.filter((i) => i.sellerId === req.uid); });
  res.json(list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
}));

app.patch('/api/orders/:id/status', guard('seller', 'admin'), wrap(async (req, res) => {
  if (!ORDER_STATUSES.includes(req.body.status)) throw err(400, 'حالة غير صحيحة');
  const ref = db.collection('orders').doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) throw err(404, 'الطلب غير موجود');
  const o = snap.data();
  if (req.user.role === 'seller' && !o.sellerIds.includes(req.uid)) throw err(403, 'ليس طلبًا لمنتجاتك');
  await ref.update({ status: req.body.status });
  const [r, d] = notif(o.buyerId, 'order', `تغيّرت حالة طلبك ${o.orderNumber}`);
  await r.set(d);
  res.json({ ok: true });
}));

app.use('/api', (_req, _res, next) => next(err(404, 'المسار غير موجود')));
app.use((e, _req, res, _next) => {
  if (!e.status) console.error(e);
  res.status(e.status || 500).json({ error: e.status ? e.message : 'خطأ في الخادم' });
});
