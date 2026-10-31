import './styles.css';

const STORAGE_KEY = 'dbguide-reading-progress-v1';
const sectionNames = {
  'architecture-external': 'المستوى الخارجي',
  'architecture-logical': 'المستوى المنطقي',
  'architecture-internal': 'المستوى الداخلي',
  components: 'المكونات',
  roles: 'الأدوار',
};
const byId = (id) => document.getElementById(id);
let toastTimer;

function readProgress() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value.filter((entry) => Object.hasOwn(sectionNames, entry)) : [];
  } catch {
    return [];
  }
}

let completed = readProgress();
let localProgressSaved = true;

function showToast(message) {
  const toast = byId('toast');
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 3000);
}

function updateProgressUI() {
  document.querySelectorAll('.read-toggle[data-section]').forEach((button) => {
    const isDone = completed.includes(button.dataset.section);
    button.setAttribute('aria-pressed', String(isDone));
    button.classList.toggle('is-complete', isDone);
  });
  const componentPercent = completed.includes('components') ? 100 : 0;
  const bar = document.querySelector('[data-progress-bar="components"]');
  const label = document.querySelector('[data-progress-label="components"]');
  if (bar) bar.style.width = `${componentPercent}%`;
  if (label) label.textContent = `${new Intl.NumberFormat('ar-EG').format(componentPercent)}٪`;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
    localProgressSaved = true;
  } catch {
    localProgressSaved = false;
  }
  return localProgressSaved;
}

function closeMobileMenu() {
  const nav = byId('main-nav');
  const toggle = byId('menu-toggle');
  nav.classList.remove('is-open');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'فتح القائمة');
}

byId('menu-toggle').addEventListener('click', () => {
  const nav = byId('main-nav');
  const toggle = byId('menu-toggle');
  const willOpen = !nav.classList.contains('is-open');
  nav.classList.toggle('is-open', willOpen);
  toggle.setAttribute('aria-expanded', String(willOpen));
  toggle.setAttribute('aria-label', willOpen ? 'إغلاق القائمة' : 'فتح القائمة');
});

document.querySelectorAll('.nav-link').forEach((link) => {
  link.addEventListener('click', () => {
    closeMobileMenu();
    document.querySelectorAll('.nav-link').forEach((item) => item.classList.remove('active'));
    link.classList.add('active');
  });
});

byId('search-toggle').addEventListener('click', () => {
  const panel = byId('search-panel');
  panel.hidden = !panel.hidden;
  if (!panel.hidden) byId('site-search').focus();
});

byId('site-search').addEventListener('input', (event) => {
  const query = event.target.value.trim().toLocaleLowerCase('ar');
  const searchable = [...document.querySelectorAll('[data-searchable]')];
  let matches = 0;
  searchable.forEach((item) => {
    const found = !query || item.textContent.toLocaleLowerCase('ar').includes(query);
    item.classList.toggle('search-muted', Boolean(query && !found));
    if (found && query) matches += 1;
  });
  byId('search-count').textContent = query ? `${new Intl.NumberFormat('ar-EG').format(matches)} نتائج` : '';
  if (query && matches === 1) {
    const first = searchable.find((item) => item.textContent.toLocaleLowerCase('ar').includes(query));
    first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
});

document.querySelectorAll('.read-toggle[data-section]').forEach((button) => {
  button.addEventListener('click', () => {
    const key = button.dataset.section;
    completed = completed.includes(key) ? completed.filter((item) => item !== key) : [...completed, key];
    const savedLocally = updateProgressUI();
    if (completed.includes(key)) {
      showToast(savedLocally ? `تم حفظ قراءة «${sectionNames[key]}» على هذا الجهاز.` : `تم تعليم «${sectionNames[key]}» لهذه الجلسة فقط.`);
    } else {
      showToast('تم تحديث تقدم القراءة.');
    }
  });
});

const students = [
  { id: 1, name: 'عمر محمود', major: 'علوم الحاسب' },
  { id: 2, name: 'سارة أحمد', major: 'نظم معلومات' },
  { id: 3, name: 'ليلى حسن', major: 'تقنية معلومات' },
  { id: 4, name: 'يوسف علي', major: 'نظم معلومات' },
];
const columnLabels = { id: 'رقم الطالب', name: 'الاسم', major: 'التخصص' };

function runSampleQuery() {
  const query = byId('sql-query').value.trim().replace(/;\s*$/, '');
  const errorBox = byId('query-error');
  const body = byId('result-body');
  const headings = byId('result-headings');
  const count = byId('result-count');
  errorBox.hidden = true;

  // محاكاة آمنة ومحدودة: لا تنفّذ نص SQL ولا تتصل بقاعدة بيانات.
  const match = query.match(/^SELECT\s+(\*|[a-z_,\s]+)\s+FROM\s+students(?:\s+WHERE\s+(id|major)\s*=\s*(?:'([^']*)'|"([^"]*)"|(\d+)))?$/i);
  if (!match) {
    errorBox.textContent = 'جرّب: SELECT name, major FROM students WHERE id = 2;';
    errorBox.hidden = false;
    return;
  }

  const requestedColumns = match[1] === '*' ? ['id', 'name', 'major'] : match[1].split(',').map((column) => column.trim().toLowerCase()).filter(Boolean);
  if (!requestedColumns.length || requestedColumns.some((column) => !Object.hasOwn(columnLabels, column))) {
    errorBox.textContent = 'الأعمدة المتاحة هي: id وname وmajor.';
    errorBox.hidden = false;
    return;
  }

  let rows = students;
  if (match[2]) {
    const value = match[3] ?? match[4] ?? match[5] ?? '';
    rows = students.filter((student) => String(student[match[2].toLowerCase()]) === value);
  }

  headings.innerHTML = `<tr>${requestedColumns.map((column) => `<th>${column}</th>`).join('')}</tr>`;
  body.innerHTML = rows.length
    ? rows.map((row) => `<tr>${requestedColumns.map((column) => `<td>${escapeHTML(row[column])}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${requestedColumns.length}">لا توجد نتائج مطابقة.</td></tr>`;
  count.textContent = `${new Intl.NumberFormat('ar-EG').format(rows.length)} ${rows.length === 1 ? 'سجل' : 'سجلات'}`;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

byId('run-query').addEventListener('click', runSampleQuery);
byId('sql-query').addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') runSampleQuery();
});

byId('save-progress').addEventListener('click', async () => {
  const status = byId('save-status');
  if (!completed.length) {
    status.textContent = 'علّم قسماً واحداً على الأقل بأنه تمت قراءته، ثم احفظ تقدمك.';
    showToast('اختر «تمّت القراءة» في أحد الأقسام أولاً.');
    return;
  }

  const button = byId('save-progress');
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  status.textContent = 'جارٍ تهيئة مزامنة التقدم…';
  try {
    const { isFirebaseConfigured, syncReadingProgress } = await import('./firebase.js');
    if (!isFirebaseConfigured()) {
      status.textContent = localProgressSaved ? 'حُفظ التقدم على هذا الجهاز. إعداد Firebase غير مكتمل.' : 'إعداد Firebase غير مكتمل، والمتصفح لا يسمح بالتخزين المحلي؛ سيبقى التقدم لهذه الجلسة فقط.';
      showToast(localProgressSaved ? 'تقدمك محفوظ محلياً على هذا الجهاز.' : 'تعذّر التخزين المحلي في هذا المتصفح.');
      return;
    }
    status.textContent = 'جارٍ مزامنة التقدم مع Firebase…';
    await syncReadingProgress(completed);
    status.textContent = 'تمت مزامنة التقدم مع Firebase لهذا المستخدم المجهول.';
    showToast('تمت مزامنة تقدمك بنجاح.');
  } catch (error) {
    console.warn('Firebase progress sync is unavailable:', error);
    status.textContent = localProgressSaved ? 'بقي تقدمك محفوظاً على هذا الجهاز. فعّل Anonymous Auth وFirestore لنقله إلى Firebase.' : 'تعذرت المزامنة والتخزين المحلي؛ سيبقى التقدم لهذه الجلسة فقط.';
    showToast(localProgressSaved ? 'تعذرت المزامنة؛ ما زال تقدمك محفوظاً محلياً.' : 'تعذرت المزامنة والتخزين المحلي.');
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
});

const navLinks = [...document.querySelectorAll('.nav-link')];
const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const active = navLinks.find((link) => link.hash === `#${entry.target.id}`);
    if (active) {
      navLinks.forEach((link) => link.classList.toggle('active', link === active));
    }
  });
}, { rootMargin: '-25% 0px -65% 0px' });
['home', 'architecture', 'components', 'roles'].forEach((id) => {
  const section = byId(id);
  if (section) sectionObserver.observe(section);
});

updateProgressUI();
