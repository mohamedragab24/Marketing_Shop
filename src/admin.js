const tabs = [
  ['overview', 'نظرة عامة', '▦'],
  ['users', 'المستخدمون', '♙'],
  ['sellers', 'البائعون', '✳'],
  ['products', 'المنتجات', '▣'],
  ['orders', 'الطلبات', '↗'],
];

const orderLabels = {
  new: 'تم استلام الطلب',
  confirmed: 'تم التأكيد',
  preparing: 'قيد التجهيز',
  shipped: 'في الطريق',
  completed: 'تم التسليم',
  cancelled: 'ملغي تجريبيًا',
};

const roleNames = { buyer: 'مشتري تجريبي', seller: 'بائع تجريبي' };

function statusSelect(value, name = 'active') {
  return `<select name="${name}"><option value="yes" ${value !== false ? 'selected' : ''}>فعال</option><option value="no" ${value === false ? 'selected' : ''}>موقوف</option></select>`;
}

function header(activeTab, esc) {
  return `<div class="admin-heading"><div><span class="section-kicker">مركز إدارة المتجر</span><h1>لوحة التحكم</h1><p>إدارة بيانات التجربة ومتابعة ما يحدث في متجرك.</p></div><a class="button button-outline" href="/app.html#store">العودة إلى المتجر</a></div>
    <div class="local-storage-banner admin-warning"><span>ⓘ</span><div><b>لوحة إدارة تجريبية محلية</b><small>لا يوجد حساب مدير محمي أو صلاحيات حقيقية. التعديلات والأرقام تخص هذا المتصفح فقط، ولا تمثل تحليلات سوق فعلية.</small></div><strong>محلي فقط</strong></div>
    <nav class="admin-tabs" aria-label="أقسام لوحة الإدارة">${tabs.map(([key, label, icon]) => `<a class="admin-tab ${activeTab === key ? 'admin-tab-current' : ''}" href="/app.html#admin/${key}"><span>${icon}</span>${esc(label)}</a>`).join('')}</nav>`;
}

function metric(icon, label, value, note = '') {
  return `<article class="admin-metric"><span>${icon}</span><div><small>${label}</small><b>${value}</b>${note ? `<i>${note}</i>` : ''}</div></article>`;
}

function accountRows(data, helpers) {
  const { esc } = helpers;
  const accounts = Object.values(data.accounts || {}).filter((account) => account?.role);
  if (!accounts.length) return `<div class="empty-state"><h2>لا توجد حسابات تجريبية بعد</h2><p>أنشئ حساب مشتري أو بائع من صفحة بدء التجربة، ثم ارجع لإدارته هنا.</p><a class="button button-outline" href="/app.html#login">إنشاء حساب تجريبي</a></div>`;
  return `<div class="admin-record-grid">${accounts.map((account) => `<article class="admin-record-card"><div class="admin-record-head"><span class="admin-avatar">${esc(account.name?.slice(0, 1) || '؟')}</span><div><b>${esc(account.name || 'حساب تجريبي')}</b><small>${roleNames[account.role] || 'حساب تجريبي'} · ${esc(account.email || 'بريد تجريبي')}</small></div><span class="admin-state ${account.active === false ? 'admin-state-off' : ''}">${account.active === false ? 'موقوف' : 'فعال'}</span></div><form class="admin-edit-form" data-admin-user-role="${esc(account.role)}"><label>اسم العرض<input name="name" required maxlength="60" value="${esc(account.name || '')}"></label><label>البريد التجريبي<input value="${esc(account.email || '')}" disabled></label><label>حالة الحساب${statusSelect(account.active)}</label><div class="admin-form-actions"><button class="button button-primary button-small">حفظ المستخدم</button><button type="button" class="button button-outline button-small admin-danger-button" data-act="delete-demo-user" data-role="${esc(account.role)}">حذف الحساب</button></div></form></article>`).join('')}</div>`;
}

function sellerPanel(data, helpers) {
  const { esc, count } = helpers;
  const sellers = Object.values(data.accounts || {}).filter((account) => account?.role === 'seller');
  if (!sellers.length) return `<div class="empty-state"><h2>لا يوجد بائعون تجريبيون بعد</h2><p>أنشئ حساب بائع من صفحة بدء التجربة لإدارة بيانات المتجر وحالته هنا.</p><a class="button button-outline" href="/app.html#login">إنشاء حساب بائع تجريبي</a></div>`;
  return `<div class="admin-record-grid">${sellers.map((seller) => {
    const products = data.products.filter((product) => product.sellerId === seller.id);
    const views = products.reduce((sum, product) => sum + (Number(product.views) || 0), 0);
    return `<article class="admin-record-card"><div class="admin-record-head"><span class="admin-avatar">✳</span><div><b>${esc(seller.storeName || `${seller.name} · المتجر`)}</b><small>${esc(seller.name)} · ${esc(seller.email || 'بريد تجريبي')}</small></div><span class="admin-state ${seller.active === false ? 'admin-state-off' : ''}">${seller.active === false ? 'موقوف' : 'فعال'}</span></div><div class="admin-mini-stats"><span><b>${count(products.length)}</b><small>منتجات</small></span><span><b>${count(views)}</b><small>مشاهدات تجريبية</small></span><span><b>${count(products.reduce((sum, product) => sum + (Number(product.sales) || 0), 0))}</b><small>وحدات مسجلة</small></span></div><form class="admin-edit-form" data-admin-seller-role="seller"><label>اسم المتجر<input name="storeName" maxlength="60" value="${esc(seller.storeName || '')}" placeholder="اسم المتجر التجريبي"></label><label>حالة البائع${statusSelect(seller.active)}</label><div class="admin-form-actions"><button class="button button-primary button-small">حفظ إعدادات البائع</button><a class="button button-outline button-small" href="/app.html#admin/users">إدارة حسابه</a></div></form></article>`;
  }).join('')}</div>`;
}

function productCreateForm() {
  return `<form id="admin-create-product" class="admin-create-form"><div><span class="section-kicker">إضافة منتج من لوحة الإدارة</span><h2>منتج جديد</h2><p>يُحفظ كمسودة أولًا؛ يمكنك مراجعته ونشره من القائمة.</p></div><div class="admin-create-fields"><label>اسم المنتج<input name="name" required maxlength="100" placeholder="اسم المنتج"></label><label>التصنيف<input name="category" required maxlength="60" placeholder="التصنيف"></label><label>السعر بالجنيه<input name="price" type="number" min="1" step="any" required placeholder="0"></label><label>المخزون<input name="stock" type="number" min="0" step="1" required placeholder="0"></label></div><button class="button button-primary">إضافة كمسودة</button></form>`;
}

function productsPanel(data, helpers) {
  const { esc, cash, count } = helpers;
  if (!data.products.length) return `${productCreateForm()}<div class="empty-state"><h2>لا توجد منتجات حاليًا</h2><p>أضف منتجًا جديدًا من النموذج أعلاه.</p></div>`;
  return `${productCreateForm()}<div class="admin-list-heading"><h2>كتالوج المنتجات</h2><span>${count(data.products.length)} منتج</span></div><div class="admin-product-list">${data.products.map((product) => `<article class="admin-product-card"><div class="admin-product-summary"><span class="admin-product-icon">${esc(product.emoji || '▣')}</span><div><b>${esc(product.name)}</b><small>${esc(product.sellerId ? (Object.values(data.accounts || {}).find((account) => account?.id === product.sellerId)?.storeName || 'بائع تجريبي') : 'منتج المتجر التجريبي')} · ${cash(product.price)} · مخزون ${count(product.stock)}</small></div><span class="admin-state ${product.status === 'draft' ? 'admin-state-off' : ''}">${product.status === 'draft' ? 'مسودة / مخفي' : 'منشور'}</span></div><form class="admin-edit-form admin-product-form" data-admin-product-id="${esc(product.id)}"><div class="admin-product-fields"><label>الاسم<input name="name" required maxlength="100" value="${esc(product.name)}"></label><label>التصنيف<input name="category" required maxlength="60" value="${esc(product.category || '')}"></label><label>السعر<input name="price" type="number" min="1" step="any" required value="${esc(product.price)}"></label><label>المخزون<input name="stock" type="number" min="0" step="1" required value="${esc(product.stock)}"></label><label>الظهور<select name="status"><option value="published" ${product.status === 'draft' ? '' : 'selected'}>منشور</option><option value="draft" ${product.status === 'draft' ? 'selected' : ''}>مسودة / مخفي</option></select></label></div><div class="admin-form-actions"><button class="button button-primary button-small">حفظ التغييرات</button><button type="button" class="button button-outline button-small admin-danger-button" data-act="delete-admin-product" data-id="${esc(product.id)}">حذف المنتج</button></div></form></article>`).join('')}</div>`;
}

function ordersPanel(data, helpers) {
  const { esc, cash, count } = helpers;
  if (!data.orders.length) return `<div class="empty-state"><h2>لا توجد طلبات تجريبية</h2><p>تظهر الطلبات هنا بعد إتمام الشراء التجريبي.</p><a class="button button-outline" href="/app.html#store">عرض المتجر</a></div>`;
  return `<div class="admin-list-heading"><h2>كل الطلبات</h2><span>${count(data.orders.length)} طلب</span></div><div class="admin-order-list">${data.orders.slice().reverse().map((order) => `<article class="admin-order-card"><div class="admin-order-top"><div><small>رقم الطلب</small><b>${esc(order.number)}</b></div><span class="admin-state">${esc(orderLabels[order.status] || order.statusLabel || 'قيد المتابعة')}</span><strong>${cash(order.total)}</strong></div><div class="admin-order-details"><span>المشتري: <b>${esc(order.buyerName || 'مشتري تجريبي')}</b></span><span>العنوان: <b>${esc(order.address || 'غير متوفر')}</b></span><span>المنتجات: <b>${order.items.map((item) => `${esc(item.name)} × ${count(item.qty)}`).join('، ')}</b></span></div><form class="admin-order-form" data-admin-order-id="${esc(order.id)}"><label>مرحلة الطلب<select name="status">${Object.entries(orderLabels).map(([key, label]) => `<option value="${key}" ${order.status === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label><button class="button button-outline button-small">حفظ المرحلة</button></form></article>`).join('')}</div>`;
}

function bars(items, max, helpers, valueKey, labelKey) {
  const { esc, count } = helpers;
  if (!items.length) return '<p class="admin-muted">لا توجد بيانات كافية بعد.</p>';
  const safeMax = Math.max(1, max);
  return `<div class="admin-bars">${items.map((item) => {
    const value = Number(item[valueKey]) || 0;
    const width = value ? Math.max(5, Math.round((value / safeMax) * 100)) : 0;
    return `<div class="admin-bar-row"><div><span>${esc(item[labelKey])}</span><b>${count(value)}</b></div><i><em style="width:${width}%"></em></i></div>`;
  }).join('')}</div>`;
}

function overview(data, helpers) {
  const { esc, cash, count, isProductVisible } = helpers;
  const accounts = Object.values(data.accounts || {}).filter((account) => account?.role);
  const sellers = accounts.filter((account) => account.role === 'seller');
  const buyers = accounts.filter((account) => account.role === 'buyer');
  const published = data.products.filter((product) => isProductVisible(product));
  const views = data.products.reduce((sum, product) => sum + (Number(product.views) || 0), 0);
  const trackedSales = data.products.reduce((sum, product) => sum + (Number(product.sales) || 0), 0);
  const total = data.orders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
  const popular = data.products.filter((product) => isProductVisible(product)).slice().sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0)).slice(0, 5);
  const maxViews = Math.max(1, ...popular.map((product) => Number(product.views) || 0));
  const states = Object.keys(orderLabels).map((key) => ({ label: orderLabels[key], value: data.orders.filter((order) => order.status === key).length }));
  const maxOrders = Math.max(1, ...states.map((state) => state.value));
  return `<section class="admin-metrics">${metric('♙', 'حسابات التجربة', count(accounts.length), `${count(buyers.length)} مشترٍ · ${count(sellers.length)} بائع`)}${metric('▣', 'المنتجات المنشورة', `${count(published.length)} / ${count(data.products.length)}`, 'المسودات ومتاجر البائعين الموقوفة غير معروضة')}${metric('↗', 'الطلبات المسجلة', count(data.orders.length), `${count(data.orders.filter((order) => order.status === 'completed').length)} تم تسليمها`)}${metric('ج.م', 'قيمة الطلبات', cash(total), 'من الطلبات المحلية المسجلة')}${metric('◎', 'مشاهدات المنتجات', count(views), 'أرقام تجريبية')}${metric('▤', 'وحدات مباعة مسجلة', count(trackedSales), 'قد تتضمن بيانات عرض أولية')}</section><div class="admin-analytics-grid"><section class="admin-panel"><div class="admin-panel-heading"><div><span class="section-kicker">الاهتمام بالمنتجات</span><h2>الأكثر مشاهدة</h2></div><span>تجريبي</span></div>${bars(popular.map((product) => ({ name: product.name, value: product.views })), maxViews, helpers, 'value', 'name')}</section><section class="admin-panel"><div class="admin-panel-heading"><div><span class="section-kicker">تدفق الطلبات</span><h2>توزيع الحالات</h2></div><span>${count(data.orders.length)} طلب</span></div>${bars(states, maxOrders, helpers, 'value', 'label')}</section></div><div class="admin-panel admin-top-products"><div class="admin-panel-heading"><div><span class="section-kicker">كتالوج المتجر</span><h2>مؤشرات المنتجات</h2></div><a class="text-link" href="/app.html#admin/products">إدارة المنتجات ←</a></div><div class="admin-top-list">${popular.length ? popular.map((product, index) => `<div><b class="admin-rank">${count(index + 1)}</b><span>${esc(product.name)}</span><small>${count(product.views)} مشاهدة · ${count(product.sales)} وحدة مسجلة</small></div>`).join('') : '<p class="admin-muted">لا توجد منتجات بعد.</p>'}</div><div class="admin-actions-row"><a class="button button-outline button-small" href="/app.html#admin/users">المستخدمون والبائعون</a><a class="button button-outline button-small" href="/app.html#admin/orders">مراجعة الطلبات</a><button class="button button-primary button-small" data-act="export-admin-data">تنزيل نسخة JSON</button></div></div>`;
}

export function renderAdminDashboard(data, requestedTab, helpers) {
  const activeTab = tabs.some(([key]) => key === requestedTab) ? requestedTab : 'overview';
  let content = '';
  if (activeTab === 'overview') content = overview(data, helpers);
  if (activeTab === 'users') content = `<div class="admin-list-heading"><div><h2>حسابات المستخدمين</h2><p>الحسابات الوهمية المسجلة في هذا المتصفح.</p></div><span>${helpers.count(Object.keys(data.accounts || {}).length)} حساب</span></div>${accountRows(data, helpers)}`;
  if (activeTab === 'sellers') content = `<div class="admin-list-heading"><div><h2>إدارة البائعين</h2><p>تحكم في اسم المتجر التجريبي وحالة ظهوره.</p></div><a class="text-link" href="/app.html#admin/users">كل المستخدمين ←</a></div>${sellerPanel(data, helpers)}`;
  if (activeTab === 'products') content = productsPanel(data, helpers);
  if (activeTab === 'orders') content = ordersPanel(data, helpers);
  return `<main class="page-wrap admin-page">${header(activeTab, helpers.esc)}<section class="admin-content">${content}</section><p class="admin-footnote">التحليلات والأرقام هنا مستخرجة من بيانات هذا المتصفح؛ لا يوجد تتبع خارجي أو لوحة إدارة خادم.</p></main>`;
}
