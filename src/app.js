import './ui.css';

const STORE_KEY = 'souqna-demo-store-v2';
const STORE = '/app.html';
const $ = (s, root = document) => root.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const cash = (v) => `${new Intl.NumberFormat('ar-EG').format(Number(v) || 0)} ج.م`;
const random = (a) => a[Math.floor(Math.random() * a.length)];
const uid = () => Math.random().toString(36).slice(2, 10);
const count = (v) => Number(v || 0).toLocaleString('ar-EG');
const demoProducts = [
  { id:'demo-a1', name:'سماعة لاسلكية بإلغاء ضوضاء', category:'إلكترونيات', brand:'نغمة', price:1290, discountPrice:990, stock:24, views:318, sales:43, status:'published', emoji:'🎧', tone:'lavender', description:'سماعة لاسلكية عملية للاستماع اليومي والعمل، بتصميم مريح وسهل الحمل.', specs:'اتصال لاسلكي · شحن USB-C · ميكروفون مدمج', weight:'240 جم', dimensions:'18 × 16 × 7 سم', origin:'غير محدد', keywords:['سماعة','لاسلكي','صوت'], returnPolicy:'يمكن تعديل السياسة من صفحة المنتج', images:[] },
  { id:'demo-a2', name:'حقيبة يومية بتصميم بسيط', category:'أزياء', brand:'خطوة', price:780, discountPrice:650, stock:15, views:246, sales:31, status:'published', emoji:'👜', tone:'peach', description:'حقيبة يومية بمساحة عملية وتفاصيل أنيقة للاستخدام داخل المدينة.', specs:'حجرة رئيسية · حزام قابل للتعديل', weight:'غير محدد', dimensions:'غير محدد', origin:'غير محدد', keywords:['حقيبة','أزياء','يومي'], returnPolicy:'يمكن تعديل السياسة من صفحة المنتج', images:[] },
  { id:'demo-a3', name:'طقم أكواب قهوة سيراميك', category:'المنزل', brand:'بيت ودفا', price:540, discountPrice:0, stock:28, views:191, sales:22, status:'published', emoji:'☕', tone:'mint', description:'طقم أكواب يضيف لمسة دافئة إلى روتين القهوة اليومي.', specs:'طقم من قطعتين · مناسب للمشروبات الساخنة', weight:'غير محدد', dimensions:'غير محدد', origin:'غير محدد', keywords:['قهوة','أكواب','منزل'], returnPolicy:'يمكن تعديل السياسة من صفحة المنتج', images:[] },
  { id:'demo-a4', name:'مصباح مكتب قابل للتعديل', category:'المنزل', brand:'نور', price:860, discountPrice:725, stock:9, views:174, sales:19, status:'published', emoji:'💡', tone:'blue', description:'إضاءة مكتبية بتصميم مرن تساعد على تنظيم مساحة العمل.', specs:'ذراع قابل للتعديل · زر تشغيل واضح', weight:'غير محدد', dimensions:'غير محدد', origin:'غير محدد', keywords:['مصباح','مكتب','إضاءة'], returnPolicy:'يمكن تعديل السياسة من صفحة المنتج', images:[] },
  { id:'demo-a5', name:'زجاجة مياه حرارية', category:'رياضة', brand:'مدار', price:410, discountPrice:0, stock:37, views:123, sales:14, status:'published', emoji:'🧴', tone:'mint', description:'زجاجة سهلة الحمل تناسب التنقل والأنشطة اليومية.', specs:'غطاء محكم · فتحة واسعة للتنظيف', weight:'غير محدد', dimensions:'غير محدد', origin:'غير محدد', keywords:['زجاجة','رياضة','مياه'], returnPolicy:'يمكن تعديل السياسة من صفحة المنتج', images:[] },
  { id:'demo-a6', name:'دفتر ملاحظات بغلاف قماشي', category:'قرطاسية', brand:'ورقة', price:195, discountPrice:165, stock:42, views:108, sales:12, status:'published', emoji:'📔', tone:'peach', description:'دفتر أنيق لتدوين الأفكار وتنظيم المهام في العمل أو الدراسة.', specs:'ورق مسطر · إغلاق مطاطي', weight:'غير محدد', dimensions:'غير محدد', origin:'غير محدد', keywords:['دفتر','قرطاسية','ملاحظات'], returnPolicy:'يمكن تعديل السياسة من صفحة المنتج', images:[] },
];
function readState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    const user=saved?.user||null, accounts=saved?.accounts||{};
    if(user?.role) accounts[user.role]=user;
    return { products:Array.isArray(saved?.products) && saved.products.length ? saved.products : demoProducts, cart:saved?.cart || {}, orders:saved?.orders || [], user, accounts, plans:saved?.plans || [], favorites:saved?.favorites || [] };
  } catch { return { products:demoProducts, cart:{}, orders:[], user:null, accounts:{}, plans:[], favorites:[] }; }
}
let data = readState();
let timer, query = '', categoryFilter = '', selectedFiles = [];
const mode = document.body.dataset.mode || 'store';
const statusSteps = [['new','تم استلام الطلب'],['confirmed','تم التأكيد'],['preparing','قيد التجهيز'],['shipped','في الطريق'],['completed','تم التسليم']];
function persist() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); return true; }
  catch { toast('تعذّر الحفظ المحلي. جرّب صورًا أصغر أو احذف صورًا قديمة.', true); return false; }
}
function toast(message, error = false) {
  const el = $('#toast'); if (!el) return;
  el.textContent = message; el.classList.toggle('toast-error', error); el.classList.add('toast-visible');
  clearTimeout(timer); timer = setTimeout(() => el.classList.remove('toast-visible'), 3200);
}
function roleLabel(role) { return role === 'seller' ? 'بائع' : 'مشتري'; }
function startDemo(role) {
  if(data.accounts?.[role]) {
    data.user=data.accounts[role];
    persist(); render(); toast(`رجعناك لحساب ${roleLabel(role)} التجريبي.`); return;
  }
  const first = random(['نور','ياسين','مريم','عمر','سلمى','آدم','ليلى','زياد','جنى','مالك']);
  const family = random(['محمود','حسن','علي','إبراهيم','فؤاد','منصور','سامي','خالد']);
  const email = `demo-${uid()}@example.test`, password = `${Math.random().toString(36).slice(2,7)}${Math.floor(100 + Math.random()*900)}`;
  const previous=data.user;
  data.user = { id:`user-${uid()}`, name:`${first} ${family}`, role, email, password, phone:`01${Math.floor(100000000 + Math.random()*900000000)}`, storeName:role === 'seller' ? `${first} ستوديو` : '', addresses:role === 'buyer' ? ['القاهرة، عنوان تجريبي'] : [] };
  data.accounts[role]=data.user;
  if(!persist()){data.user=previous;delete data.accounts[role];return;}
  render(); toast(`أهلًا ${data.user.name} — تم تجهيز حساب ${roleLabel(role)} تجريبي.`);
}
function logout() { data.user = null; persist(); location.href = `${STORE}#login`; }
function nav() {
  const role = data.user?.role, cartCount = Object.values(data.cart).reduce((n, item) => n + item.qty, 0);
  $('#nav').innerHTML = `<div class="nav-shell"><a class="brand" href="${STORE}#store" aria-label="سوقنا - الرئيسية"><span class="brand-icon">س</span><span><strong>سوقنا</strong><small>تجربة متجر محلية</small></span></a>
    <button class="mobile-menu" type="button" data-act="menu" aria-label="فتح القائمة">☰</button>
    <nav class="nav-links" id="nav-links" aria-label="التنقل الرئيسي"><a href="${STORE}#store" class="${mode==='store'?'nav-current':''}">الرئيسية</a><a href="/marketing.html#marketing" class="${mode==='marketing'?'nav-current':''}">التسويق</a><a href="/seller.html#seller" class="${mode==='seller'?'nav-current':''}">لوحة البائع</a><a href="${STORE}#database">🗄 <span>البيانات</span></a></nav>
    <div class="nav-actions">${role?`<a class="nav-icon" href="${STORE}#orders" aria-label="طلباتي" title="طلباتي">🧾</a>`:""}<a class="nav-icon" href="${STORE}#cart" aria-label="السلة" title="السلة">🛒 <b>${cartCount}</b></a>
    ${role ? `<a class="user-pill" href="${STORE}#profile"><span class="avatar">${esc(data.user.name.slice(0,1))}</span><span>${esc(data.user.name)}<small>${roleLabel(role)} تجريبي</small></span></a><button class="nav-logout" data-act="logout">خروج</button>` : `<a class="button button-small button-primary" href="${STORE}#login">ابدأ تجربة مجانية</a>`}</div></div>`;
}
function imageView(product, extra='') {
  if (product.images?.[0]) return `<div class="product-image ${extra}"><img src="${esc(product.images[0])}" alt="${esc(product.name)}" loading="lazy"></div>`;
  return `<div class="product-image art-${esc(product.tone || 'blue')} ${extra}"><span>${esc(product.emoji || '📦')}</span><small>${esc(product.category || 'منتج')}</small></div>`;
}
function productCard(p) {
  const sale = Number(p.discountPrice)>0 && Number(p.discountPrice)<Number(p.price);
  return `<article class="product-card"><a class="product-card-link" href="${STORE}#product/${encodeURIComponent(p.id)}" aria-label="عرض ${esc(p.name)}">${sale?'<span class="sale-pill">عرض</span>':''}${imageView(p)}</a><div class="product-meta"><span>${esc(p.category || 'منتج')}</span><button class="favorite-button" data-act="favorite" data-id="${esc(p.id)}" aria-label="إضافة للمفضلة">${data.favorites.includes(p.id)?'♥':'♡'}</button></div><a class="product-name" href="${STORE}#product/${encodeURIComponent(p.id)}">${esc(p.name)}</a><div class="product-price"><strong>${cash(sale?p.discountPrice:p.price)}</strong>${sale?`<del>${cash(p.price)}</del>`:''}</div><button class="button button-dark button-full" data-act="add" data-id="${esc(p.id)}" ${Number(p.stock)<=0?'disabled':''}>أضف للسلة <span>＋</span></button></article>`;
}
function productList(products) { return products.length?`<div class="product-grid">${products.map(productCard).join('')}</div>`:'<div class="empty-state">لا توجد نتائج الآن. جرّب كلمة أخرى أو اختر قسمًا مختلفًا.</div>'; }
function storePage() {
  const all = data.products.filter((p)=>p.status!=='draft');
  const categories = [...new Set(all.map((p)=>p.category).filter(Boolean))];
  const shown = all.filter((p)=>(!categoryFilter||p.category===categoryFilter)&&(!query||`${p.name} ${p.category} ${p.brand}`.toLocaleLowerCase('ar').includes(query.toLocaleLowerCase('ar'))));
  return `<section class="store-hero"><div class="hero-blob hero-blob-one"></div><div class="hero-blob hero-blob-two"></div><div class="hero-copy"><span class="eyebrow"><i></i> اختيارات يومية، تجربة أسهل</span><h1>كل اللي بتحبه،<br><em>في مكان واحد.</em></h1><p>اكتشف منتجات مميزة من بائعين مستقلين، وجرّب رحلة الشراء خطوة بخطوة.</p><div class="hero-buttons"><a class="button button-primary" href="#catalog">اكتشف المنتجات <span>←</span></a><a class="text-link" href="/seller.html#seller">عندك منتج؟ ابدأ البيع</a></div><div class="hero-proof"><span>✦</span><div><b>${all.length} منتجات معروضة</b><small>تجربة متجر محلية بلا دفع حقيقي</small></div></div></div><div class="hero-showcase"><div class="showcase-card showcase-back">✦ <small>منتجات مختارة</small><b>كل يوم، اكتشاف جديد</b></div><div class="showcase-orbit"></div><div class="showcase-product">👜</div><div class="showcase-tag">اختيار الأسبوع <b>♡</b></div><div class="showcase-note"><span>✳</span><div><b>اختاري براحتك</b><small>السلة والطلبات تجريبية</small></div></div></div></section>
  <main class="page-wrap"><section class="benefit-strip"><div><span>♧</span><b>تسوّق مريح</b><small>استكشف الأقسام بسهولة</small></div><div><span>✧</span><b>تجربة آمنة</b><small>لا توجد عمليات دفع فعلية</small></div><div><span>↗</span><b>دعم البائعين</b><small>منتجات من متاجر مستقلة</small></div></section>
  <section class="catalog-section" id="catalog"><div class="section-title-row"><div><span class="section-kicker">تصفّح على مزاجك</span><h2>منتجات تستحق الاكتشاف</h2><p>اختيارات بسيطة لأيام أجمل.</p></div><form class="catalog-search" id="search-form"><input name="q" value="${esc(query)}" placeholder="ابحث عن منتج…" aria-label="ابحث عن منتج"><button aria-label="بحث">⌕</button></form></div><div class="category-row"><button class="category-chip ${!categoryFilter?'selected':''}" data-act="category" data-id="">الكل</button>${categories.map((c)=>`<button class="category-chip ${categoryFilter===c?'selected':''}" data-act="category" data-id="${esc(c)}">${esc(c)}</button>`).join('')}</div>${productList(shown)}</section>
  <section class="seller-callout"><div><span class="section-kicker">للبائعين</span><h2>عندك منتج يستحق الظهور؟</h2><p>جهّز صفحة منتجك، ارفع صوره، وخلي مساعد الكتابة يساعدك في التفاصيل.</p></div><a class="button button-primary" href="/seller.html#seller">افتح لوحة البائع <span>←</span></a></section><section class="closing-note"><span>✳</span><p><b>ملاحظة:</b> هذه نسخة عرض محلية. الحسابات والمنتجات والطلبات تُحفظ في متصفحك فقط، ولا يوجد دفع أو اتصال بقاعدة بيانات.</p></section></main>`;
}
function productPage(id) {
  const p = data.products.find((x)=>x.id===id);
  if (!p) return `<main class="page-wrap"><div class="empty-state"><h2>المنتج غير موجود</h2><a class="button button-primary" href="${STORE}#store">العودة للمتجر</a></div></main>`;
  const sale = Number(p.discountPrice)>0&&Number(p.discountPrice)<Number(p.price);
  return `<main class="page-wrap product-detail"><a class="back-link" href="${STORE}#store">← العودة للمنتجات</a><div class="detail-layout"><div>${imageView(p,'detail-image')}<div class="closing-note"><span>✳</span><p>الصور والبيانات في هذه التجربة تبقى محفوظة على جهازك.</p></div></div><section class="detail-copy"><span class="section-kicker">${esc(p.category||'منتج')} · ${esc(p.brand||'اختيار مميز')}</span><h1>${esc(p.name)}</h1><div class="detail-price"><strong>${cash(sale?p.discountPrice:p.price)}</strong>${sale?`<del>${cash(p.price)}</del><span class="sale-pill">عرض خاص</span>`:''}</div><p class="detail-description">${esc(p.description||'وصف المنتج غير متوفر.')}</p><div class="availability">${Number(p.stock)>0?`متوفر · ${count(p.stock)} قطعة`:'غير متوفر حاليًا'}</div><div class="detail-facts"><div><small>العلامة</small><b>${esc(p.brand||'غير محدد')}</b></div><div><small>الوزن</small><b>${esc(p.weight||'غير محدد')}</b></div><div><small>الأبعاد</small><b>${esc(p.dimensions||'غير محدد')}</b></div><div><small>المنشأ</small><b>${esc(p.origin||'غير محدد')}</b></div></div><h3>المواصفات</h3><p>${esc(p.specs||'لم تُضف مواصفات بعد.')}</p><p class="policy"><b>سياسة الإرجاع:</b> ${esc(p.returnPolicy||'تُحدد مع البائع.')}</p><div class="detail-actions"><button class="button button-primary" data-act="add" data-id="${esc(p.id)}" ${Number(p.stock)<=0?'disabled':''}>أضف للسلة <span>＋</span></button><button class="button button-outline" data-act="favorite" data-id="${esc(p.id)}">${data.favorites.includes(p.id)?'♥ في المفضلة':'♡ أضف للمفضلة'}</button></div>${p.sellerId===data.user?.id?'<p class="demo-note">هذا منتجك التجريبي.</p>':''}</section></div></main>`;
}
function demoLogin() {
  const credentials = data.user?`<div class="credential-card"><div><span class="success-dot"></span><b>حسابك الحالي تجربة فقط</b></div><p>البريد التجريبي: <code>${esc(data.user.email)}</code></p><p>كلمة المرور التجريبية: <code>${esc(data.user.password)}</code></p><button class="button button-outline" data-act="logout">إنهاء التجربة الحالية</button></div>`:'';
  return `<main class="page-wrap auth-page"><div class="auth-intro"><span class="eyebrow"><i></i> ابدأ التجربة في ثوانٍ</span><h1>جرّب سوقنا<br><em>بدون تسجيل حقيقي.</em></h1><p>اختر دورك، وسننشىء لك بيانات وهمية عشوائية لتجربة المتجر. لا نطلب بريدك ولا نرسل كلمة مرور. لا تستخدم بيانات شخصية أو كلمة مرور حقيقية.</p><div class="auth-safe"><span>🔒</span><div><b>بيانات تجريبية فقط</b><small>تخزين تجريبي غير مشفّر؛ تجنّب البيانات الحقيقية</small></div></div></div><div class="role-cards"><button class="role-card" data-act="start-demo" data-role="buyer"><span class="role-emoji">🛍️</span><small>تجربة التسوّق</small><b>ابدأ كمشتري</b><span>تصفّح، أضف للسلة، وتابع طلبك</span><i>ابدأ التجربة ←</i></button><button class="role-card role-card-seller" data-act="start-demo" data-role="seller"><span class="role-emoji">✳</span><small>تجربة البيع</small><b>ابدأ كبائع</b><span>أضف منتجًا وجهّز خطتك التسويقية</span><i>افتح لوحة البائع ←</i></button></div>${credentials}</main>`;
}
function cartPage() {
  const lines = Object.entries(data.cart).map(([id,item])=>({id,...item,product:data.products.find((p)=>p.id===id)})).filter((item)=>item.product);
  const total = lines.reduce((sum,item)=>sum+item.price*item.qty,0);
  if (!lines.length) return `<main class="page-wrap"><div class="section-heading"><span class="section-kicker">سلتك</span><h1>لسه ما اخترتش حاجة</h1><p>تصفّح المنتجات، وأضف اللي يعجبك للسلة.</p><a class="button button-primary" href="${STORE}#store">اكتشف المنتجات <span>←</span></a></div></main>`;
  return `<main class="page-wrap"><div class="section-heading"><span class="section-kicker">اختياراتك</span><h1>سلة التسوّق</h1><p>راجع التفاصيل قبل تأكيد طلبك التجريبي.</p></div><div class="cart-layout"><div class="cart-list">${lines.map((item)=>`<article class="cart-row">${imageView(item.product)}<div class="cart-info"><b>${esc(item.product.name)}</b><small>${cash(item.price)} للقطعة</small><div class="quantity"><button data-act="quantity" data-id="${esc(item.id)}" data-delta="-1">−</button><b>${item.qty}</b><button data-act="quantity" data-id="${esc(item.id)}" data-delta="1">＋</button><button class="remove-link" data-act="remove-cart" data-id="${esc(item.id)}">إزالة</button></div></div><strong>${cash(item.price*item.qty)}</strong></article>`).join('')}</div><aside class="summary-card"><span>ملخص الطلب</span><div><small>المنتجات</small><b>${cash(total)}</b></div><div><small>الشحن</small><b>تجريبي</b></div><hr><div class="summary-total"><small>الإجمالي</small><b>${cash(total)}</b></div>${data.user?.role==='buyer'?`<form id="checkout-form"><label for="shipping-address">عنوان تجريبي</label><input id="shipping-address" name="address" value="${esc(data.user.addresses?.[0]||'')}" placeholder="اكتب عنوانًا تجريبيًا" required><button class="button button-primary button-full">تأكيد الطلب التجريبي</button></form>`:`<a class="button button-primary button-full" href="${STORE}#login">أنشئ مشتريًا تجريبيًا لإتمام الطلب</a>`}<p class="fine-print">لن يتم تحصيل أي مبلغ. الطلب يبقى على هذا الجهاز فقط.</p></aside></div></main>`;
}
function orderProgress(status) {
  if (status==='cancelled') return '<div class="cancelled-state">تم إلغاء هذا الطلب التجريبي</div>';
  const current = statusSteps.findIndex(([key])=>key===status);
  return `<div class="order-progress">${statusSteps.map(([key,label],i)=>`<div class="progress-step ${i<=current?'step-done':''}"><i>${i<current?'✓':i+1}</i><small>${label}</small></div>`).join('')}</div>`;
}
function ordersPage() {
  if (!data.user) return `<main class="page-wrap"><div class="section-heading"><h1>طلباتي</h1><p>ابدأ تجربة كمشتري لمتابعة الطلبات.</p><a class="button button-primary" href="${STORE}#login">ابدأ كمشتري</a></div></main>`;
  const orders = data.user.role==='buyer'?data.orders.filter((o)=>o.buyerId===data.user.id):data.orders.filter((o)=>o.items.some((item)=>item.sellerId===data.user.id));
  return `<main class="page-wrap"><div class="section-heading"><span class="section-kicker">متابعة واضحة</span><h1>${data.user.role==='buyer'?'طلباتي التجريبية':'طلبات متجري'}</h1><p>كل المراحل محاكاة محلية للتجربة.</p></div>${orders.length?`<div class="orders-list">${orders.slice().reverse().map((o)=>`<article class="order-card"><div class="order-card-head"><div><small>رقم الطلب التجريبي</small><b>${esc(o.number)}</b></div><span class="order-status">${esc(o.statusLabel)}</span><strong>${cash(o.total)}</strong></div><div class="order-items">${o.items.filter((item)=>data.user.role==='buyer'||item.sellerId===data.user.id).map((item)=>`<span>${esc(item.name)} <b>× ${item.qty}</b></span>`).join('')}</div><div class="muted-line">${data.user.role==='buyer'?'عنوان التسليم التجريبي: '+esc(o.address):'المشتري: '+esc(o.buyerName)}</div>${orderProgress(o.status)}${data.user.role==='seller'&&o.status!=='completed'&&o.status!=='cancelled'?`<button class="button button-outline" data-act="advance-order" data-id="${esc(o.id)}">تحديث المرحلة التالية ←</button>`:''}</article>`).join('')}</div>`:'<div class="empty-state"><h2>لا توجد طلبات حتى الآن</h2><p>أنشئ طلبًا تجريبيًا من السلة لتظهر خطوات المتابعة هنا.</p><a class="button button-outline" href="/app.html#store">تصفّح المنتجات</a></div>'}</main>`;
}
function profilePage() {
  if (!data.user) return `<main class="page-wrap"><div class="section-heading"><h1>ملفي التجريبي</h1><p>ابدأ تجربة لمشاهدة ملفك.</p><a class="button button-primary" href="${STORE}#login">ابدأ التجربة</a></div></main>`;
  return `<main class="page-wrap"><div class="section-heading"><span class="section-kicker">بيانات محلية</span><h1>ملفي التجريبي</h1><p>يمكنك تعديل اسم العرض. الحساب ليس حقيقيًا ولا يوجد تسجيل دخول إلى خادم.</p></div><form class="form-card narrow-form" id="profile-form"><label>اسم العرض<input name="name" value="${esc(data.user.name)}" required></label><label>الدور<input value="${roleLabel(data.user.role)}" disabled></label><label>البريد العشوائي التجريبي<input value="${esc(data.user.email)}" disabled></label>${data.user.role==='seller'?`<label>اسم المتجر<input name="storeName" value="${esc(data.user.storeName)}"></label>`:`<label>عنوان تجريبي<input name="address" value="${esc(data.user.addresses?.[0]||'')}"></label>`}<button class="button button-primary">حفظ التعديلات</button><button type="button" class="button button-outline" data-act="logout">إنهاء التجربة</button></form></main>`;
}
function sellerDashboard() {
  if (data.user?.role!=='seller') return `<main class="page-wrap"><div class="seller-welcome"><span class="section-kicker">مساحة البائع</span><h1>أطلق عرضك<br><em>بطريقتك.</em></h1><p>جهّز منتجك وصوره وخطة تسويقه في مكان واحد.</p><button class="button button-primary" data-act="start-demo" data-role="seller">ابدأ كبائع تجريبي <span>←</span></button></div></main>`;
  const products=data.products.filter((p)=>p.sellerId===data.user.id), orders=data.orders.filter((o)=>o.items.some((i)=>i.sellerId===data.user.id));
  const sales=orders.reduce((sum,o)=>sum+o.items.filter((i)=>i.sellerId===data.user.id).reduce((sub,i)=>sub+i.price*i.qty,0),0);
  return `<main class="page-wrap seller-page"><div class="dash-heading"><div><span class="section-kicker">مساحة البائع</span><h1>أهلًا ${esc(data.user.name)} <span>✳</span></h1><p>دي مساحة تجريبية لترتيب منتجاتك ومتابعة طلباتك.</p></div><button class="button button-primary" data-act="new-product">＋ أضف منتجًا</button></div><div class="stat-grid"><article><span>📦</span><small>منتجاتي</small><b>${products.length}</b></article><article><span>🛒</span><small>الطلبات</small><b>${orders.length}</b></article><article><span>👁</span><small>مشاهدات تجريبية</small><b>${products.reduce((n,p)=>n+(p.views||0),0)}</b></article><article><span>✦</span><small>قيمة الطلبات</small><b>${cash(sales)}</b></article></div><div class="seller-shortcuts"><a href="/marketing.html#marketing"><span>✦</span><div><b>خطة تسويق ذكية</b><small>اقتراحات محتوى وخطوات عملية لمنتجك</small></div><i>←</i></a><a href="/app.html#orders"><span>↗</span><div><b>متابعة الطلبات</b><small>اعرف المرحلة التالية لكل طلب</small></div><i>←</i></a></div><div class="section-title-row seller-products-title"><div><span class="section-kicker">إدارة المخزون</span><h2>منتجاتك</h2></div></div>${products.length?`<div class="seller-product-list">${products.map((p)=>`<article class="seller-product-row">${imageView(p)}<div class="seller-product-info"><b>${esc(p.name)}</b><small>${esc(p.category)} · مخزون ${count(p.stock)}</small><strong>${cash(p.price)} <span class="status-tag ${p.status==='published'?'status-live':''}">${p.status==='published'?'معروض':'مسودة'}</span></strong></div><button class="button button-outline" data-act="edit-product" data-id="${esc(p.id)}">تعديل</button><button class="icon-danger" data-act="delete-product" data-id="${esc(p.id)}" aria-label="حذف المنتج">×</button></article>`).join('')}</div>`:'<div class="empty-state"><h2>ابدأ بأول منتج</h2><p>أضف صورة وتفاصيل المنتج، ثم جهّز اقتراحات التسويق.</p><button class="button button-primary" data-act="new-product">＋ أضف منتجك الأول</button></div>'}</main>`;
}
const productFields=[['name','اسم المنتج','مثال: حقيبة يومية بتصميم بسيط','text',true],['price','السعر الأساسي بالجنيه','0','number',true],['discountPrice','سعر العرض (اختياري)','اتركه فارغًا بدون خصم','number',false],['stock','الكمية المتاحة','مثال: 12','number',true],['category','التصنيف','إلكترونيات، أزياء، منزل…','text',true],['brand','العلامة التجارية','اسم العلامة أو غير محدد','text',false],['weight','الوزن','مثال: 250 جم أو غير محدد','text',false],['dimensions','الأبعاد','مثال: 20 × 12 × 5 سم','text',false],['origin','بلد المنشأ','بلد المنشأ أو غير محدد','text',false],['keywords','كلمات مفتاحية','افصل الكلمات بفواصل','text',false],['returnPolicy','سياسة الاستبدال والإرجاع','اكتب سياستك أو غير محدد','text',false]];
function productForm() {
  if(data.user?.role!=='seller') return `<main class="page-wrap"><div class="empty-state"><h2>ابدأ كتاجر تجريبي لإضافة منتج</h2><button class="button button-primary" data-act="start-demo" data-role="seller">ابدأ كتاجر تجريبي</button></div></main>`;
  const p=data.products.find((entry)=>entry.id===data.editingId)||{};
  const fields=productFields.map(([key,label,placeholder,type,required])=>`<label class="field-${key}">${label}${required?' <span class="required">*</span>':''}<input name="${key}" type="${type}" ${type==='number'?'min="0" step="any"':''} placeholder="${esc(placeholder)}" value="${esc(p[key]??'')}" ${required?'required':''}></label>`).join('');
  const current=p.images||[]; selectedFiles=[];
  return `<main class="page-wrap form-page"><a class="back-link" href="/seller.html#seller">← لوحة البائع</a><div class="form-intro"><span class="section-kicker">${p.id?'تحديث المنتج':'منتج جديد'}</span><h1>${p.id?'تعديل التفاصيل':'خلّي منتجك يبان.'}</h1><p>اكتب المعلومات المؤكدة. المساعد يقترح صياغة أفضل، وأنت تراجعها قبل الحفظ.</p></div><form id="product-form" class="product-form">
    <section class="form-card"><div class="form-section-heading"><span>01</span><div><h2>صور المنتج</h2><p>صورة واضحة بتساعد المشتري يتعرف على منتجك.</p></div></div><div class="upload-box" id="upload-dropzone"><div class="upload-icon">↥</div><b>اسحب الصور هنا أو اختر من جهازك</b><small>حتى 4 صور · الصور تبقى محفوظة على جهازك في هذا النموذج</small><label class="button button-outline upload-button" for="product-images">اختر الصور</label><input id="product-images" name="imageFiles" type="file" accept="image/*" multiple hidden><div id="image-preview" class="upload-preview">${current.map((img)=>`<img src="${esc(img)}" alt="صورة المنتج">`).join('')}</div></div></section>
    <section class="form-card"><div class="form-section-heading"><span>02</span><div><h2>معلومات المنتج</h2><p>التفاصيل الأساسية والسعر والمخزون.</p></div><div class="completion"><b id="completion-value">0٪</b><small>اكتمال الحقول</small></div></div><div class="form-grid">${fields}</div><div class="assistant-box"><div class="assistant-head"><span>✦</span><div><b>مساعد الكتابة الذكي</b><small>اقتراحات محلية تجريبية — راجع صحة أي معلومة قبل النشر.</small></div></div><div class="assistant-actions"><button type="button" class="button button-outline" data-act="suggest-product">✦ اقترح المعلومات الناقصة</button><button type="button" class="button button-ghost" data-act="polish-product">تصحيح وتحسين النص</button></div></div></section>
    <section class="form-card"><div class="form-section-heading"><span>03</span><div><h2>الوصف والمواصفات</h2><p>قدّم معلومات صادقة وواضحة عن المنتج.</p></div></div><label>وصف المنتج<textarea name="description" rows="4" placeholder="ما الذي يميز المنتج؟ اكتب معلومات دقيقة.">${esc(p.description||'')}</textarea></label><label>المواصفات<textarea name="specs" rows="3" placeholder="الخامة، طريقة الاستخدام، المحتويات…">${esc(p.specs||'')}</textarea></label><div class="form-actions"><label class="publish-check"><input name="publish" type="checkbox" ${p.status==='published'||!p.id?'checked':''}> عرض المنتج في واجهة المتجر التجريبية</label><button class="button button-primary">${p.id?'حفظ التعديلات':'حفظ المنتج'} <span>←</span></button><button type="button" class="button button-outline" data-act="preview-product">معاينة</button></div><div id="product-preview"></div></section></form></main>`;
}
function cleanText(v) { return String(v||'').replace(/\s+/g,' ').replace(/\s+([،,.!?؟])/g,'$1').replace(/([،,.!?؟]){2,}/g,'$1').trim(); }
function fixText(value) {
  const fixes={جوده:'جودة',مميزز:'مميز',منتجج:'منتج',المنتجج:'المنتج',سريعه:'سريعة',عمليه:'عملية',اقتصاديه:'اقتصادية',مريحه:'مريحة',متينه:'متينة',ممتازه:'ممتازة','للاستخدام اليومى':'للاستخدام اليومي'};
  return cleanText(value).replace(/جوده|مميزز|منتجج|المنتجج|سريعه|عمليه|اقتصاديه|مريحه|متينه|ممتازه|للاستخدام اليومى/g,(word)=>fixes[word]);
}
function suggestMissing(form) {
  const field=(key)=>form.elements[key], name=fixText(field('name')?.value||'');
  if(field('name')) field('name').value=name;
  let category=cleanText(field('category')?.value||'');
  if(!category&&name){const s=name.toLocaleLowerCase('ar'); category=/سماعة|هاتف|شاحن|إلكترون|بلوتوث/.test(s)?'إلكترونيات':/حقيبة|ملابس|قميص|حذاء/.test(s)?'أزياء':/كوب|مصباح|منزل|مطبخ/.test(s)?'المنزل':'منتجات متنوعة';field('category').value=category;}
  if(field('brand')&&!field('brand').value.trim()) field('brand').value='غير محدد';
  for(const key of ['weight','dimensions','origin']) if(field(key)&&!field(key).value.trim()) field(key).value='غير محدد';
  if(field('returnPolicy')&&!field('returnPolicy').value.trim()) field('returnPolicy').value='تُحدد سياسة الاستبدال والإرجاع مع البائع';
  if(field('keywords')&&!field('keywords').value.trim()&&name) field('keywords').value=[...new Set([name,category,'تسوق أونلاين'])].join('، ');
  if(field('description')&&!field('description').value.trim()&&name) field('description').value=`${name} من فئة ${category||'منتجات متنوعة'}. أضف هنا تفاصيل الاستخدام والخامة والمميزات المؤكدة قبل النشر.`;
  if(field('specs')&&!field('specs').value.trim()) field('specs').value='أضف الخامة والمقاس ومحتويات العبوة ومعلومات الاستخدام المؤكدة.';
  updateCompletion(form);toast('أضفنا اقتراحات أولية. راجعها وأكمل الحقول التي تحتاج بيانات دقيقة.');
}
function polishForm(form) {
  for(const key of ['name','brand','weight','dimensions','origin','keywords','returnPolicy','description','specs']) if(form.elements[key]?.value) form.elements[key].value=fixText(form.elements[key].value);
  updateCompletion(form);toast('نقّحنا المسافات وبعض الأخطاء الشائعة محليًا.');
}
function updateCompletion(form) {
  const el=$('#completion-value'); if(!el||!form)return;
  const fields=['name','price','stock','category','brand','keywords','returnPolicy','description','specs'];
  const completed=fields.filter((key)=>String(form.elements[key]?.value||'').trim()).length+((form.elements.imageFiles?.files?.length||data.products.find((entry)=>entry.id===data.editingId)?.images?.length)?1:0);
  el.textContent=`${Math.round(completed/(fields.length+1)*100)}٪`;
}
function fileToSmallJpeg(file) {
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('تعذرت قراءة الصورة'));reader.onload=()=>{const image=new Image();image.onerror=()=>reject(new Error('صيغة الصورة غير مدعومة'));image.onload=()=>{const scale=Math.min(1,980/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',.68));};image.src=reader.result;};reader.readAsDataURL(file);});
}
function campaignText(p) {
  const name=cleanText(p.name)||'منتجك', category=cleanText(p.category)||'الفئة', price=Number(p.price)||0;
  const audience=category==='إلكترونيات'?'الأشخاص المهتمون بالتقنية والاستخدام اليومي':category==='أزياء'?'المهتمون بالموضة العملية والاختيارات اليومية':category==='المنزل'?'الأسر ومحبو ترتيب المساحات المنزلية':`المهتمون بفئة ${category} والتسوق عبر الهاتف`;
  const keywords=[...new Set([name,category,p.brand,`شراء ${category}`,'تسوق أونلاين'].filter(Boolean))].join('، ');
  const priceIdea=price?`${cash(Math.round(price*.95))} إلى ${cash(Math.round(price*1.08))} كتجربة اختبارية فقط، بعد حساب التكلفة وهامش الربح.`:'أضف السعر والتكلفة ثم قارِن بثلاثة منتجات مشابهة قبل تحديد السعر.';
  return `خطة تسويق تجريبية — ${name}\n━━━━━━━━━━━━━━━━━━━━\n\n01 | الجمهور المقترح\n${audience}. اختبر الفئة على منشورين مختلفين، ولا تعتبرها نتيجة بحث سوق حقيقية.\n\n02 | الرسالة والعنوان\n${name} — اختيار عملي ليومك\n${cleanText(p.description)||'أظهر الفائدة المؤكدة للمنتج مع صورة واضحة ومعلومة عملية.'}\n\n03 | السعر\n${priceIdea}\n\n04 | كلمات البحث (SEO)\n${keywords}\nأضف اسم العلامة أو المقاس إن كان مؤكدًا، ولا تستخدم ادعاءات غير موثّقة.\n\n05 | نصوص جاهزة للتعديل\n• وصل ${name} — شاهد التفاصيل واختر اللي يناسبك.\n• بتدور على ${category}؟ تعرّف على ${name} ومواصفاته.\n• لقطة قريبة + معلومة واحدة مؤكدة + رابط صفحة المنتج.\n\n06 | خطوات العمل خلال 30 يومًا\nالأسبوع 1: راجع الصورة والعنوان والوصف، واطلب من شخصين قراءة الصفحة.\nالأسبوع 2: انشر مقطعين قصيرين يوضحان الاستخدام الحقيقي بدون مبالغة.\nالأسبوع 3: جرّب عرضًا محدود المدة بعد حساب هامش الربح وتكلفة الشحن.\nالأسبوع 4: قارن المشاهدات والنقرات والطلبات التجريبية، وكرّر المحتوى الأوضح.\n\n07 | جدول نشر أسبوعي مقترح\nالسبت: صورة المنتج + فائدة واحدة.\nالاثنين: إجابة سؤال شائع عن المقاس أو الاستخدام.\nالأربعاء: فيديو قصير يوضح التفاصيل الواقعية.\nالجمعة: تذكير بالعروض أو رابط صفحة المنتج.\n\n08 | مؤشرات للمتابعة\nنسبة النقر إلى صفحة المنتج · الإضافة للسلة · اكتمال الطلب · رسائل الاستفسار. دوّن الأرقام الفعلية أسبوعيًا ولا تفترض أن التفاعل يساوي المبيعات.\n\n⚠ هذه اقتراحات عامة محلية وليست تحليلًا لبيانات السوق أو ضمانًا للمبيعات.`;
}
function renderCampaignResult(product) {
  $('#campaign-result').innerHTML=`<div class="result-card"><div class="result-head"><div><span class="section-kicker">اقتراح جاهز للتعديل</span><h2>خطة ${esc(product.name)}</h2></div><span class="result-spark">✦</span></div><textarea id="campaign-text" rows="23" aria-label="خطة التسويق المقترحة">${esc(campaignText(product))}</textarea><div class="result-actions"><button class="button button-primary" data-act="copy-campaign">نسخ الخطة</button><button class="button button-outline" data-act="save-campaign" ${data.user?.role==='seller'?'':'disabled'}>حفظها في تجاربك</button></div><p class="fine-print">الخطة نص إرشادي تجريبي؛ راجع البيانات والادعاءات والأسعار قبل النشر.</p></div>`;
}
function databasePage() {
  const rows=[['حسابات التجربة','دور عشوائي، اسم وبريد وكلمة مرور وهمية'],['المنتجات','التفاصيل والصور وبيانات المخزون'],['السلة والطلبات','الكمية والعنوان ومراحل الطلب'],['خطة التسويق','النص الذي أنشأه المستخدم']];
  return `<main class="page-wrap database-page"><div class="section-heading"><span class="section-kicker">شفافية قبل كل شيء</span><h1>مخطط البيانات</h1><p>هذه الصفحة تعرض شكل البيانات التي تحاكيها التجربة؛ لا توجد قاعدة بيانات متصلة.</p></div><div class="local-storage-banner"><span>▣</span><div><b>لا يوجد خادم أو قاعدة بيانات فعلية</b><small>تُحفظ بيانات العرض داخل تخزين المتصفح (localStorage) على هذا الجهاز فقط. لا تُرسل معلوماتك لأي مكان. التخزين غير مشفّر؛ لا تدخل بيانات أو كلمات مرور حقيقية.</small></div><strong>محلي</strong></div><div class="data-entity-grid">${rows.map(([name,description],i)=>`<article class="data-entity"><span class="entity-number">0${i+1}</span><h2>${name}</h2><p>${description}</p><small>محلي فقط</small></article>`).join('')}</div><div class="data-flow"><span>المستخدم</span><i>→</i><span>المنتجات</span><i>→</i><span>السلة</span><i>→</i><span>طلب تجريبي</span></div><div class="closing-note"><span>✳</span><p><b>إعادة ضبط التجربة:</b> يمكنك حذف بيانات هذا النموذج المحلي من الزر أدناه. لن يؤثر ذلك على أي نظام خارجي. التخزين المحلي غير مشفّر، فتجنّب المعلومات الحساسة.</p></div><button class="button button-outline" data-act="reset-demo">مسح بيانات التجربة من هذا الجهاز</button></main>`;
}
function campaignPage() {
  const own=data.user?.role==='seller'?data.products.filter((p)=>p.sellerId===data.user.id):[];
  return `<main class="page-wrap campaign-page"><section class="campaign-hero"><div><span class="eyebrow"><i></i> استوديو نمو المتجر</span><h1>سوّق بذكاء.<br><em>خطوة بخطوة.</em></h1><p>حوّل معلومات منتجك إلى خطة محتوى قابلة للتنفيذ. عدّل الاقتراحات قبل استخدامها.</p></div><div class="campaign-badge"><span>✦</span><b>خطة عملية<br>بـ 30 يومًا</b></div></section><div class="campaign-layout"><form id="campaign-form" class="form-card campaign-form"><div class="form-section-heading"><span>✦</span><div><h2>من أين نبدأ؟</h2><p>أدخل تفاصيل منتجك للحصول على اقتراحات مناسبة.</p></div></div>${own.length?`<label>اختر من منتجات متجرك<select name="productId"><option value="">اختيار منتج…</option>${own.map((p)=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label>`:''}<label>اسم المنتج<input name="name" placeholder="مثال: حقيبة يومية" required></label><label>الفئة<input name="category" placeholder="مثال: أزياء" required></label><div class="form-grid campaign-inputs"><label>السعر بالجنيه<input type="number" name="price" min="0" placeholder="اختياري"></label><label>العلامة التجارية<input name="brand" placeholder="اختياري"></label></div><label>ما الفائدة الأساسية للعميل؟<textarea name="description" rows="3" placeholder="اكتب فائدة أو ميزة مؤكدة"></textarea></label><button class="button button-primary button-full">أنشئ خطة التسويق <span>✦</span></button><p class="fine-print">مولّد اقتراحات محلي تجريبي — لا يتصل بخدمة ذكاء اصطناعي خارجية ولا يضمن نتائج البيع.</p></form><section id="campaign-result" class="campaign-result"><div class="result-placeholder"><span>✦</span><h2>خطتك تبدأ من هنا</h2><p>أكمل بيانات منتجك واضغط «أنشئ خطة التسويق» لتظهر خطة المحتوى والخطوات المقترحة.</p><div><i>01 تحديد الجمهور</i><i>02 كتابة المحتوى</i><i>03 متابعة النتائج</i></div></div></section></div></main>`;
}
const views={store:storePage,login:demoLogin,cart:cartPage,orders:ordersPage,profile:profilePage,database:databasePage,favorites:()=>`<main class="page-wrap"><div class="section-heading"><h1>مفضلتي</h1><p>المنتجات التي حفظتها أثناء هذه التجربة.</p></div>${productList(data.products.filter((p)=>data.favorites.includes(p.id)))}</main>`,marketing:campaignPage,seller:sellerDashboard,newproduct:productForm};
function render() {
  nav(); let [page,arg]=(location.hash||'').slice(1).split('/');
  if(!page) page=mode==='seller'?'seller':mode==='marketing'?'marketing':'store';
  const allowed=mode==='seller'?['seller','newproduct','orders','profile']:mode==='marketing'?['marketing']:['store','product','login','cart','orders','profile','database','favorites'];
  if(!allowed.includes(page)) page=mode==='seller'?'seller':mode==='marketing'?'marketing':'store';
  $('#app').innerHTML=page==='product'?productPage(decodeURIComponent(arg||'')):views[page]();
  if($('#product-form')) updateCompletion($('#product-form'));
}
function setPage(page,target=STORE) { location.href=`${target}#${page}`; }
function addToCart(id) {
  const product=data.products.find((p)=>p.id===id); if(!product)return;
  const current=data.cart[id]?.qty||0, stock=Number(product.stock)||0;
  if(stock<1){toast('نفدت الكمية في هذه التجربة.',true);return;}
  if(current>=stock){toast(`المتاح ${count(stock)} قطعة فقط.`,true);return;}
  data.cart[id]={qty:current+1,price:Number(product.discountPrice)>0&&Number(product.discountPrice)<Number(product.price)?Number(product.discountPrice):Number(product.price)};
  persist(); nav(); toast('أُضيف المنتج إلى سلتك التجريبية.');
}
function productValues(form) {
  const fd=new FormData(form), out={};
  for(const [key,value] of fd.entries()) if(typeof value==='string') out[key]=cleanText(value);
  out.price=Number(out.price||0);out.discountPrice=Number(out.discountPrice||0);out.stock=Number(out.stock||0);
  out.keywords=(out.keywords||'').split(/[،,]/).map(cleanText).filter(Boolean);out.status=fd.has('publish')?'published':'draft';return out;
}
window.addEventListener('hashchange',render);
document.addEventListener('click',async(event)=>{
  const button=event.target.closest('[data-act]');if(!button)return;
  const {act,id}=button.dataset;
  if(act==='start-demo'){startDemo(button.dataset.role||'buyer');return;}
  if(act==='logout'){logout();return;}
  if(act==='menu'){$('#nav-links')?.classList.toggle('nav-open');return;}
  if(act==='category'){categoryFilter=id||'';render();$('#catalog')?.scrollIntoView({behavior:'smooth'});return;}
  if(act==='add'){addToCart(id);return;}
  if(act==='quantity'){const next=(data.cart[id]?.qty||0)+Number(button.dataset.delta),product=data.products.find((p)=>p.id===id);if(next<1)delete data.cart[id];else if(product&&next>Number(product.stock)){toast(`المتاح ${count(product.stock)} قطعة فقط.`,true);return;}else data.cart[id].qty=next;persist();render();return;}
  if(act==='remove-cart'){delete data.cart[id];persist();render();return;}
  if(act==='favorite'){data.favorites=data.favorites.includes(id)?data.favorites.filter((x)=>x!==id):[...data.favorites,id];persist();render();return;}
  if(act==='new-product'){data.editingId='';persist();setPage('newproduct','/seller.html');return;}
  if(act==='edit-product'){data.editingId=id;persist();setPage('newproduct','/seller.html');return;}
  if(act==='delete-product'){data.products=data.products.filter((p)=>p.id!==id);persist();render();toast('تم حذف المنتج من بيانات التجربة.');return;}
  if(act==='suggest-product'){if($('#product-form'))suggestMissing($('#product-form'));return;}
  if(act==='polish-product'){if($('#product-form'))polishForm($('#product-form'));return;}
  if(act==='preview-product'){
    const form=$('#product-form');if(!form)return;const p={...productValues(form),id:'preview',images:selectedFiles.length?[selectedFiles[0]]:data.products.find((entry)=>entry.id===data.editingId)?.images||[]};
    $('#product-preview').innerHTML=`<div class="preview-area"><span class="section-kicker">معاينة البطاقة</span>${productCard(p)}</div>`;return;
  }
  if(act==='advance-order'){const order=data.orders.find((o)=>o.id===id);if(!order)return;const i=statusSteps.findIndex(([key])=>key===order.status);if(i>=0&&i<statusSteps.length-1){order.status=statusSteps[i+1][0];order.statusLabel=statusSteps[i+1][1];persist();render();toast('تم تحديث خطوة الطلب التجريبي.');}return;}
  if(act==='copy-campaign'){try{await navigator.clipboard.writeText($('#campaign-text')?.value||'');toast('تم نسخ الخطة.');}catch{$('#campaign-text')?.select();toast('حدّد النص ثم انسخه يدويًا.');}return;}
  if(act==='save-campaign'){if(!window.lastCampaignProduct)return;data.plans.push({id:uid(),name:window.lastCampaignProduct.name,text:$('#campaign-text')?.value||campaignText(window.lastCampaignProduct),savedAt:new Date().toISOString()});persist();toast('تم حفظ الخطة محليًا في هذه التجربة.');return;}
  if(act==='reset-demo'){if(!confirm('مسح جميع بيانات التجربة المحلية من هذا المتصفح؟'))return;localStorage.removeItem(STORE_KEY);location.href=`${STORE}#store`;return;}
});
document.addEventListener('input',(event)=>{if(event.target.form?.id==='product-form')updateCompletion(event.target.form);});
document.addEventListener('change',async(event)=>{
  if(event.target.id==='product-images'){
    const files=[...event.target.files].slice(0,4);
    if(files.some((file)=>!file.type.startsWith('image/'))){toast('اختر ملفات صور فقط.',true);return;}
    if(files.some((file)=>file.size>12*1024*1024)){toast('حجم الصورة الواحدة يجب ألا يتجاوز 12 ميجابايت.',true);return;}
    try{selectedFiles=await Promise.all(files.map(fileToSmallJpeg));$('#image-preview').innerHTML=selectedFiles.map((img)=>`<img src="${img}" alt="معاينة صورة المنتج">`).join('');updateCompletion($('#product-form'));}
    catch(error){toast(error.message||'تعذّر تحميل الصور.',true);}return;
  }
  if(event.target.matches('select[name="productId"]')){
    const p=data.products.find((entry)=>entry.id===event.target.value);if(!p)return;const form=event.target.form;
    for(const [key,value] of Object.entries({name:p.name,category:p.category,price:p.price,brand:p.brand||'',description:p.description||''}))if(form.elements[key])form.elements[key].value=value;
  }
});
document.addEventListener('dragover',(event)=>{if(event.target.closest('#upload-dropzone'))event.preventDefault();});
document.addEventListener('drop',(event)=>{
  if(!event.target.closest('#upload-dropzone'))return;
  event.preventDefault();
  const input=$('#product-images');
  if(input&&event.dataTransfer?.files?.length){input.files=event.dataTransfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));}
});
document.addEventListener('submit',async(event)=>{
  event.preventDefault();const form=event.target;
  if(form.id==='search-form'){query=cleanText(new FormData(form).get('q'));render();$('#catalog')?.scrollIntoView({behavior:'smooth'});return;}
  if(form.id==='product-form'){
    const p=productValues(form);if(!p.name||!p.category||p.price<=0){toast('أكمل اسم المنتج والتصنيف والسعر بصورة صحيحة.',true);return;}
    if(p.discountPrice>0&&p.discountPrice>=p.price){toast('سعر العرض يجب أن يكون أقل من السعر الأساسي.',true);return;}
    const old=data.products.find((entry)=>entry.id===data.editingId)||null, previousProducts=data.products.slice(), previousCart=Object.fromEntries(Object.entries(data.cart).map(([key,value])=>[key,{...value}]));let images=old?.images||[];if(selectedFiles.length)images=[...images,...selectedFiles].slice(-4);
    const saved={...old,...p,images,sellerId:data.user.id,emoji:old?.emoji||'📦',tone:old?.tone||random(['blue','mint','peach','lavender']),views:old?.views||0,sales:old?.sales||0,id:old?.id||`product-${uid()}`};
    if(old)data.products=data.products.map((entry)=>entry.id===old.id?saved:entry);else data.products.unshift(saved);
    if(data.cart[saved.id]){data.cart[saved.id].qty=Math.min(data.cart[saved.id].qty,Number(saved.stock)||0);if(!data.cart[saved.id].qty)delete data.cart[saved.id];else data.cart[saved.id].price=Number(saved.discountPrice)>0&&Number(saved.discountPrice)<Number(saved.price)?Number(saved.discountPrice):Number(saved.price);}
    const previousEditingId=data.editingId;data.editingId='';if(!persist()){data.products=previousProducts;data.cart=previousCart;data.editingId=previousEditingId;return;}setPage('seller','/seller.html');return;
  }
  if(form.id==='checkout-form'){
    if(data.user?.role!=='buyer'){setPage('login');return;}
    const entries=Object.entries(data.cart),invalid=entries.find(([productId,item])=>{const p=data.products.find((entry)=>entry.id===productId);return !p||item.qty>Number(p.stock)||Number(p.stock)<1;});
    if(invalid){toast('الكمية المطلوبة أكبر من المخزون المتاح؛ راجع سلتك.',true);return;}
    const previousProducts=data.products.map((p)=>({...p})),previousOrders=data.orders.slice(),previousCart=Object.fromEntries(entries.map(([key,value])=>[key,{...value}]));
    const items=entries.map(([productId,item])=>{const p=data.products.find((entry)=>entry.id===productId),sellerId=p.sellerId||`demo-seller-${productId}`;p.stock=Number(p.stock)-item.qty;p.sales=(p.sales||0)+item.qty;return{productId,name:p.name,qty:item.qty,price:item.price,sellerId};});
    if(!items.length){toast('سلتك فارغة.',true);return;}
    const number=`SQ-${Math.floor(100000+Math.random()*900000)}`;
    const order={id:`order-${uid()}`,number,buyerId:data.user.id,buyerName:data.user.name,address:cleanText(new FormData(form).get('address')),items,total:items.reduce((sum,item)=>sum+item.qty*item.price,0),status:'new',statusLabel:statusSteps[0][1],createdAt:new Date().toISOString()};
    data.orders.push(order);data.cart={};if(!persist()){data.products=previousProducts;data.orders=previousOrders;data.cart=previousCart;return;}setPage('orders');toast(`تم إنشاء الطلب التجريبي ${number}.`);return;
  }
  if(form.id==='profile-form'){const fd=new FormData(form);data.user.name=cleanText(fd.get('name'))||data.user.name;if(data.user.role==='seller')data.user.storeName=cleanText(fd.get('storeName'));else data.user.addresses=[cleanText(fd.get('address'))];data.accounts[data.user.role]=data.user;persist();render();toast('تم حفظ التعديلات محليًا.');return;}
  if(form.id==='campaign-form'){
    const fd=new FormData(form),selected=data.products.find((p)=>p.id===fd.get('productId'));
    const p=selected?{...selected}:{name:cleanText(fd.get('name')),category:cleanText(fd.get('category')),price:Number(fd.get('price')||0),brand:cleanText(fd.get('brand')),description:cleanText(fd.get('description'))};
    if(!p.name||!p.category){toast('أدخل اسم المنتج والفئة.',true);return;}window.lastCampaignProduct=p;renderCampaignResult(p);toast('جهزنا خطة مقترحة. راجعها وعدّلها قبل الاستخدام.');
  }
});
if(!data.products.length)data.products=demoProducts;
render();
