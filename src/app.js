import './ui.css';
import { auth, app as fbApp } from './firebase.js';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = (n) => new Intl.NumberFormat('ar-EG').format(n) + ' ج.م';
const ST = { new: 'جديد', reviewing: 'قيد المراجعة', confirmed: 'تم التأكيد', preparing: 'جاري التجهيز', shipped: 'تم الشحن', completed: 'مكتمل', cancelled: 'ملغي' };
const PST = { draft: 'مسودة', pending: 'قيد المراجعة', published: 'منشور', rejected: 'مرفوض' };
const r = (a) => a[Math.floor(Math.random() * a.length)];
let me = null, authReady = false, catalog = {}, mine = {}, editing = null, favIds = new Set(), f = { q: '', category: '', sort: 'new' };
let cart = JSON.parse(localStorage.getItem('cart') || '{}');
const saveCart = () => localStorage.setItem('cart', JSON.stringify(cart));
const isBuyer = () => me?.role === 'buyer';

function toast(msg, bad) {
  const t = $('#toast'); t.textContent = msg; t.style.background = bad ? '#dc2626' : '#0b2447'; t.style.display = 'block';
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.style.display = 'none'), 3000);
}
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const u = auth.currentUser;
  if (u && !u.isAnonymous) headers.Authorization = 'Bearer ' + (await u.getIdToken());
  const res = await fetch('/api' + path, { ...opts, headers, body: opts.body && JSON.stringify(opts.body) });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || 'حدث خطأ');
  return d;
}

const MODE = document.body.dataset.mode || 'store';
const ALLOW = { store: ['store', 'product', 'cart', 'favorites', 'orders', 'notifications', 'profile', 'login', 'er'], seller: ['seller', 'newproduct', 'marketing', 'admin', 'orders', 'notifications', 'profile', 'login', 'er'] };
const home = () => (MODE === 'seller' ? (me?.role === 'admin' ? '#admin' : '#seller') : '#store');
const goStore = () => (['', '#store'].includes(location.hash) ? render() : (location.hash = '#store'));

function nav() {
  const role = me?.role, n = Object.keys(cart).length;
  if (MODE === 'seller') {
    const L = role === 'admin' ? [['admin', '📊', 'لوحة المدير'], ['seller', '📦', 'كل المنتجات'], ['orders', '🧾', 'الطلبات'], ['notifications', '🔔', 'الإشعارات'], ['profile', '👤', 'حسابي'], ['er', '🗄', 'قاعدة البيانات']]
      : role === 'seller' ? [['seller', '📦', 'منتجاتي'], ['newproduct', '➕', 'إضافة منتج'], ['orders', '🧾', 'الطلبات'], ['marketing', '🚀', 'مساعد التسويق'], ['notifications', '🔔', 'الإشعارات'], ['profile', '👤', 'بيانات المتجر']] : [];
    const cur = (location.hash || '').slice(1).split('/')[0];
    $('#nav').innerHTML = '<div class="brand">🏪 بوابة البائعين</div>' + L.map(([k, i, l]) => `<a href="#${k}" class="${cur === k ? 'on' : ''}">${i} ${l}</a>`).join('') + '<a href="/app.html">🛍 الذهاب إلى المتجر</a><a href="/">📚 الشرح التعليمي</a>' + (me ? `<button data-act="logout">خروج (${esc(me.name)})</button>` : '');
    return;
  }
  $('#nav').innerHTML = `<div class="top"><a class="logo" href="#store" data-act="home">🛍 المتجر<b>الذكي</b></a>
    <form id="sf" class="search"><input name="q" placeholder="ابحث عن منتج أو علامة تجارية…" value="${esc(f.q)}"><button>🔍</button></form>
    <a href="${me ? '#profile' : '#login'}">👤 ${me ? esc(me.name) : 'تسجيل الدخول'}</a>${me ? '<a href="#orders">🧾 طلباتي</a>' : ''}<a href="#cart">🛒 السلة <span class="badge">${n}</span></a></div>
    <div class="strip"><a href="#store" data-act="home">الرئيسية</a>${isBuyer() ? '<a href="#favorites">❤️ المفضلة</a>' : ''}${me ? '<a href="#notifications">🔔 الإشعارات</a>' : ''}<a href="/">📚 الشرح التعليمي</a><a href="#er">🗄 قاعدة البيانات</a>
    <a href="/seller.html">🏪 ${role === 'seller' || role === 'admin' ? 'لوحة البائع' : 'بيع على المتجر'}</a>${me ? '<button data-act="logout">خروج</button>' : ''}</div>`;
}

const pic = (u) => (u ? `<img src="${esc(u)}" alt="" loading="lazy">` : '<div class="ph">🛍</div>');
const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
const card = (p) => {
  catalog[p.id] = p;
  const pct = p.discountPrice ? Math.round((1 - p.discountPrice / p.price) * 100) : 0;
  return `<div class="card"><a href="#product/${p.id}" class="pic">${pct ? `<span class="off">-${pct}٪</span>` : ''}${pic(p.images?.[0])}</a><a href="#product/${p.id}" class="nm">${esc(p.name)}</a>
  ${p.ratingCount ? `<div class="rt">${stars(Math.round(p.ratingAvg))} <small>(${p.ratingCount})</small></div>` : '<div class="rt">&nbsp;</div>'}
  <div class="pr"><b>${money(p.discountPrice || p.price)}</b>${pct ? ` <span class="old">${money(p.price)}</span>` : ''}</div>
  <button class="cta" data-act="add" data-id="${p.id}" ${p.stock < 1 ? 'disabled' : ''}>${p.stock < 1 ? 'نفدت الكمية' : 'أضف إلى السلة'}</button>
  ${isBuyer() ? `<button class="ghost" data-act="fav" data-id="${p.id}">${favIds.has(p.id) ? '❤️ في المفضلة' : '🤍 أضف للمفضلة'}</button>` : ''}</div>`;
};
const grid = (l) => `<div class="grid">${l.map(card).join('') || '<p class="muted">لا توجد منتجات.</p>'}</div>`;
const sec = (title, l) => (l.length ? `<div class="sec"><h2>${title}</h2>${grid(l)}</div>` : '');

function makePlan(p) {
  const price = +p.price || 0, cat = p.category || 'المنتج', name = p.name || 'المنتج';
  const lo = Math.round(price * 0.95), hi = Math.round(price * 1.1), kw = [name, cat, p.brand, 'شراء ' + cat, 'أفضل ' + name, 'عروض ' + cat].filter(Boolean);
  const rows = [
    ['1. نوع المنتج', `${cat}${p.brand ? ' — ' + p.brand : ''}`],
    ['2. الجمهور المستهدف', r([`المهتمون بـ${cat} والمتسوقون عبر الهاتف`, `الأسر والشباب الباحثون عن ${cat} بسعر مناسب`])],
    ['3. الفئة العمرية', r(['18–24 سنة', '25–34 سنة', '25–44 سنة'])],
    ['4. احتياجات العملاء', r(['جودة واضحة بسعر عادل', 'توصيل سريع وضمان استبدال', 'ثقة عبر تقييمات وصور حقيقية'])],
    ['5. تحليل المنافسين', `قارن منتجك بـ 3–5 منتجات مشابهة في تصنيف ${cat} داخل المتجر (السعر، الصور، التقييمات) وحدد ميزة واحدة تتفوق بها. (هذا إرشاد عام لا تحليل بيانات حقيقي.)`],
    ['6. سعر البيع المقترح (تقديري)', price ? `بين ${lo} و ${hi} ج.م` : 'أدخل السعر أولًا'],
    ['7. اسم تجاري مقترح', r([`${name} بلس`, `${name} برو`, `لمسة ${cat}`])],
    ['8. العنوان التسويقي', r([`${name}: الجودة التي تستحقها`, `اكتشف ${name} الآن بسعر مميز`])],
    ['9. وصف احترافي', `${name} من فئة ${cat}${p.brand ? ' من ' + p.brand : ''}. ${p.description || 'صُمم ليلبي احتياجك اليومي بجودة موثوقة.'} متوفر الآن مع إمكانية الاستبدال حسب السياسة.`],
    ['10. كلمات SEO', kw.join('، ')],
    ['11. الصور المقترحة', 'صورة رئيسية بخلفية بيضاء، صورة أثناء الاستخدام، صورة تفاصيل مقربة، صورة بالأبعاد/المقارنة.'],
    ['12. أفكار فيديو', r(['فيديو 15 ثانية: فتح العلبة + أهم 3 مميزات', 'قبل/بعد الاستخدام مع نص قصير', 'مراجعة سريعة بصوت البائع']) ],
    ['13. منشورات سوشيال', `1) وصل ${name} 🎉 اطلبه الآن.\n2) لماذا يختار عملاؤنا ${name}؟ 3 أسباب في منشور.\n3) عرض لفترة محدودة على ${name}!`],
    ['14. حملات إعلانية', 'حملة وعي (فيديو قصير) ثم حملة إعادة استهداف لمن شاهد المنتج. ابدأ بميزانية صغيرة وقِس النتائج.'],
    ['15. منصات التسويق', r(['فيسبوك + إنستغرام + تيك توك', 'إنستغرام + واتساب + جوجل', 'تيك توك + فيسبوك'])],
    ['16. العروض والخصومات', r(['خصم 10٪ للطلب الأول', 'كوبون لفترة محدودة', 'شحن مخفض عند شراء قطعتين'])],
    ['17. خطة 30 يومًا', 'الأسبوع 1: تحسين الصور والوصف والـSEO.\nالأسبوع 2: منشورات + فيديو قصير + عرض افتتاحي.\nالأسبوع 3: إعلان مدفوع صغير + جمع تقييمات.\nالأسبوع 4: قياس النتائج وتكرار الأفضل.'],
    ['18. متابعة الأداء', 'تابع المشاهدات والمبيعات لكل منتج من لوحة البائع، وقارن أسبوعيًا بين المنتجات.'],
  ];
  return rows.map(([a, b]) => `${a}\n${b}`).join('\n\n') + '\n\n⚠️ هذه اقتراحات تقديرية وإرشادية وليست ضمانًا للمبيعات.';
}

const ERT = { Users: ['id PK', 'name', 'role', 'phone', 'addresses[] (Addresses)'], Sellers: ['userId PK→Users', 'storeName'], Products: ['id PK', 'sellerId FK→Users', 'category FK→Categories', 'price', 'stock', 'status', 'images[] (ProductImages)'],
  Categories: ['id PK', 'name'], Orders: ['id PK', 'buyerId FK→Users', 'total', 'status', 'couponCode FK→Coupons', 'items[] (OrderItems)'], OrderItems: ['orderId FK', 'productId FK→Products', 'qty', 'price'],
  Reviews: ['id PK', 'productId FK', 'buyerId FK', 'rating'], MarketingPlans: ['id PK', 'sellerId FK', 'plan'], Coupons: ['code PK', 'percent', 'active'], Payments: ['id PK', 'orderId FK', 'method', 'status'],
  Notifications: ['id PK', 'uid FK→Users', 'text', 'read'], Favorites: ['uid FK', 'productId FK'], Cart: ['(في المتصفح) productId', 'qty'] };

const views = {
  async store() {
    const qs = new URLSearchParams({ q: f.q, category: f.category });
    const [list, st, cats] = await Promise.all([api('/products?' + qs), api('/stats'), api('/categories')]);
    if (isBuyer()) favIds = new Set((await api('/favorites')).map((p) => p.id));
    const t = (p) => p.createdAt?.seconds || 0, byNew = [...list].sort((a, b) => t(b) - t(a)), byTop = [...list].sort((a, b) => (b.sales || 0) - (a.sales || 0));
    const chips = `<div class="chips"><button data-act="cat" data-id="" class="${!f.category ? 'on' : ''}">الكل</button>${cats.map((c) => `<button data-act="cat" data-id="${esc(c.name)}" class="${f.category === c.name ? 'on' : ''}">${esc(c.name)}</button>`).join('')}</div>`;
    if (f.q || f.category) {
      const sorted = f.sort === 'top' ? byTop : f.sort === 'sale' ? list.filter((p) => p.discountPrice) : byNew;
      return `${chips}<div class="tabs">${[['new', 'الأحدث'], ['top', 'الأكثر مبيعًا'], ['sale', 'المخفضة']].map(([k, l]) => `<button data-act="sort" data-id="${k}" class="${f.sort === k ? 'on' : ''}">${l}</button>`).join('')}</div><h3>${list.length} نتيجة ${f.q ? `لـ «${esc(f.q)}»` : ''}</h3>${grid(sorted)}`;
    }
    return `<div class="hero"><div><h1>تسوّق بذكاء من بائعين موثوقين</h1><p>اكتشف أحدث المنتجات والعروض، واشترِ بخطوات بسيطة.</p><a class="cta" href="#store" data-act="cat" data-id="">تسوّق الآن</a></div>
      <div class="stats"><div><b>${st.products}</b>منتج</div><div><b>${st.users}</b>مستخدم</div><div><b>${st.orders}</b>طلب</div></div></div>${chips}
      ${sec('🔥 عروض وخصومات', byNew.filter((p) => p.discountPrice).slice(0, 5))}${sec('⭐ الأكثر مبيعًا', byTop.filter((p) => p.sales).slice(0, 5))}${sec('🆕 وصل حديثًا', byNew.slice(0, 10))}
      <div class="trust"><div>🚚 توصيل لجميع المحافظات</div><div>🔒 دفع تجريبي آمن</div><div>↩️ سياسة استبدال واسترجاع</div><div>⭐ تقييمات حقيقية من مشترين</div></div>`;
  },
  async product(id) {
    const { product: p, reviews, related } = await api('/products/' + id);
    catalog[p.id] = p;
    if (isBuyer()) favIds = new Set((await api('/favorites')).map((x) => x.id));
    const avg = reviews.length ? reviews.reduce((s, x) => s + x.rating, 0) / reviews.length : 0, imgs = (p.images || []).filter(Boolean), pct = p.discountPrice ? Math.round((1 - p.discountPrice / p.price) * 100) : 0;
    return `<div class="muted"><a href="#store">الرئيسية</a> › ${esc(p.category)}</div>
      <div class="box pd"><div>${imgs[0] ? `<img id="bigimg" src="${esc(imgs[0])}" alt="">` : '<div class="ph big">🛍</div>'}<div class="thumbs">${imgs.map((u) => `<img src="${esc(u)}" data-act="img" data-id="${esc(u)}" alt="">`).join('')}</div></div>
      <div><h2>${esc(p.name)}</h2><div class="rt">${stars(Math.round(avg))} <small>${avg ? avg.toFixed(1) : ''} (${reviews.length} تقييم)</small></div><div class="muted">${p.brand ? 'العلامة التجارية: ' + esc(p.brand) : ''}</div><hr>
      <div class="pr big">${pct ? `<span class="off st">-${pct}٪</span> ` : ''}<b>${money(p.discountPrice || p.price)}</b>${pct ? ` <span class="old">${money(p.price)}</span>` : ''}</div>
      <div class="${p.stock > 0 ? 'ok' : 'err'}">${p.stock > 0 ? (p.stock < 5 ? `متبقي ${p.stock} فقط` : 'متوفر') : 'نفدت الكمية'}</div>
      <p>${esc(p.description)}</p><pre>${esc(p.specs)}</pre><div class="muted">الوزن: ${esc(p.weight) || '—'} | الأبعاد: ${esc(p.dimensions) || '—'} | المنشأ: ${esc(p.origin) || '—'}</div><div class="muted">الاسترجاع: ${esc(p.returnPolicy) || '—'}</div>
      <div class="acts"><button class="cta" data-act="add" data-id="${p.id}" ${p.stock < 1 ? 'disabled' : ''}>أضف إلى السلة</button><button class="buy" data-act="buy" data-id="${p.id}" ${p.stock < 1 ? 'disabled' : ''}>اشتر الآن</button>
      ${isBuyer() ? `<button class="ghost" data-act="fav" data-id="${p.id}">${favIds.has(p.id) ? '❤️ في المفضلة' : '🤍 مفضلة'}</button>` : ''}</div></div></div>
      <div class="box"><h3>تقييمات العملاء</h3>${reviews.map((x) => `<div><b>${esc(x.buyerName)}</b> <span class="rt">${stars(x.rating)}</span><div>${esc(x.comment)}</div><hr></div>`).join('') || '<p class="muted">لا تقييمات بعد.</p>'}
      ${isBuyer() ? `<form id="rvf" data-id="${p.id}"><select name="rating">${[5, 4, 3, 2, 1].map((n) => `<option value="${n}">${stars(n)}</option>`).join('')}</select><textarea name="comment" placeholder="رأيك في المنتج (للمشترين فقط)"></textarea><button class="p">إرسال التقييم</button></form>` : ''}</div>
      ${related.length ? `<div class="sec"><h2>منتجات مقترحة</h2>${grid(related)}</div>` : ''}`;
  },
  async favorites() { return isBuyer() ? grid(await api('/favorites').then((l) => { favIds = new Set(l.map((p) => p.id)); return l; })) : views.login(); },
  login() {
    const S = MODE === 'seller';
    return `<div class="auth"><div class="box"><h2>${S ? 'بوابة البائعين — تسجيل الدخول' : 'تسجيل الدخول'}</h2><form id="lf"><input name="email" type="email" placeholder="البريد الإلكتروني" required><input name="password" type="password" minlength="6" placeholder="كلمة المرور" required><button class="p">دخول</button></form></div>
      <div class="box"><h2>${S ? 'افتح متجرك وابدأ البيع' : 'إنشاء حساب مشتري'}</h2><form id="rf"><input name="name" placeholder="الاسم" required><input name="phone" placeholder="رقم الهاتف"><input name="email" type="email" placeholder="البريد الإلكتروني" required>
      <input name="password" type="password" minlength="6" placeholder="كلمة المرور (6 أحرف على الأقل)" required><input type="hidden" name="role" value="${S ? 'seller' : 'buyer'}">${S ? '<input name="storeName" placeholder="اسم المتجر" required>' : '<input type="hidden" name="storeName">'}<button class="p">إنشاء الحساب</button></form></div></div>`;
  },
  cart() {
    const items = Object.entries(cart);
    if (!items.length) return '<p class="muted">السلة فارغة.</p>';
    const total = items.reduce((s, [, i]) => s + i.price * i.qty, 0), saved = items.reduce((s, [, i]) => s + (i.list - i.price) * i.qty, 0);
    const rows = items.map(([id, i]) => `<div class="box"><b>${esc(i.name)}</b> — ${money(i.price)} × ${i.qty}<button class="d" data-act="dec" data-id="${id}">−</button><button class="p" data-act="inc" data-id="${id}">+</button><button class="d" data-act="rm" data-id="${id}">حذف</button></div>`).join('');
    const form = isBuyer() ? `<form id="cf" class="box"><h3>إتمام الشراء</h3><input name="name" placeholder="الاسم" value="${esc(me.name)}" required><input name="phone" placeholder="الهاتف" value="${esc(me.phone)}" required>
      <select name="saved"><option value="">— عنوان جديد —</option>${(me.addresses || []).map((a) => `<option>${esc(a.line)}</option>`).join('')}</select><textarea name="line" placeholder="عنوان التوصيل"></textarea>
      <input name="couponCode" placeholder="كوبون خصم (اختياري)"><select name="pay"><option value="cod">الدفع عند الاستلام (تجريبي)</option><option value="card_sim">محاكاة الدفع بالبطاقة (دون خصم)</option></select><button class="p">تأكيد الشراء</button></form>` : '<p>سجّل الدخول بحساب مشتري لإتمام الشراء.</p>';
    return `${rows}<div class="box"><b>الإجمالي: ${money(total)}</b> — وفّرت ${money(saved)} <div class="muted">يُعاد حساب السعر والكوبون من الخادم عند التأكيد.</div></div>${form}`;
  },
  async orders() {
    if (!me) return views.login();
    const list = await api('/orders'), staff = me.role !== 'buyer';
    return list.map((o) => `<div class="box"><b>${esc(o.orderNumber)}</b> <span class="tag">${ST[o.status]}</span> — ${money(o.total)}${o.couponCode ? ` (كوبون ${esc(o.couponCode)})` : ''} — ${o.paymentMethod === 'cod' ? 'عند الاستلام' : 'بطاقة تجريبية'}
      <div class="muted">${esc(o.buyerName)} — ${esc(o.address?.line)}</div>${o.items.map((i) => `<div>${esc(i.name)} × ${i.qty} — ${money(i.price)}</div>`).join('')}
      ${staff ? `<select data-act="status" data-id="${o.id}">${Object.entries(ST).map(([k, v]) => `<option value="${k}" ${k === o.status ? 'selected' : ''}>${v}</option>`).join('')}</select>` : o.status === 'new' ? `<button class="d" data-act="cancelo" data-id="${o.id}">إلغاء الطلب</button>` : ''}</div>`).join('') || '<p class="muted">لا توجد طلبات.</p>';
  },
  async notifications() {
    if (!me) return views.login();
    const l = await api('/notifications'); api('/notifications/read', { method: 'POST' }).catch(() => {});
    return `<h3>الإشعارات</h3>` + (l.map((n) => `<div class="box">${n.read ? '' : '🔵 '}${esc(n.text)}</div>`).join('') || '<p class="muted">لا إشعارات.</p>');
  },
  async profile() {
    if (!me) return views.login();
    return `<form id="prf" class="box"><h3>حسابي (${me.role === 'buyer' ? 'مشتري' : me.role === 'seller' ? 'بائع' : 'مدير'})</h3><input name="name" value="${esc(me.name)}" required><input name="phone" value="${esc(me.phone)}" placeholder="الهاتف">
      ${me.role === 'seller' ? '<input name="storeName" placeholder="اسم المتجر (تعديل بيانات المتجر)">' : ''}<textarea name="addresses" placeholder="العناوين، عنوان في كل سطر">${esc((me.addresses || []).map((a) => a.line).join('\n'))}</textarea><button class="p">حفظ</button></form>`;
  },
  async seller() {
    if (!['seller', 'admin'].includes(me?.role)) return '<div class="box">هذه الصفحة للبائعين فقط. <a href="/app.html"><u>العودة إلى المتجر</u></a></div>';
    const [list, orders] = await Promise.all([api('/my-products'), api('/orders')]);
    mine = Object.fromEntries(list.map((p) => [p.id, p]));
    const sum = (k) => list.reduce((s, p) => s + (p[k] || 0), 0), kp = ([l, v, i]) => `<div class="kpi"><span>${i}</span><div><small>${l}</small><b>${v}</b></div></div>`;
    return `<h2>${me.role === 'admin' ? 'كل المنتجات' : 'منتجاتي'}</h2><div class="kpis">${[['المنتجات', list.length, '📦'], ['المنشورة', list.filter((p) => p.status === 'published').length, '✅'], ['المشاهدات', sum('views'), '👁'], ['المبيعات', sum('sales'), '💰'], ['الطلبات', orders.length, '🧾']].map(kp).join('')}</div>
      ${me.role === 'seller' ? '<a class="cta" href="#newproduct">➕ إضافة منتج جديد</a><br><br>' : ''}` + (list.map((p) => `<div class="prow">${pic(p.images?.[0])}<div style="flex:1"><b>${esc(p.name)}</b> <span class="tag">${PST[p.status]}</span><div class="muted">${money(p.discountPrice || p.price)} — مخزون ${p.stock} — مشاهدات ${p.views || 0} — مبيعات ${p.sales || 0}</div></div>
      ${me.role === 'seller' ? `<button class="p" data-act="editp" data-id="${p.id}">تعديل</button>` : ''}<button class="d" data-act="delp" data-id="${p.id}">حذف</button>${me.role === 'admin' && p.status === 'pending' ? `<button class="p" data-act="ok" data-id="${p.id}">قبول</button><button class="d" data-act="no" data-id="${p.id}">رفض</button>` : ''}</div>`).join('') || '<p class="muted">لا توجد منتجات بعد.</p>');
  },
  async newproduct() {
    if (!me || !['seller', 'admin'].includes(me.role)) return '<p class="err">هذه الصفحة للبائعين والمدير فقط.</p>';
    const [list, cats] = await Promise.all([api('/my-products'), api('/categories')]);
    mine = Object.fromEntries(list.map((p) => [p.id, p]));
    const ed = editing, v = (k) => esc(ed?.[k] ?? ''), inp = (k, l, t = 'text', req) => `<input name="${k}" type="${t}" step="any" placeholder="${l}" value="${v(k)}" ${req ? 'required' : ''}>`;
    const form = me.role === 'seller' ? `<form id="pf" class="box"><h3>${ed ? 'تعديل منتج' : 'إضافة منتج'}</h3>${inp('name', 'اسم المنتج', 'text', 1)}${inp('price', 'السعر الأساسي', 'number', 1)}${inp('discountPrice', 'السعر بعد الخصم', 'number')}${inp('stock', 'الكمية المتاحة', 'number', 1)}
      <input name="category" list="cats" placeholder="التصنيف" value="${v('category')}" required><datalist id="cats">${cats.map((c) => `<option value="${esc(c.name)}">`).join('')}</datalist>${inp('brand', 'العلامة التجارية')}${inp('weight', 'الوزن')}${inp('dimensions', 'الأبعاد')}${inp('origin', 'بلد المنشأ')}${inp('keywords', 'الكلمات المفتاحية (بفواصل)')}${inp('returnPolicy', 'سياسة الاستبدال والاسترجاع')}
      <textarea name="description" placeholder="وصف المنتج">${v('description')}</textarea><textarea name="specs" placeholder="المواصفات">${v('specs')}</textarea><label>الصورة الرئيسية + صور إضافية (حتى 5)</label><input name="image" type="file" accept="image/*" multiple>
      <div id="meter"></div><label><input type="checkbox" name="publish" style="width:auto"> نشر (وإلا يُحفظ كمسودة)</label><br><button class="p">${ed ? 'حفظ التعديلات' : 'حفظ'}</button> <button type="button" class="p" data-act="preview">معاينة</button>${ed ? ' <button type="button" class="d" data-act="canceledit">إلغاء التعديل</button>' : ''}<div id="prev"></div></form>` : '';
    return form || '<div class="box">هذه الصفحة للبائعين فقط.</div>';
  },
  async marketing() {
    if (me?.role !== 'seller') return '<p class="err">للبائعين فقط.</p>';
    mine = Object.fromEntries((await api('/my-products')).map((p) => [p.id, p]));
    return `<form id="mf" class="box"><h3>مساعد التسويق</h3><select name="pick" data-act="pickp"><option value="">— اختر منتجًا أو أدخل البيانات يدويًا —</option>${Object.values(mine).map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select>
      <input name="name" placeholder="اسم المنتج" required><input name="category" placeholder="التصنيف" required><input name="price" type="number" placeholder="السعر"><input name="brand" placeholder="العلامة التجارية"><textarea name="description" placeholder="وصف مختصر"></textarea><button class="p">إنشاء خطة تسويقية</button></form>
      <div id="planbox"></div><p class="muted">الاقتراحات تُولَّد بقوالب إرشادية داخل الموقع وليست ضمانًا للمبيعات. للتحليل الذكي الفعلي يلزم ربط خدمة ذكاء اصطناعي بمفتاح API.</p>`;
  },
  async admin() {
    if (me?.role !== 'admin') return '<p class="err">للمدير فقط.</p>';
    const [s, users, cats, coupons, reviews] = await Promise.all([api('/admin/stats'), api('/admin/users'), api('/categories'), api('/coupons'), api('/admin/reviews')]);
    const sc = ([l, x]) => `<div class="card"><span class="muted">${l}</span><b style="font-size:1.4em">${x}</b></div>`;
    const bars = (a, k) => { const m = Math.max(1, ...a.map((x) => x[k])); return a.map((x) => `<div>${esc(x.name)}<div class="bar2" style="width:${(x[k] / m) * 100}%">${x[k]}</div></div>`).join('') || '<p class="muted">لا بيانات</p>'; };
    return `<div class="grid">${[['المستخدمون', s.users], ['البائعون', s.sellers], ['المشترون', s.buyers], ['المنتجات', s.products], ['المنشورة', s.published], ['قيد المراجعة', s.pending], ['الطلبات', s.orders], ['المبيعات التجريبية', money(s.sales)], ['الملغاة', s.cancelled]].map(sc).join('')}</div>
      <div class="box"><h3>الأكثر مشاهدة</h3>${bars(s.topViewed, 'views')}<h3>الأكثر طلبًا</h3>${bars(s.topSold, 'sales')}</div>
      <div class="box"><h3>التصنيفات</h3><form id="catf" class="bar"><input name="name" placeholder="تصنيف جديد" required><button class="p">إضافة</button></form>${cats.map((c) => `<span class="tag">${esc(c.name)} <a href="#" data-act="delcat" data-id="${c.id}">✕</a></span> `).join('')}</div>
      <div class="box"><h3>الكوبونات</h3><form id="cpf" class="bar"><input name="code" placeholder="CODE10" required><input name="percent" type="number" placeholder="نسبة الخصم" required><button class="p">إضافة</button></form>${coupons.map((c) => `<span class="tag">${esc(c.id)} ${c.percent}٪ <a href="#" data-act="delcp" data-id="${c.id}">✕</a></span> `).join('')}</div>
      <div class="box"><h3>المستخدمون</h3>${users.map((u) => `<div>${esc(u.name)} — ${esc(u.role)} ${u.blocked ? '<span class="tag">موقوف</span>' : ''} ${u.role !== 'admin' ? `<button class="d" data-act="block" data-id="${u.id}" data-b="${!u.blocked}">${u.blocked ? 'تفعيل' : 'إيقاف'}</button>` : ''}</div>`).join('')}</div>
      <div class="box"><h3>التقييمات</h3>${reviews.map((x) => `<div>${stars(x.rating)} ${esc(x.comment)} — ${esc(x.buyerName)} <button class="d" data-act="delrv" data-id="${x.id}">حذف</button></div>`).join('') || '<p class="muted">لا تقييمات</p>'}</div>`;
  },
  er() {
    return `<div class="box"><h2>مخطط قاعدة البيانات (ER)</h2><p class="muted">التنفيذ الفعلي على Cloud Firestore (NoSQL): المجموعات تقابل الجداول، والعلاقات تُمثّل بمعرّفات (FK). Addresses وProductImages وOrderItems مضمّنة داخل مستنداتها، وCart محفوظة في المتصفح كحالة واجهة.</p>
      <div class="grid">${Object.entries(ERT).map(([t, c]) => `<div class="er"><h4>${t}</h4>${c.map((x) => `<div>${esc(x)}</div>`).join('')}</div>`).join('')}</div>
      <p>العلاقات: Users 1─∞ Orders · Orders 1─∞ OrderItems ─∞ Products · Users(seller) 1─∞ Products · Categories 1─∞ Products · Products 1─∞ Reviews · Orders 1─1 Payments · Users 1─∞ Notifications · Users ∞─∞ Products (Favorites).</p></div>`;
  },
};

async function render() {
  nav();
  if (!authReady) return;
  let [v, arg] = (location.hash || '').slice(1).split('/');
  if (!v) v = MODE === 'seller' ? (me ? (me.role === 'admin' ? 'admin' : 'seller') : 'login') : 'store';
  if (!ALLOW[MODE].includes(v)) v = MODE === 'seller' ? 'seller' : 'store';
  if (MODE === 'seller' && !me) v = 'login';
  const el = $('#app'); el.innerHTML = '<p class="muted">جاري التحميل…</p>';
  try { el.innerHTML = await (views[v] || views.store)(arg); } catch (e) { el.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  updateMeter();
}
async function loadMe(u) {
  me = null;
  if (u && !u.isAnonymous) { try { const d = await api('/me'); me = d.role ? d : null; } catch { /* غير مسجّل */ } }
  authReady = true; render();
}
onAuthStateChanged(auth, loadMe);
window.addEventListener('hashchange', render);

function updateMeter() {
  const form = $('#pf'); if (!form) return;
  const fd = new FormData(form);
  const L = { name: 'الاسم', price: 'السعر', stock: 'الكمية', category: 'التصنيف', brand: 'العلامة التجارية', description: 'الوصف', specs: 'المواصفات', keywords: 'الكلمات المفتاحية', returnPolicy: 'سياسة الاسترجاع' };
  const miss = Object.keys(L).filter((k) => !String(fd.get(k) || '').trim()).map((k) => L[k]);
  if (!form.image.files.length && !editing?.images?.length) miss.push('صورة المنتج');
  const n = Object.keys(L).length + 1, pct = Math.round(((n - miss.length) / n) * 100), p = +fd.get('price'), d = +fd.get('discountPrice');
  $('#meter').innerHTML = `<div>اكتمال البيانات: ${pct}٪ ${d && p ? `— نسبة الخصم ${Math.round((1 - d / p) * 100)}٪` : ''}</div><div style="background:#e2e8f0;border-radius:6px"><div style="height:8px;width:${pct}%;background:#14b8a6;border-radius:6px"></div></div>${miss.length ? `<small class="muted">ناقص قبل النشر: ${miss.join('، ')}</small>` : ''}`;
}
const run = async (fn, ok) => { try { await fn(); if (ok) toast(ok); } catch (e) { toast(e.message, true); } };
const body = (fd) => ({ ...fd, keywords: (fd.keywords || '').split(',').map((k) => k.trim()).filter(Boolean) });

document.addEventListener('input', (e) => { if (e.target.form?.id === 'pf') updateMeter(); });
document.addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target, fd = Object.fromEntries(new FormData(form)), id = form.id;
  if (id === 'sf') { f = { ...f, q: fd.q, category: fd.category ?? f.category }; goStore(); }
  if (id === 'lf') run(async () => { await signInWithEmailAndPassword(auth, fd.email, fd.password); await loadMe(auth.currentUser); location.hash = home(); }, 'تم تسجيل الدخول');
  if (id === 'rf') run(async () => {
    await createUserWithEmailAndPassword(auth, fd.email, fd.password);
    await api('/register', { method: 'POST', body: { name: fd.name, phone: fd.phone, role: fd.role, storeName: fd.storeName } });
    await loadMe(auth.currentUser); location.hash = home();
  }, 'تم إنشاء الحساب');
  if (id === 'pf') run(async () => {
    const images = [...(editing?.images || [])];
    for (const file of [...form.image.files].slice(0, 5)) {
      if (file.size > 5 * 1024 * 1024) throw new Error('إحدى الصور أكبر من 5MB');
      const rf = ref(getStorage(fbApp), `products/${auth.currentUser.uid}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${(file.type.split('/')[1] || 'jpg').replace(/[^a-z0-9]/gi, '')}`);
      await uploadBytes(rf, file); images.push(await getDownloadURL(rf));
    }
    const b = { ...body(fd), images: images.slice(0, 8), publish: !!fd.publish }; delete b.image;
    const res = editing ? await api('/products/' + editing.id, { method: 'PUT', body: b }) : await api('/products', { method: 'POST', body: b });
    editing = null; toast(res.status ? 'الحالة: ' + PST[res.status] : 'تم حفظ التعديلات'); location.hash = '#seller'; render();
  });
  if (id === 'cf') run(async () => {
    const line = fd.line || fd.saved; if (!line) throw new Error('عنوان التوصيل مطلوب');
    const items = Object.entries(cart).map(([productId, i]) => ({ productId, qty: i.qty }));
    const res = await api('/orders', { method: 'POST', body: { items, couponCode: fd.couponCode, paymentMethod: fd.pay, address: { name: fd.name, phone: fd.phone, line } } });
    cart = {}; saveCart(); toast(`تم تأكيد الطلب ${res.orderNumber} — ${money(res.total)}`); location.hash = '#orders'; render();
  });
  if (id === 'rvf') run(async () => { await api('/reviews', { method: 'POST', body: { productId: form.dataset.id, rating: fd.rating, comment: fd.comment } }); render(); }, 'شكرًا على تقييمك');
  if (id === 'prf') run(async () => {
    await api('/profile', { method: 'PUT', body: { name: fd.name, phone: fd.phone, storeName: fd.storeName, addresses: fd.addresses.split('\n').map((line) => ({ line: line.trim() })) } });
    await loadMe(auth.currentUser);
  }, 'تم حفظ البيانات');
  if (id === 'catf') run(async () => { await api('/categories', { method: 'POST', body: fd }); render(); }, 'تمت الإضافة');
  if (id === 'cpf') run(async () => { await api('/coupons', { method: 'POST', body: fd }); render(); }, 'تمت الإضافة');
  if (id === 'mf') { $('#planbox').innerHTML = `<div class="box"><textarea id="plantxt" rows="22">${esc(makePlan(fd))}</textarea><button class="p" data-act="copyplan">نسخ الخطة</button> <button class="p" data-act="regen">إعادة إنشاء الاقتراحات</button> <button class="p" data-act="saveplan">حفظ الخطة</button><div class="muted">يمكنك تعديل النص مباشرة قبل النسخ أو الحفظ.</div></div>`; }
});
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b || b.tagName === 'SELECT') return;
  const { act, id } = b.dataset;
  if (b.tagName === 'A') e.preventDefault();
  const again = (fn, ok) => run(async () => { await fn(); render(); }, ok);
  if (act === 'logout') run(() => signOut(auth));
  if (act === 'sort') { f.sort = id; render(); }
  if (act === 'home') { f = { q: '', category: '', sort: 'new' }; goStore(); }
  if (act === 'cat') { f.category = id; f.sort = 'new'; if (!id) f.q = ''; goStore(); }
  if (act === 'img') $('#bigimg').src = id;
  if (act === 'add' || act === 'buy') {
    const p = catalog[id]; cart[id] = { name: p.name, price: p.discountPrice || p.price, list: p.price, qty: (cart[id]?.qty || 0) + 1 }; saveCart(); nav();
    if (act === 'buy') location.hash = '#cart'; else toast('تمت الإضافة إلى السلة');
  }
  if (act === 'inc') { cart[id].qty++; saveCart(); render(); }
  if (act === 'dec') { if (--cart[id].qty < 1) delete cart[id]; saveCart(); render(); }
  if (act === 'rm') { delete cart[id]; saveCart(); render(); }
  if (act === 'fav') again(async () => { await api('/favorites/' + id, { method: 'POST' }); });
  if (act === 'cancelo') again(() => api(`/orders/${id}/cancel`, { method: 'PATCH' }), 'تم إلغاء الطلب');
  if (act === 'editp') { editing = mine[id]; location.hash = '#newproduct'; }
  if (act === 'canceledit') { editing = null; location.hash = '#seller'; }
  if (act === 'delp' && confirm('حذف المنتج نهائيًا؟')) again(() => api('/products/' + id, { method: 'DELETE' }), 'تم الحذف');
  if (act === 'ok' || act === 'no') again(() => api(`/products/${id}/review`, { method: 'PATCH', body: { approve: act === 'ok' } }), 'تم');
  if (act === 'delcat') again(() => api('/categories/' + id, { method: 'DELETE' }));
  if (act === 'delcp') again(() => api('/coupons/' + id, { method: 'DELETE' }));
  if (act === 'delrv') again(() => api('/reviews/' + id, { method: 'DELETE' }));
  if (act === 'block') again(() => api(`/admin/users/${id}/block`, { method: 'PATCH', body: { blocked: b.dataset.b === 'true' } }));
  if (act === 'preview') {
    const fd = Object.fromEntries(new FormData($('#pf'))), file = $('#pf').image.files[0];
    $('#prev').innerHTML = '<h4>معاينة كما سيراها المشتري</h4>' + card({ id: 'preview', name: fd.name || 'اسم المنتج', category: fd.category, price: +fd.price || 0, discountPrice: +fd.discountPrice || null, stock: 1, images: [file ? URL.createObjectURL(file) : editing?.images?.[0] || ''] }).replace(/data-act="[a-z]+"/g, '');
  }
  if (act === 'copyplan') run(() => navigator.clipboard.writeText($('#plantxt').value), 'تم نسخ الخطة');
  if (act === 'regen') { const fd = Object.fromEntries(new FormData($('#mf'))); $('#plantxt').value = makePlan(fd); }
  if (act === 'saveplan') run(() => api('/marketing-plans', { method: 'POST', body: { productName: $('#mf').name.value, plan: $('#plantxt').value } }), 'تم حفظ الخطة');
});
document.addEventListener('change', (e) => {
  const s = e.target.closest('select[data-act]'); if (!s) return;
  if (s.dataset.act === 'status') run(() => api(`/orders/${s.dataset.id}/status`, { method: 'PATCH', body: { status: s.value } }), 'تم تحديث الحالة');
  if (s.dataset.act === 'pickp' && mine[s.value]) { const p = mine[s.value], F = $('#mf'); ['name', 'category', 'price', 'brand', 'description'].forEach((k) => (F[k].value = p[k] ?? '')); }
  if (e.target.form?.id === 'pf') updateMeter();
});
