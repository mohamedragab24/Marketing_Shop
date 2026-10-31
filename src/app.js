import { auth, app as fbApp } from './firebase.js';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = (n) => new Intl.NumberFormat('ar-EG').format(n) + ' ج.م';
const ST = { new: 'جديد', reviewing: 'قيد المراجعة', confirmed: 'تم التأكيد', preparing: 'جاري التجهيز', shipped: 'تم الشحن', completed: 'مكتمل', cancelled: 'ملغي' };
const PST = { draft: 'مسودة', pending: 'قيد المراجعة', published: 'منشور', rejected: 'مرفوض' };
let me = null, authReady = false, catalog = {}, f = { q: '', category: '' };
let cart = JSON.parse(localStorage.getItem('cart') || '{}');
const saveCart = () => localStorage.setItem('cart', JSON.stringify(cart));

function toast(msg, bad) {
  const t = $('#toast'); t.textContent = msg; t.style.background = bad ? '#dc2626' : '#0b2447'; t.style.display = 'block';
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.style.display = 'none'), 3000);
}
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const u = auth.currentUser;
  if (u && !u.isAnonymous) headers.Authorization = 'Bearer ' + (await u.getIdToken());
  const r = await fetch('/api' + path, { ...opts, headers, body: opts.body && JSON.stringify(opts.body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'حدث خطأ');
  return d;
}

function nav() {
  const n = Object.keys(cart).length;
  const role = me?.role;
  $('#nav').innerHTML = `<b>🛍 متجر التسويق الذكي</b><a href="/">الشرح التعليمي</a><a href="#store">المتجر</a><a href="#cart">السلة (${n})</a>` +
    (me ? `<a href="#orders">الطلبات</a>` : '') +
    (role === 'seller' ? `<a href="#seller">لوحة البائع</a>` : role === 'admin' ? `<a href="#seller">لوحة المدير</a>` : '') +
    (me ? `<button data-act="logout">خروج (${esc(me.name || '')})</button>` : `<a href="#login">دخول / تسجيل</a>`);
}

const card = (p) => { catalog[p.id] = p; return `<div class="card"><img src="${esc(p.images?.[0] || '')}" alt=""><b>${esc(p.name)}</b><span class="muted">${esc(p.category)}</span>
  <div>${p.discountPrice ? `<span class="old">${money(p.price)}</span> ` : ''}<b>${money(p.discountPrice || p.price)}</b></div>
  <button class="p" data-act="add" data-id="${p.id}" ${p.stock < 1 ? 'disabled' : ''}>${p.stock < 1 ? 'نفدت الكمية' : 'أضف إلى السلة'}</button></div>`; };

const views = {
  async store() {
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v));
    const list = await api('/products?' + qs);
    return `<form id="sf" class="bar"><input name="q" placeholder="ابحث باسم المنتج" value="${esc(f.q)}"><input name="category" placeholder="التصنيف" value="${esc(f.category)}"><button class="p">بحث</button></form>
      <div class="grid">${list.map(card).join('') || '<p class="muted">لا توجد منتجات منشورة بعد.</p>'}</div>`;
  },
  login() {
    return `<div class="box"><h2>تسجيل الدخول</h2><form id="lf"><input name="email" type="email" placeholder="البريد الإلكتروني" required>
      <input name="password" type="password" minlength="6" placeholder="كلمة المرور" required><button class="p">دخول</button></form></div>
      <div class="box"><h2>إنشاء حساب</h2><form id="rf"><input name="name" placeholder="الاسم" required><input name="phone" placeholder="رقم الهاتف">
      <input name="email" type="email" placeholder="البريد الإلكتروني" required><input name="password" type="password" minlength="6" placeholder="كلمة المرور (6 أحرف على الأقل)" required>
      <select name="role"><option value="buyer">مشتري</option><option value="seller">بائع</option></select><input name="storeName" placeholder="اسم المتجر (للبائع)"><button class="p">إنشاء الحساب</button></form></div>`;
  },
  cart() {
    const items = Object.entries(cart);
    if (!items.length) return '<p class="muted">السلة فارغة.</p>';
    const total = items.reduce((s, [, i]) => s + i.price * i.qty, 0);
    const rows = items.map(([id, i]) => `<div class="box"><b>${esc(i.name)}</b> — ${money(i.price)} × ${i.qty}
      <button class="d" data-act="dec" data-id="${id}">−</button><button class="p" data-act="inc" data-id="${id}">+</button><button class="d" data-act="rm" data-id="${id}">حذف</button></div>`).join('');
    const form = me?.role === 'buyer' ? `<form id="cf" class="box"><h3>إتمام الشراء</h3><input name="name" placeholder="الاسم" value="${esc(me.name)}" required><input name="phone" placeholder="الهاتف" value="${esc(me.phone)}" required>
      <textarea name="line" placeholder="عنوان التوصيل" required></textarea><select name="pay"><option value="cod">الدفع عند الاستلام (تجريبي)</option><option value="card_sim">محاكاة الدفع بالبطاقة (دون خصم)</option></select>
      <button class="p">تأكيد الشراء</button></form>` : '<p>سجّل الدخول بحساب مشتري لإتمام الشراء.</p>';
    return `${rows}<div class="box"><b>الإجمالي: ${money(total)}</b> <span class="muted">(يُعاد حسابه من الخادم عند التأكيد)</span></div>${form}`;
  },
  async orders() {
    if (!me) return views.login();
    const list = await api('/orders');
    const staff = me.role !== 'buyer';
    return list.map((o) => `<div class="box"><b>${esc(o.orderNumber)}</b> <span class="tag">${ST[o.status]}</span> — ${money(o.total)} — ${o.paymentMethod === 'cod' ? 'عند الاستلام' : 'بطاقة تجريبية'}
      <div class="muted">${esc(o.buyerName)} — ${esc(o.address?.line)}</div>${o.items.map((i) => `<div>${esc(i.name)} × ${i.qty}</div>`).join('')}
      ${staff ? `<select data-act="status" data-id="${o.id}">${Object.entries(ST).map(([k, v]) => `<option value="${k}" ${k === o.status ? 'selected' : ''}>${v}</option>`).join('')}</select>` : ''}</div>`).join('') || '<p class="muted">لا توجد طلبات.</p>';
  },
  async seller() {
    if (!me || !['seller', 'admin'].includes(me.role)) return '<p class="err">هذه الصفحة للبائعين والمدير فقط.</p>';
    const list = await api('/my-products');
    const form = me.role === 'seller' ? `<form id="pf" class="box"><h3>إضافة منتج</h3><input name="name" placeholder="اسم المنتج" required>
      <input name="price" type="number" step="0.01" placeholder="السعر الأساسي" required><input name="discountPrice" type="number" step="0.01" placeholder="السعر بعد الخصم (اختياري)">
      <input name="stock" type="number" placeholder="الكمية المتاحة" required><input name="category" placeholder="التصنيف" required><input name="brand" placeholder="العلامة التجارية">
      <textarea name="description" placeholder="وصف المنتج"></textarea><input name="keywords" placeholder="الكلمات المفتاحية (بفواصل)"><input name="image" type="file" accept="image/*">
      <label><input type="checkbox" name="publish" style="width:auto"> نشر الآن (وإلا يُحفظ كمسودة)</label><button class="p">حفظ</button></form>` : '';
    return form + `<h3>${me.role === 'admin' ? 'كل المنتجات' : 'منتجاتي'}</h3>` + list.map((p) => `<div class="box"><b>${esc(p.name)}</b> <span class="tag">${PST[p.status]}</span> — ${money(p.discountPrice || p.price)} — المخزون ${p.stock}
      <button class="d" data-act="delp" data-id="${p.id}">حذف</button>${me.role === 'admin' && p.status === 'pending' ? `<button class="p" data-act="ok" data-id="${p.id}">قبول</button><button class="d" data-act="no" data-id="${p.id}">رفض</button>` : ''}</div>`).join('');
  },
};

async function render() {
  nav();
  if (!authReady) return;
  const v = (location.hash || '#store').slice(1);
  const el = $('#app'); el.innerHTML = '<p class="muted">جاري التحميل…</p>';
  try { el.innerHTML = await (views[v] || views.store)(); } catch (e) { el.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}

async function loadMe(u) {
  me = null;
  if (u && !u.isAnonymous) { try { const d = await api('/me'); me = d.role ? d : null; } catch { /* غير مسجّل */ } }
  authReady = true; render();
}
onAuthStateChanged(auth, loadMe);
window.addEventListener('hashchange', render);

const run = async (fn, ok) => { try { await fn(); if (ok) toast(ok); } catch (e) { toast(e.message, true); } };
document.addEventListener('submit', (e) => {
  e.preventDefault();
  const fd = Object.fromEntries(new FormData(e.target)), id = e.target.id;
  if (id === 'sf') { f = { q: fd.q, category: fd.category }; render(); }
  if (id === 'lf') run(async () => { await signInWithEmailAndPassword(auth, fd.email, fd.password); location.hash = '#store'; }, 'تم تسجيل الدخول');
  if (id === 'rf') run(async () => {
    await createUserWithEmailAndPassword(auth, fd.email, fd.password);
    await api('/register', { method: 'POST', body: { name: fd.name, phone: fd.phone, role: fd.role, storeName: fd.storeName } });
    await loadMe(auth.currentUser); location.hash = fd.role === 'seller' ? '#seller' : '#store';
  }, 'تم إنشاء الحساب');
  if (id === 'pf') run(async () => {
    const images = [], file = e.target.image.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) throw new Error('الصورة أكبر من 5MB');
      const r = ref(getStorage(fbApp), `products/${auth.currentUser.uid}/${Date.now()}.${(file.type.split('/')[1] || 'jpg').replace(/[^a-z0-9]/gi, '')}`);
      await uploadBytes(r, file); images.push(await getDownloadURL(r));
    }
    const body = { ...fd, images, publish: !!fd.publish, keywords: (fd.keywords || '').split(',').map((k) => k.trim()).filter(Boolean) };
    delete body.image;
    const res = await api('/products', { method: 'POST', body });
    toast('الحالة: ' + PST[res.status]); render();
  });
  if (id === 'cf') run(async () => {
    const items = Object.entries(cart).map(([productId, i]) => ({ productId, qty: i.qty }));
    const r = await api('/orders', { method: 'POST', body: { items, paymentMethod: fd.pay, address: { name: fd.name, phone: fd.phone, line: fd.line } } });
    cart = {}; saveCart(); toast(`تم تأكيد الطلب ${r.orderNumber}`); location.hash = '#orders'; render();
  });
});
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b || b.tagName === 'SELECT') return;
  const { act, id } = b.dataset;
  if (act === 'logout') run(() => signOut(auth));
  if (act === 'add') { const p = catalog[id]; cart[id] = { name: p.name, price: p.discountPrice || p.price, qty: (cart[id]?.qty || 0) + 1 }; saveCart(); nav(); toast('تمت الإضافة إلى السلة'); }
  if (act === 'inc') { cart[id].qty++; saveCart(); render(); }
  if (act === 'dec') { if (--cart[id].qty < 1) delete cart[id]; saveCart(); render(); }
  if (act === 'rm') { delete cart[id]; saveCart(); render(); }
  if (act === 'delp' && confirm('حذف المنتج نهائيًا؟')) run(async () => { await api('/products/' + id, { method: 'DELETE' }); render(); }, 'تم الحذف');
  if (act === 'ok' || act === 'no') run(async () => { await api(`/products/${id}/review`, { method: 'PATCH', body: { approve: act === 'ok' } }); render(); }, 'تم');
});
document.addEventListener('change', (e) => {
  const s = e.target.closest('select[data-act="status"]');
  if (s) run(() => api(`/orders/${s.dataset.id}/status`, { method: 'PATCH', body: { status: s.value } }), 'تم تحديث الحالة');
});
