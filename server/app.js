import express from 'express';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { seed } from './seed-data.js';

let initError = null;
if (!getApps().length) {
  try {
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT; // JSON كامل من Firebase Console > Service accounts
    initializeApp({ credential: sa ? cert(JSON.parse(sa)) : applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID || 'studio-1284053768-822ae' });
  } catch (e) { initError = e; }
}
const db = initError ? null : getFirestore();
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
  if (req.user?.blocked) throw err(403, 'الحساب موقوف');
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
    images: Array.isArray(b.images) ? b.images.filter((u) => typeof u === 'string' && u.length < 200000 && /^(https:\/\/|data:image\/(jpeg|png|webp);base64,)/.test(u)).slice(0, 4) : [],
    weight: String(b.weight || ''), dimensions: String(b.dimensions || ''), origin: String(b.origin || ''),
    returnPolicy: String(b.returnPolicy || '').slice(0, 1000),
  };
}

export const app = express();
app.use(express.json({ limit: '1mb' }));
app.get('/api/diag', async (_q, res) => {
  const out = { serviceAccountEnv: !!process.env.FIREBASE_SERVICE_ACCOUNT, projectId: process.env.FIREBASE_PROJECT_ID || 'studio-1284053768-822ae', initError: initError ? String(initError.message).slice(0, 120) : null };
  try { await db.collection('categories').limit(1).get(); out.firestore = 'ok'; } catch (e) { out.firestore = String(e.message).slice(0, 200); }
  res.json(out);
});
app.use('/api', (_q, _r, next) => next(initError ? err(500, 'خطأ في الإعداد: محتوى FIREBASE_SERVICE_ACCOUNT غير صحيح (يجب أن يكون JSON كاملًا)') : undefined));

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
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data(), images: (d.data().images || []).slice(0, 1) })).filter((p) => {
    const price = p.discountPrice || p.price;
    return (!category || p.category === category) && (!min || price >= +min) && (!max || price <= +max)
      && (!q || p.name.includes(q) || p.keywords?.some((k) => k.includes(q)));
  });
  res.json(list);
}));

app.get('/api/my-products', guard('seller', 'admin'), wrap(async (req, res) => {
  const col = db.collection('products');
  const snap = await (req.user.role === 'admin' ? col : col.where('sellerId', '==', req.uid)).get();
  const slim = req.user.role === 'admin';
  res.json(snap.docs.map((d) => ({ id: d.id, ...d.data(), ...(slim ? { images: (d.data().images || []).slice(0, 1) } : {}) })));
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
  const extra = req.body.publish === true ? { status: process.env.REQUIRE_REVIEW === 'true' && req.user.role !== 'admin' ? 'pending' : 'published' } : {};
  await ref.update({ ...cleanProduct(req.body), ...extra, updatedAt: FieldValue.serverTimestamp() });
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
    const code = String(req.body.couponCode || '').trim().toUpperCase();
    const cs = code ? await t.get(db.collection('coupons').doc(code)) : null;
    if (code && !(cs.exists && cs.data().active)) throw err(400, 'الكوبون غير صالح');
    const subtotal = total;
    if (cs) total = Math.round(total * (100 - cs.data().percent)) / 100;
    items.forEach((i, k) => t.update(refs[k], { stock: FieldValue.increment(-i.qty), sales: FieldValue.increment(i.qty) }));
    t.set(orderRef, { orderNumber, buyerId: req.uid, buyerName: req.user.name, items, sellerIds, address, paymentMethod, total, subtotal, couponCode: code || null, status: 'new', createdAt: FieldValue.serverTimestamp() });
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
  if (req.body.status === 'cancelled' && o.status !== 'cancelled') await Promise.all(o.items.map((i) => db.collection('products').doc(i.productId).update({ stock: FieldValue.increment(i.qty) })));
  await ref.update({ status: req.body.status });
  const [r, d] = notif(o.buyerId, 'order', `تغيّرت حالة طلبك ${o.orderNumber}`);
  await r.set(d);
  res.json({ ok: true });
}));

const count = async (q) => (await q.count().get()).data().count;
const list = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const ANY = ['buyer', 'seller', 'admin'];

app.get('/api/stats', wrap(async (_q, res) => {
  const [products, users, orders] = await Promise.all([count(db.collection('products').where('status', '==', 'published')), count(db.collection('users')), count(db.collection('orders'))]);
  res.json({ products, users, orders });
}));

app.get('/api/categories', wrap(async (_q, res) => res.json(list(await db.collection('categories').get()))));
app.post('/api/categories', guard('admin'), wrap(async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) throw err(400, 'الاسم مطلوب');
  res.status(201).json({ id: (await db.collection('categories').add({ name: name.slice(0, 60), icon: String(req.body.icon || '🏷').slice(0, 4) })).id });
}));
app.delete('/api/categories/:id', guard('admin'), wrap(async (req, res) => { await db.collection('categories').doc(req.params.id).delete(); res.json({ ok: true }); }));

app.get('/api/products/:id', wrap(async (req, res) => {
  const ref = db.collection('products').doc(req.params.id), s = await ref.get();
  if (!s.exists || s.data().status !== 'published') throw err(404, 'المنتج غير موجود');
  ref.update({ views: FieldValue.increment(1) }).catch(() => {});
  const p = { id: s.id, ...s.data() };
  const [rv, rel] = await Promise.all([db.collection('reviews').where('productId', '==', p.id).get(), db.collection('products').where('category', '==', p.category).where('status', '==', 'published').limit(5).get()]);
  res.json({ product: p, reviews: list(rv), related: list(rel).filter((x) => x.id !== p.id).slice(0, 4).map((x) => ({ ...x, images: (x.images || []).slice(0, 1) })) });
}));

app.post('/api/reviews', guard('buyer'), wrap(async (req, res) => {
  const { productId } = req.body, rating = Number(req.body.rating);
  if (!productId || !Number.isInteger(rating) || rating < 1 || rating > 5) throw err(400, 'تقييم غير صحيح');
  const os = await db.collection('orders').where('buyerId', '==', req.uid).get();
  if (!os.docs.some((d) => d.data().status !== 'cancelled' && d.data().items.some((i) => i.productId === productId))) throw err(403, 'يمكنك تقييم المنتجات التي اشتريتها فقط');
  await db.collection('reviews').doc(`${productId}_${req.uid}`).set({ productId, rating, comment: String(req.body.comment || '').slice(0, 1000), buyerId: req.uid, buyerName: req.user.name, createdAt: FieldValue.serverTimestamp() });
  const all = list(await db.collection('reviews').where('productId', '==', productId).get());
  await db.collection('products').doc(productId).update({ ratingAvg: all.reduce((x, y) => x + y.rating, 0) / all.length, ratingCount: all.length });
  res.status(201).json({ ok: true });
}));
app.get('/api/admin/reviews', guard('admin'), wrap(async (_q, res) => res.json(list(await db.collection('reviews').get()))));
app.delete('/api/reviews/:id', guard('admin'), wrap(async (req, res) => { await db.collection('reviews').doc(req.params.id).delete(); res.json({ ok: true }); }));

app.get('/api/favorites', guard('buyer'), wrap(async (req, res) => {
  const s = await db.collection('favorites').where('uid', '==', req.uid).get();
  const ps = await Promise.all(s.docs.map((d) => db.collection('products').doc(d.data().productId).get()));
  res.json(ps.filter((p) => p.exists && p.data().status === 'published').map((p) => ({ id: p.id, ...p.data(), images: (p.data().images || []).slice(0, 1) })));
}));
app.post('/api/favorites/:id', guard('buyer'), wrap(async (req, res) => {
  const r = db.collection('favorites').doc(`${req.uid}_${req.params.id}`), s = await r.get();
  if (s.exists) { await r.delete(); return res.json({ favorite: false }); }
  await r.set({ uid: req.uid, productId: req.params.id });
  res.json({ favorite: true });
}));

app.get('/api/notifications', guard(...ANY), wrap(async (req, res) => {
  const l = list(await db.collection('notifications').where('uid', '==', req.uid).get());
  res.json(l.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0, 50));
}));
app.post('/api/notifications/read', guard(...ANY), wrap(async (req, res) => {
  const s = await db.collection('notifications').where('uid', '==', req.uid).where('read', '==', false).get();
  const b = db.batch(); s.docs.forEach((d) => b.update(d.ref, { read: true })); await b.commit();
  res.json({ ok: true });
}));

app.put('/api/profile', guard(...ANY), wrap(async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) throw err(400, 'الاسم مطلوب');
  const addresses = (Array.isArray(req.body.addresses) ? req.body.addresses : []).slice(0, 5).map((a) => ({ line: String(a.line || '').slice(0, 300) })).filter((a) => a.line);
  if (req.user.role === 'seller' && req.body.storeName) await db.collection('sellers').doc(req.uid).set({ storeName: String(req.body.storeName).slice(0, 80) }, { merge: true });
  await db.collection('users').doc(req.uid).update({ name, phone: String(req.body.phone || '').slice(0, 30), addresses });
  res.json({ ok: true });
}));

app.post('/api/marketing-plans', guard('seller'), wrap(async (req, res) => {
  if (typeof req.body.plan !== 'string') throw err(400, 'الخطة مطلوبة');
  const r = await db.collection('marketingPlans').add({ sellerId: req.uid, productName: String(req.body.productName || '').slice(0, 150), plan: req.body.plan.slice(0, 20000), createdAt: FieldValue.serverTimestamp() });
  res.status(201).json({ id: r.id });
}));

app.get('/api/coupons', guard('admin'), wrap(async (_q, res) => res.json(list(await db.collection('coupons').get()))));
app.post('/api/coupons', guard('admin'), wrap(async (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase(), percent = Number(req.body.percent);
  if (!/^[A-Z0-9]{3,20}$/.test(code) || !(percent > 0 && percent <= 90)) throw err(400, 'كوبون غير صحيح (حروف/أرقام إنجليزية، نسبة 1–90)');
  await db.collection('coupons').doc(code).set({ percent, active: true });
  res.status(201).json({ ok: true });
}));
app.delete('/api/coupons/:code', guard('admin'), wrap(async (req, res) => { await db.collection('coupons').doc(req.params.code).delete(); res.json({ ok: true }); }));

app.patch('/api/orders/:id/cancel', guard('buyer'), wrap(async (req, res) => {
  const ref = db.collection('orders').doc(req.params.id), s = await ref.get();
  if (!s.exists || s.data().buyerId !== req.uid) throw err(404, 'الطلب غير موجود');
  const o = s.data();
  if (o.status !== 'new') throw err(400, 'لا يمكن إلغاء الطلب بعد بدء مراجعته');
  await Promise.all(o.items.map((i) => db.collection('products').doc(i.productId).update({ stock: FieldValue.increment(i.qty) })));
  await ref.update({ status: 'cancelled' });
  for (const sid of o.sellerIds) { const [r, d] = notif(sid, 'order', `تم إلغاء الطلب ${o.orderNumber}`); await r.set(d); }
  res.json({ ok: true });
}));

app.get('/api/admin/stats', guard('admin'), wrap(async (_q, res) => {
  const c = (col, ...w) => count(w.reduce((q, [f, o, v]) => q.where(f, o, v), db.collection(col)));
  const [users, sellers, buyers, products, published, pending, orders, cancelled] = await Promise.all([c('users'), c('users', ['role', '==', 'seller']), c('users', ['role', '==', 'buyer']), c('products'), c('products', ['status', '==', 'published']), c('products', ['status', '==', 'pending']), c('orders'), c('orders', ['status', '==', 'cancelled'])]);
  const sales = list(await db.collection('orders').get()).reduce((s, o) => (o.status === 'cancelled' ? s : s + o.total), 0);
  const ps = list(await db.collection('products').get()).map((p) => ({ name: p.name, views: p.views || 0, sales: p.sales || 0 }));
  const top = (k) => [...ps].sort((a, b) => b[k] - a[k]).slice(0, 5);
  res.json({ users, sellers, buyers, products, published, pending, orders, cancelled, sales, topViewed: top('views'), topSold: top('sales') });
}));
app.post('/api/admin/seed', guard('admin'), wrap(async (_q, res) => res.json(await seed(db))));
app.get('/api/admin/users', guard('admin'), wrap(async (_q, res) => res.json(list(await db.collection('users').get()))));
app.patch('/api/admin/users/:id/block', guard('admin'), wrap(async (req, res) => {
  if (req.params.id === req.uid) throw err(400, 'لا يمكنك إيقاف حسابك');
  await db.collection('users').doc(req.params.id).update({ blocked: req.body.blocked === true });
  res.json({ ok: true });
}));

app.use('/api', (_req, _res, next) => next(err(404, 'المسار غير موجود')));
app.use((e, _req, res, _next) => {
  if (!e.status) console.error(e);
  const m = String(e.message || '');
  const hint = /credential/i.test(m) ? 'مفتاح FIREBASE_SERVICE_ACCOUNT غير مضبوط على Vercel'
    : e.code === 5 || /NOT_FOUND/.test(m) ? 'قاعدة Firestore لم تُنشأ بعد في Firebase Console'
    : e.code === 7 || /PERMISSION_DENIED/.test(m) ? 'مفتاح الخدمة لا يملك صلاحية الوصول إلى Firestore'
    : null;
  res.status(e.status || 500).json({ error: e.status ? m : hint ? 'خطأ في الإعداد: ' + hint : 'خطأ في الخادم' });
});
