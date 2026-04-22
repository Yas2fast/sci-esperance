const STORAGE_KEY = 'sci_esperance_manager_v1';
const AUTO_MONTHLY_KEY = 'sci_esperance_auto_monthly_generation_v1';

const defaultData = {
  settings: {
    companyName: 'SCI de l’Espérance',
    managerName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    siret: '',
    iban: '',
    currency: 'EUR',
    legalNote: 'Merci de conserver ce document.',
  },
  clients: [],
  documents: [],
};

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultData);
    const parsed = JSON.parse(raw);

    return {
      settings: { ...defaultData.settings, ...(parsed.settings || {}) },
      clients: Array.isArray(parsed.clients)
        ? parsed.clients.map(normalizeClient)
        : [],
      documents: Array.isArray(parsed.documents)
        ? parsed.documents.map(normalizeDocument)
        : [],
    };
  } catch {
    return structuredClone(defaultData);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizeClient(client = {}) {
  return {
    id: client.id || uid('client'),
    name: client.name || '',
    email: client.email || '',
    phone: client.phone || '',
    property: client.property || '',
    rentAmount: Number(client.rentAmount || 0),
    chargesAmount: Number(client.chargesAmount || 0),
    dueDay: client.dueDay ? Number(client.dueDay) : '',
    address: client.address || '',
    notes: client.notes || '',
    leaseStartDate: client.leaseStartDate || '',
    leaseEndDate: client.leaseEndDate || '',
    securityDeposit: Number(client.securityDeposit || 0),
    paymentMethod: client.paymentMethod || '',
    paymentFrequency: client.paymentFrequency || 'mensuel',
    tenantStatus: client.tenantStatus || 'actif',
    guarantorName: client.guarantorName || '',
    guarantorPhone: client.guarantorPhone || '',
    guarantorEmail: client.guarantorEmail || '',
  };
}

function normalizeDocument(doc = {}) {
  return {
    id: doc.id || uid('doc'),
    type: doc.type || 'facture',
    clientId: doc.clientId || '',
    number: doc.number || '',
    date: doc.date || getTodayIso(),
    dueDate: doc.dueDate || getNextMonthFifth(),
    period: doc.period || '',
    amount: Number(doc.amount || 0),
    charges: Number(doc.charges || 0),
    vatRate: Number(doc.vatRate || 0),
    status: doc.status || 'unpaid',
    notes: doc.notes || '',
  };
}

function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function byId(id) {
  return document.getElementById(id);
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"]|'/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[m]));
}

function formatMoney(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: state.settings.currency || 'EUR',
  }).format(amount);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(`${dateStr}T00:00:00`);
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(date);
}

function getTodayIso() {
  return new Date().toISOString().slice(0, 10);
}

function getNextMonthFifth() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  return new Date(year, month + 1, 5).toISOString().slice(0, 10);
}

function getCurrentMonthFifth(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  return new Date(year, month, 5).toISOString().slice(0, 10);
}

function getPeriodLabelFromDate(date = new Date()) {
  return `Loyer ${new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
  }).format(date)}`;
}

function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function nextDocumentNumber(type) {
  const year = new Date().getFullYear();
  const prefix = type === 'facture' ? 'FAC' : 'QUI';
  const count = state.documents.filter(
    d => d.type === type && String(d.number || '').startsWith(`${prefix}-${year}`)
  ).length + 1;

  return `${prefix}-${year}-${String(count).padStart(3, '0')}`;
}

function setView(view) {
  const titles = {
    dashboard: ['Tableau de bord', 'Vue rapide de votre activité'],
    clients: ['Clients', 'Base de données clients'],
    documents: ['Documents', 'Factures, quittances et suivi'],
    relances: ['Relances', 'Première relance, deuxième relance et mise en demeure'],
    settings: ['Paramètres', 'Informations de la société'],
  };

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  document.querySelectorAll('.view').forEach(el => {
    el.classList.remove('active');
  });

  const target = byId(`${view}View`);
  if (target) target.classList.add('active');

  if (byId('pageTitle')) byId('pageTitle').textContent = titles[view][0];
  if (byId('pageSubtitle')) byId('pageSubtitle').textContent = titles[view][1];
}

function getOverdueDays(doc) {
  if (doc.status !== 'unpaid') return 0;
  const refDate = doc.dueDate || doc.date;
  if (!refDate) return 0;

  const due = new Date(`${refDate}T00:00:00`);
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diff = Math.floor((today - due) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

function getDaysUntilDue(doc) {
  if (doc.status === 'paid') return null;
  const refDate = doc.dueDate || doc.date;
  if (!refDate) return null;

  const due = new Date(`${refDate}T00:00:00`);
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return Math.floor((due - today) / (1000 * 60 * 60 * 24));
}

function getReminderLevel(doc) {
  const overdueDays = getOverdueDays(doc);
  if (overdueDays >= 30) return 3;
  if (overdueDays >= 15) return 2;
  if (overdueDays >= 1) return 1;
  return 1;
}

function getReminderLabel(level) {
  if (level === 1) return 'Première relance';
  if (level === 2) return 'Deuxième relance';
  return 'Mise en demeure';
}

function getStatusBadge(status) {
  if (status === 'paid') {
    return `<div class="doc-status-badge paid-badge">PAYÉ</div>`;
  }
  return `<div class="doc-status-badge unpaid-badge">IMPAYÉ</div>`;
}

function getDueBadgeHtml(doc) {
  if (doc.status === 'paid') {
    return `<span class="tag paid">Réglé</span>`;
  }

  const overdueDays = getOverdueDays(doc);
  if (overdueDays > 0) {
    return `<span class="tag unpaid">Retard ${overdueDays} j</span>`;
  }

  const daysUntilDue = getDaysUntilDue(doc);
  if (daysUntilDue === 0) {
    return `<span class="tag facture">Aujourd’hui</span>`;
  }
  if (daysUntilDue !== null && daysUntilDue > 0) {
    return `<span class="tag quittance">Dans ${daysUntilDue} j</span>`;
  }

  return `<span class="tag facture">À venir</span>`;
}

function getClientStatusLabel(status) {
  const map = {
    actif: 'Actif',
    sortant: 'Sortant',
    archive: 'Archivé',
  };
  return map[status] || status || 'Actif';
}

function populateClientOptions(selectedId = '') {
  const form = byId('documentForm');
  if (!form || !form.elements.clientId) return;

  const select = form.elements.clientId;
  select.innerHTML = state.clients.length
    ? state.clients.map(c =>
        `<option value="${c.id}">${escapeHtml(c.name)}${c.property ? ' — ' + escapeHtml(c.property) : ''}</option>`
      ).join('')
    : '<option value="">Aucun client</option>';

  if (selectedId) {
    select.value = selectedId;
  }
}

function setFormValue(form, field, value) {
  if (form?.elements?.[field]) {
    form.elements[field].value = value ?? '';
  }
}

function openClientModal(client = null) {
  const dialog = byId('clientDialog');
  const form = byId('clientForm');
  if (!dialog || !form) return;

  form.reset();
  byId('clientModalTitle').textContent = client ? 'Modifier le client' : 'Nouveau client';

  const safeClient = normalizeClient(client || {});
  setFormValue(form, 'id', client?.id || '');

  [
    'name',
    'email',
    'phone',
    'property',
    'rentAmount',
    'chargesAmount',
    'dueDay',
    'address',
    'notes',
    'leaseStartDate',
    'leaseEndDate',
    'securityDeposit',
    'paymentMethod',
    'paymentFrequency',
    'tenantStatus',
    'guarantorName',
    'guarantorPhone',
    'guarantorEmail',
  ].forEach(field => {
    setFormValue(form, field, safeClient[field]);
  });

  dialog.showModal();
}

function openDocumentModal(doc = null, presetType = 'facture', presetClientId = '') {
  const dialog = byId('documentDialog');
  const form = byId('documentForm');
  if (!dialog || !form) return;

  form.reset();

  const type = doc?.type || presetType;
  byId('documentModalTitle').textContent = doc
    ? 'Modifier le document'
    : `Nouvelle ${type === 'facture' ? 'facture' : 'quittance'}`;

  setFormValue(form, 'id', doc?.id || '');
  setFormValue(form, 'type', type);
  populateClientOptions(doc?.clientId || presetClientId);
  setFormValue(form, 'number', doc?.number || nextDocumentNumber(type));
  setFormValue(form, 'date', doc?.date || getTodayIso());
  setFormValue(form, 'dueDate', doc?.dueDate || getNextMonthFifth());
  setFormValue(form, 'period', doc?.period || '');
  setFormValue(form, 'amount', doc?.amount || '');
  setFormValue(form, 'charges', doc?.charges || 0);
  setFormValue(form, 'vatRate', doc?.vatRate ?? 0);
  setFormValue(form, 'status', doc?.status || (type === 'quittance' ? 'paid' : 'unpaid'));
  setFormValue(form, 'notes', doc?.notes || '');

  if (!doc && presetClientId) {
    const client = state.clients.find(c => c.id === presetClientId);
    if (client?.rentAmount) setFormValue(form, 'amount', client.rentAmount);
    if (form.elements.charges && client?.chargesAmount) setFormValue(form, 'charges', client.chargesAmount);
    setFormValue(form, 'period', getPeriodLabelFromDate(new Date()));
  }

  dialog.showModal();
}

function createInvoiceHtml(doc, client, s, totalAmount, charges, vatRate, rentOnly, vatAmount, totalTtc) {
  return `
    <div class="doc-sheet apple-doc invoice-doc">
      <div class="apple-doc-header">
        <div class="apple-doc-company">
          <h2>SCI DE L'ESPERANCE</h2>
          <p>35 RUE DES CAILLOUX<br>92110 CLICHY</p>
          ${s.siret ? `<p>SIRET : ${escapeHtml(s.siret)}</p>` : ''}
        </div>
        <div class="apple-doc-meta">
          ${getStatusBadge(doc.status)}
          <h1>FACTURE</h1>
          <p><strong>N° :</strong> ${escapeHtml(doc.number)}</p>
          <p><strong>Date :</strong> ${formatDate(doc.date)}</p>
          <p><strong>Échéance :</strong> ${formatDate(doc.dueDate || doc.date)}</p>
        </div>
      </div>

      <div class="apple-doc-client">
        <p><strong>Client :</strong></p>
        <p>${escapeHtml(client.name || '')}</p>
        <p>${escapeHtml(client.address || '')}</p>
      </div>

      <table class="apple-doc-table">
        <thead>
          <tr>
            <th>Désignation</th>
            <th>Montant (€)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${escapeHtml(doc.period || 'Loyer')}</td>
            <td>${formatMoney(rentOnly)}</td>
          </tr>
          ${charges > 0 ? `
            <tr>
              <td>Charges</td>
              <td>${formatMoney(charges)}</td>
            </tr>
          ` : ''}
        </tbody>
      </table>

      <div class="apple-doc-total">
        <p>Total HT : ${formatMoney(totalAmount)}</p>
        <p>TVA (${vatRate.toFixed(2).replace('.', ',')}%) : ${formatMoney(vatAmount)}</p>
        <h2>Total TTC : ${formatMoney(totalTtc)}</h2>
      </div>

      <div class="apple-doc-conditions">
        <p><strong>Conditions de paiement :</strong></p>
        <p>Mode de paiement : Chèque ou virement</p>
        <p>Conditions d’escompte : Aucun escompte en cas de paiement anticipé.</p>
        <p>Indemnité forfaitaire pour retard de paiement (Décret n° 2012-1115 du 2 octobre 2012) : 40 €</p>
      </div>

      ${doc.notes ? `<div class="apple-doc-conditions"><p><strong>Notes :</strong> ${escapeHtml(doc.notes)}</p></div>` : ''}

      <div class="apple-doc-signature-row invoice-signature-row">
        <img src="tampon-signature.png" class="apple-doc-stamp invoice-stamp" alt="Tampon et signature">
      </div>

      <div class="apple-doc-footer">
        SCI DE L'ESPERANCE – au capital de 10.000 €<br>
        35 RUE DES CAILLOUX 92110 CLICHY
      </div>
    </div>
  `;
}

function createReceiptHtml(doc, client, s, totalAmount, charges, totalTtc) {
  return `
    <div class="doc-sheet apple-doc receipt-doc">
      <div class="receipt-top-bar"></div>

      <div class="receipt-header">
        <div class="receipt-company-block">
          <div class="receipt-company-name">SCI DE L'ESPERANCE</div>
          <div class="receipt-company-lines">
            35 RUE DES CAILLOUX<br>
            92110 CLICHY<br>
            ${s.siret ? `SIRET : ${escapeHtml(s.siret)}` : ''}
          </div>
        </div>

        <div class="receipt-title-block">
          ${getStatusBadge(doc.status)}
          <div class="receipt-title">QUITTANCE DE LOYER</div>
          <div class="receipt-meta-line"><strong>N° :</strong> ${escapeHtml(doc.number)}</div>
          <div class="receipt-meta-line"><strong>Date :</strong> ${formatDate(doc.date)}</div>
          <div class="receipt-meta-line"><strong>Période :</strong> ${escapeHtml(doc.period || '')}</div>
        </div>
      </div>

      <div class="receipt-card-grid">
        <div class="receipt-card">
          <div class="receipt-card-title">Locataire</div>
          <div class="receipt-card-body">
            <strong>${escapeHtml(client.name || '')}</strong><br>
            ${escapeHtml(client.address || '')}
          </div>
        </div>

        <div class="receipt-card">
          <div class="receipt-card-title">Bien concerné</div>
          <div class="receipt-card-body">
            ${escapeHtml(client.property || '—')}
          </div>
        </div>
      </div>

      <table class="receipt-table">
        <thead>
          <tr>
            <th>Détail</th>
            <th>Montant</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Loyer</td>
            <td>${formatMoney(Math.max(0, totalAmount - charges))}</td>
          </tr>
          ${charges > 0 ? `
            <tr>
              <td>Charges</td>
              <td>${formatMoney(charges)}</td>
            </tr>
          ` : ''}
          <tr class="receipt-total-row">
            <td>Total réglé</td>
            <td>${formatMoney(totalTtc)}</td>
          </tr>
        </tbody>
      </table>

      <div class="receipt-note">
        Cette quittance annule tout reçu donné antérieurement pour le même objet.
      </div>

      ${doc.notes ? `<div class="receipt-extra-note"><strong>Notes :</strong> ${escapeHtml(doc.notes)}</div>` : ''}

      <div class="apple-doc-signature-row receipt-signature-row">
        <img src="tampon-signature.png" class="apple-doc-stamp receipt-stamp" alt="Tampon et signature">
      </div>

      <div class="apple-doc-footer receipt-footer">
        SCI DE L'ESPERANCE – au capital de 10.000 €<br>
        35 RUE DES CAILLOUX 92110 CLICHY
      </div>
    </div>
  `;
}

function createDocumentHtml(doc) {
  const client = state.clients.find(c => c.id === doc.clientId) || {};
  const s = state.settings;

  const totalAmount = Number(doc.amount || 0);
  const charges = Number(doc.charges || 0);
  const vatRate = Number(doc.vatRate || 0);
  const rentOnly = Math.max(0, totalAmount - charges);
  const vatAmount = totalAmount * (vatRate / 100);
  const totalTtc = totalAmount + vatAmount;

  if (doc.type === 'quittance') {
    return createReceiptHtml(doc, client, s, totalAmount, charges, totalTtc);
  }

  return createInvoiceHtml(doc, client, s, totalAmount, charges, vatRate, rentOnly, vatAmount, totalTtc);
}

function createReminderHtml(doc, level) {
  const client = state.clients.find(c => c.id === doc.clientId) || {};
  const overdueDays = getOverdueDays(doc);
  const title = getReminderLabel(level);

  return `
    <div class="doc-sheet apple-doc">
      <div class="apple-doc-header">
        <div class="apple-doc-company">
          <h2>SCI DE L'ESPERANCE</h2>
          <p>35 RUE DES CAILLOUX<br>92110 CLICHY</p>
        </div>
        <div class="apple-doc-meta">
          <h1>${title.toUpperCase()}</h1>
          <p><strong>Date :</strong> ${formatDate(getTodayIso())}</p>
        </div>
      </div>

      <div class="apple-doc-client">
        <p><strong>Destinataire :</strong></p>
        <p>${escapeHtml(client.name || '')}</p>
        <p>${escapeHtml(client.address || '')}</p>
      </div>

      <div class="apple-doc-conditions">
        <p>Objet : ${escapeHtml(title)} concernant la facture ${escapeHtml(doc.number)}</p>
        <p>Madame, Monsieur,</p>
        <p>
          Sauf erreur de notre part, la facture <strong>${escapeHtml(doc.number)}</strong> relative à
          <strong>${escapeHtml(doc.period)}</strong>, d’un montant de <strong>${formatMoney(doc.amount)}</strong>,
          arrivée à échéance le <strong>${formatDate(doc.dueDate || doc.date)}</strong>, demeure impayée à ce jour.
        </p>
        <p>Le retard constaté est de <strong>${overdueDays} jour(s)</strong>.</p>
        ${level === 1
          ? `<p>Nous vous remercions de bien vouloir procéder au règlement dans les meilleurs délais.</p>`
          : level === 2
            ? `<p>Nous vous demandons de régulariser votre situation sous 8 jours à compter de la réception de la présente.</p>`
            : `<p>Nous vous mettons en demeure de régler la somme due sous 8 jours, à défaut de quoi toute procédure utile pourra être engagée.</p>`
        }
        <p>Mode de paiement : Chèque ou virement.</p>
        <p>Indemnité forfaitaire applicable en cas de retard de paiement : 40 €.</p>
        <p>Veuillez agréer, Madame, Monsieur, l’expression de nos salutations distinguées.</p>
      </div>

      <div class="apple-doc-signature-row invoice-signature-row">
        <img src="tampon-signature.png" class="apple-doc-stamp invoice-stamp" alt="Tampon et signature">
      </div>

      <div class="apple-doc-footer">
        SCI DE L'ESPERANCE – au capital de 10.000 €<br>
        35 RUE DES CAILLOUX 92110 CLICHY
      </div>
    </div>
  `;
}

function closeAllMenus() {
  document.querySelectorAll('.dropdown-menu').forEach(menu => {
    menu.classList.remove('active');
  });
}

window.toggleMenu = function(id, event) {
  if (event) event.stopPropagation();

  const menu = byId(`menu-${id}`);
  if (!menu) return;

  const alreadyOpen = menu.classList.contains('active');
  closeAllMenus();

  if (!alreadyOpen) {
    menu.classList.add('active');
  }
};

window.editClient = function(id) {
  const client = state.clients.find(c => c.id === id);
  if (client) openClientModal(client);
};

window.deleteClient = function(id) {
  if (!confirm('Supprimer ce client ?')) return;
  state.clients = state.clients.filter(c => c.id !== id);
  state.documents = state.documents.filter(d => d.clientId !== id);
  refreshAll();
};

window.createDocForClient = function(clientId, type) {
  if (!state.clients.length) return alert('Ajoutez d’abord un client.');
  openDocumentModal(null, type, clientId);
};

window.editDocument = function(id) {
  const doc = state.documents.find(d => d.id === id);
  if (doc) openDocumentModal(doc, doc.type, doc.clientId);
};

window.deleteDocument = function(id) {
  if (!confirm('Supprimer ce document ?')) return;
  state.documents = state.documents.filter(d => d.id !== id);
  refreshAll();
};

window.toggleStatus = function(id) {
  const doc = state.documents.find(d => d.id === id);
  if (!doc) return;
  doc.status = doc.status === 'paid' ? 'unpaid' : 'paid';
  refreshAll();
};

window.duplicateDocument = function(id) {
  const doc = state.documents.find(d => d.id === id);
  if (!doc) return;

  const duplicated = {
    ...doc,
    id: uid('doc'),
    number: nextDocumentNumber(doc.type),
    date: getTodayIso(),
    dueDate: doc.type === 'facture' ? getNextMonthFifth() : (doc.dueDate || getNextMonthFifth()),
    status: doc.type === 'quittance' ? 'paid' : 'unpaid',
  };

  state.documents.push(duplicated);
  refreshAll();
};

window.previewDocument = function(id) {
  const doc = state.documents.find(d => d.id === id);
  if (!doc) return;
  byId('printArea').innerHTML = createDocumentHtml(doc);
  byId('printDialog').showModal();
};

window.previewReminder = function(id, level) {
  const doc = state.documents.find(d => d.id === id);
  if (!doc) return;
  byId('printArea').innerHTML = createReminderHtml(doc, level);
  byId('printDialog').showModal();
};

function renderStats() {
  const paidTotal = state.documents
    .filter(d => d.status === 'paid' && (d.type === 'facture' || d.type === 'quittance'))
    .reduce((a, b) => a + Number(b.amount || 0), 0);

  const unpaidTotal = state.documents
    .filter(d => d.status === 'unpaid' && (d.type === 'facture' || d.type === 'quittance'))
    .reduce((a, b) => a + Number(b.amount || 0), 0);

  if (byId('statClients')) byId('statClients').textContent = state.clients.length;
  if (byId('statDocuments')) byId('statDocuments').textContent = state.documents.filter(d => d.type === 'facture' || d.type === 'quittance').length;
  if (byId('statPaid')) byId('statPaid').textContent = formatMoney(paidTotal);
  if (byId('statUnpaid')) byId('statUnpaid').textContent = formatMoney(unpaidTotal);
}

function renderRecentDocuments() {
  const wrap = byId('recentDocuments');
  if (!wrap) return;

  const docs = [...state.documents]
    .filter(d => d.type === 'facture' || d.type === 'quittance')
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6);

  if (!docs.length) {
    wrap.innerHTML = '<div class="empty">Aucun document pour le moment.</div>';
    return;
  }

  wrap.innerHTML = docs.map(doc => {
    const client = state.clients.find(c => c.id === doc.clientId);
    return `
      <div class="list-item">
        <div>
          <strong>${escapeHtml(doc.number)} — ${escapeHtml(doc.period)}</strong>
          <small>${doc.type === 'facture' ? 'Facture' : 'Quittance'} · ${escapeHtml(client?.name || 'Client supprimé')} · ${formatDate(doc.date)}</small>
        </div>
        <div>
          <div class="tag ${doc.status}">${doc.status === 'paid' ? 'Payé' : 'Impayé'}</div>
        </div>
      </div>
    `;
  }).join('');
}

function ensureEncaissementPanel() {
  const dashboardView = byId('dashboardView');
  if (!dashboardView) return;

  let panel = byId('encaissementPanel');
  if (panel) return;

  panel = document.createElement('section');
  panel.className = 'panel';
  panel.id = 'encaissementPanel';
  panel.innerHTML = `
    <div class="panel-head">
      <h2>Tableau à encaisser</h2>
    </div>
    <div id="encaissementTableWrap" class="table-wrap"></div>
  `;

  dashboardView.appendChild(panel);
}

function renderEncaissements() {
  ensureEncaissementPanel();

  const wrap = byId('encaissementTableWrap');
  if (!wrap) return;

  const docs = [...state.documents]
    .filter(doc => doc.type === 'facture' && doc.status === 'unpaid')
    .sort((a, b) => {
      const aDate = new Date(`${a.dueDate || a.date}T00:00:00`);
      const bDate = new Date(`${b.dueDate || b.date}T00:00:00`);
      return aDate - bDate;
    });

  if (!docs.length) {
    wrap.innerHTML = '<div class="empty">Aucun montant à encaisser.</div>';
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Client</th>
          <th>Document</th>
          <th>Échéance</th>
          <th>Suivi</th>
          <th>Montant</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${docs.map(doc => {
          const client = state.clients.find(c => c.id === doc.clientId);
          const overdueDays = getOverdueDays(doc);
          const daysUntilDue = getDaysUntilDue(doc);

          const dueInfo = overdueDays > 0
            ? `${overdueDays} jour(s) de retard`
            : (daysUntilDue === 0 ? 'Échéance aujourd’hui' : `Échéance dans ${daysUntilDue} jour(s)`);

          return `
            <tr>
              <td>
                <strong>${escapeHtml(client?.name || 'Client supprimé')}</strong><br>
                <small>${escapeHtml(client?.property || '')}</small>
              </td>
              <td>
                <strong>${escapeHtml(doc.number)}</strong><br>
                <small>${escapeHtml(doc.period)}</small>
              </td>
              <td>${formatDate(doc.dueDate || doc.date)}</td>
              <td>
                ${getDueBadgeHtml(doc)}<br>
                <small>${escapeHtml(dueInfo)}</small>
              </td>
              <td>${formatMoney(doc.amount)}</td>
              <td>
                <div class="action-row">
                  <button class="link-btn" type="button" onclick="toggleStatus('${doc.id}')">Marquer payé</button>
                  <button class="link-btn" type="button" onclick="previewDocument('${doc.id}')">Voir</button>
                  <button class="link-btn" type="button" onclick="duplicateDocument('${doc.id}')">Dupliquer</button>
                </div>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function renderClients() {
  const wrap = byId('clientsTableWrap');
  if (!wrap) return;

  const query = (byId('clientSearch')?.value || '').trim().toLowerCase();
  const rows = state.clients.filter(c => {
    const txt = `
      ${c.name}
      ${c.email}
      ${c.phone}
      ${c.property}
      ${c.address}
      ${c.notes}
      ${c.guarantorName}
      ${c.guarantorPhone}
      ${c.guarantorEmail}
      ${c.paymentMethod}
      ${c.tenantStatus}
    `.toLowerCase();

    return txt.includes(query);
  });

  if (!rows.length) {
    wrap.innerHTML = '<div class="empty">Aucun client trouvé.</div>';
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Nom</th>
          <th>Contact</th>
          <th>Bien</th>
          <th>Loyer</th>
          <th>Échéance</th>
          <th>Infos bail</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(client => `
          <tr>
            <td>
              <strong>${escapeHtml(client.name)}</strong><br>
              <small>${escapeHtml(client.address || '')}</small><br>
              <small>${escapeHtml(getClientStatusLabel(client.tenantStatus))}</small>
            </td>
            <td>
              ${escapeHtml(client.email || '—')}<br>
              <small>${escapeHtml(client.phone || '')}</small>
              ${client.guarantorName ? `<br><small>Garant : ${escapeHtml(client.guarantorName)}</small>` : ''}
            </td>
            <td>
              ${escapeHtml(client.property || '—')}
            </td>
            <td>
              ${client.rentAmount ? formatMoney(client.rentAmount) : '—'}
              ${client.chargesAmount ? `<br><small>Charges : ${formatMoney(client.chargesAmount)}</small>` : ''}
            </td>
            <td>
              ${client.dueDay || '—'}
              ${client.paymentMethod ? `<br><small>${escapeHtml(client.paymentMethod)}</small>` : ''}
            </td>
            <td>
              <small>Entrée : ${formatDate(client.leaseStartDate)}</small><br>
              <small>Fin : ${formatDate(client.leaseEndDate)}</small><br>
              <small>Dépôt : ${client.securityDeposit ? formatMoney(client.securityDeposit) : '—'}</small>
            </td>
            <td>
              <div class="action-row">
                <button class="link-btn" type="button" onclick="editClient('${client.id}')">Modifier</button>
                <button class="link-btn" type="button" onclick="createDocForClient('${client.id}','facture')">Facture</button>
                <button class="link-btn" type="button" onclick="createDocForClient('${client.id}','quittance')">Quittance</button>
                <button class="danger-link" type="button" onclick="deleteClient('${client.id}')">Supprimer</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderDocuments() {
  const wrap = byId('documentsTableWrap');
  if (!wrap) return;

  const query = (byId('documentSearch')?.value || '').trim().toLowerCase();
  const filter = (byId('documentFilter')?.value || 'all');

  const docs = [...state.documents]
    .filter(doc => doc.type === 'facture' || doc.type === 'quittance')
    .filter(doc => {
      const client = state.clients.find(c => c.id === doc.clientId);
      const txt = `${doc.number} ${doc.period} ${client?.name || ''} ${doc.notes || ''}`.toLowerCase();
      const matchQuery = txt.includes(query);
      const matchFilter = filter === 'all' || doc.type === filter || doc.status === filter;
      return matchQuery && matchFilter;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!docs.length) {
    wrap.innerHTML = '<div class="empty">Aucun document trouvé.</div>';
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Type</th>
          <th>Numéro</th>
          <th>Client</th>
          <th>Période</th>
          <th>Date</th>
          <th>Échéance</th>
          <th>Suivi</th>
          <th>Montant</th>
          <th>Statut</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${docs.map(doc => {
          const client = state.clients.find(c => c.id === doc.clientId);

          return `
            <tr>
              <td><span class="tag ${doc.type}">${doc.type === 'facture' ? 'Facture' : 'Quittance'}</span></td>
              <td><strong>${escapeHtml(doc.number)}</strong></td>
              <td>${escapeHtml(client?.name || 'Client supprimé')}</td>
              <td>${escapeHtml(doc.period)}</td>
              <td>${formatDate(doc.date)}</td>
              <td>${formatDate(doc.dueDate || doc.date)}</td>
              <td>${getDueBadgeHtml(doc)}</td>
              <td>${formatMoney(doc.amount)}</td>
              <td><span class="tag ${doc.status}">${doc.status === 'paid' ? 'Payé' : 'Impayé'}</span></td>
              <td style="position: relative;">
                <div class="action-menu">
                  <button class="menu-btn" type="button" onclick="toggleMenu('${doc.id}', event)">⋯</button>
                  <div id="menu-${doc.id}" class="dropdown-menu">
                    <button type="button" onclick="previewDocument('${doc.id}'); closeAllMenus();">Voir</button>
                    <button type="button" onclick="editDocument('${doc.id}'); closeAllMenus();">Modifier</button>
                    <button type="button" onclick="toggleStatus('${doc.id}'); closeAllMenus();">
                      ${doc.status === 'paid' ? 'Mettre impayé' : 'Mettre payé'}
                    </button>
                    <button type="button" onclick="duplicateDocument('${doc.id}'); closeAllMenus();">Dupliquer</button>
                    <button type="button" class="danger" onclick="deleteDocument('${doc.id}'); closeAllMenus();">Supprimer</button>
                  </div>
                </div>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function renderReminders() {
  const wrap = byId('remindersTableWrap');
  if (!wrap) return;

  const query = (byId('reminderSearch')?.value || '').trim().toLowerCase();
  const filter = (byId('reminderFilter')?.value || 'all');

  const docs = [...state.documents]
    .filter(doc => doc.type === 'facture' && doc.status === 'unpaid')
    .filter(doc => {
      const client = state.clients.find(c => c.id === doc.clientId);
      const reminderLevel = getReminderLevel(doc);
      const txt = `${doc.number} ${doc.period} ${client?.name || ''}`.toLowerCase();

      const matchQuery = txt.includes(query);
      const matchFilter =
        filter === 'all' ||
        (filter === 'first' && reminderLevel === 1) ||
        (filter === 'second' && reminderLevel === 2) ||
        (filter === 'formal' && reminderLevel >= 3);

      return matchQuery && matchFilter;
    })
    .sort((a, b) => new Date(a.dueDate || a.date) - new Date(b.dueDate || b.date));

  if (!docs.length) {
    wrap.innerHTML = '<div class="empty">Aucune relance à afficher.</div>';
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Niveau</th>
          <th>Document</th>
          <th>Client</th>
          <th>Échéance</th>
          <th>Retard</th>
          <th>Montant</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${docs.map(doc => {
          const client = state.clients.find(c => c.id === doc.clientId);
          const level = getReminderLevel(doc);
          const overdueDays = getOverdueDays(doc);
          const levelLabel = level === 1 ? '1ère relance' : level === 2 ? '2ème relance' : 'Mise en demeure';
          const tagClass = level === 1 ? 'relance' : level === 2 ? 'relance' : 'mise-en-demeure';

          return `
            <tr class="reminder-level-${level}">
              <td><span class="tag ${tagClass}">${levelLabel}</span></td>
              <td><strong>${escapeHtml(doc.number)}</strong><br><small>${escapeHtml(doc.period)}</small></td>
              <td>${escapeHtml(client?.name || 'Client supprimé')}</td>
              <td>${formatDate(doc.dueDate || doc.date)}</td>
              <td>${overdueDays > 0 ? `${overdueDays} jour(s)` : '—'}</td>
              <td>${formatMoney(doc.amount)}</td>
              <td>
                <button class="link-btn" type="button" onclick="previewReminder('${doc.id}', ${level})">Voir</button>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function renderSettings() {
  const form = byId('settingsForm');
  if (!form) return;

  Object.entries(state.settings).forEach(([key, value]) => {
    if (form.elements[key]) {
      form.elements[key].value = value || '';
    }
  });
}

function refreshAll() {
  renderStats();
  renderRecentDocuments();
  renderEncaissements();
  renderClients();
  renderDocuments();
  renderReminders();
  renderSettings();
  populateClientOptions();
  saveState();
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sci-esperance-donnees.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importData(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      state = {
        settings: { ...defaultData.settings, ...(parsed.settings || {}) },
        clients: Array.isArray(parsed.clients)
          ? parsed.clients.map(normalizeClient)
          : [],
        documents: Array.isArray(parsed.documents)
          ? parsed.documents.map(normalizeDocument)
          : [],
      };
      refreshAll();
      alert('Données importées.');
    } catch {
      alert('Fichier invalide.');
    }
  };
  reader.readAsText(file);
}

function runMonthlyGenerationIfNeeded() {
  const now = new Date();
  const monthKey = getMonthKey(now);
  const lastGenerated = localStorage.getItem(AUTO_MONTHLY_KEY);

  if (lastGenerated === monthKey) return;

  const period = getPeriodLabelFromDate(now);
  const docDate = getTodayIso();

  state.clients.forEach(client => {
    const rentAmount = Number(client.rentAmount || 0);
    const chargesAmount = Number(client.chargesAmount || 0);
    if (rentAmount <= 0) return;

    const dueDay = Number(client.dueDay || 5);
    const year = now.getFullYear();
    const month = now.getMonth();
    const dueDate = new Date(year, month, dueDay).toISOString().slice(0, 10);

    const alreadyHasInvoice = state.documents.some(doc =>
      doc.clientId === client.id &&
      doc.type === 'facture' &&
      doc.period === period
    );

    const alreadyHasReceipt = state.documents.some(doc =>
      doc.clientId === client.id &&
      doc.type === 'quittance' &&
      doc.period === period
    );

    if (!alreadyHasInvoice) {
      state.documents.push({
        id: uid('doc'),
        type: 'facture',
        clientId: client.id,
        number: nextDocumentNumber('facture'),
        date: docDate,
        dueDate,
        period,
        amount: rentAmount + chargesAmount,
        charges: chargesAmount,
        vatRate: 0,
        status: 'unpaid',
        notes: '',
      });
    }

    if (!alreadyHasReceipt) {
      state.documents.push({
        id: uid('doc'),
        type: 'quittance',
        clientId: client.id,
        number: nextDocumentNumber('quittance'),
        date: docDate,
        dueDate,
        period,
        amount: rentAmount + chargesAmount,
        charges: chargesAmount,
        vatRate: 0,
        status: 'paid',
        notes: '',
      });
    }
  });

  localStorage.setItem(AUTO_MONTHLY_KEY, monthKey);
  saveState();
}

async function downloadCurrentPdf() {
  const printArea = byId('printArea');
  if (!printArea || !printArea.innerHTML.trim()) {
    alert('Aucun document à télécharger.');
    return;
  }

  if (!window.html2canvas || !window.jspdf || !window.jspdf.jsPDF) {
    alert('Le module PDF n’est pas chargé. Vérifiez le HTML.');
    return;
  }

  const downloadBtn = byId('downloadPdfBtn');
  const originalText = downloadBtn ? downloadBtn.textContent : '';

  try {
    if (downloadBtn) {
      downloadBtn.disabled = true;
      downloadBtn.textContent = 'Téléchargement...';
    }

    const { jsPDF } = window.jspdf;

    const canvas = await html2canvas(printArea, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      scrollX: 0,
      scrollY: 0,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;

    const imgWidth = usableWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = margin;

    pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
    heightLeft -= usableHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight + margin;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= usableHeight;
    }

    const titleEl = printArea.querySelector('.apple-doc-meta h1, .receipt-title');
    const numberParagraph = Array.from(
      printArea.querySelectorAll('.apple-doc-meta p, .receipt-meta-line')
    ).find(p => p.textContent.includes('N°'));

    const rawTitle = titleEl ? titleEl.textContent.trim() : 'document';
    const rawNumber = numberParagraph
      ? numberParagraph.textContent.replace('N° :', '').replace('N°:', '').trim()
      : String(Date.now());

    const safeTitle = rawTitle.toLowerCase().replace(/[^a-z0-9àâçéèêëîïôûùüÿñæœ-]+/gi, '-');
    const safeNumber = rawNumber.replace(/[^a-zA-Z0-9_-]+/g, '-');

    pdf.save(`${safeTitle}-${safeNumber}.pdf`);
  } catch (error) {
    console.error(error);
    alert('Erreur lors de la génération du PDF.');
  } finally {
    if (downloadBtn) {
      downloadBtn.disabled = false;
      downloadBtn.textContent = originalText || 'Télécharger PDF';
    }
  }
}

function bindEvents() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });

  byId('quickAddClient')?.addEventListener('click', () => openClientModal());
  byId('addClientBtn')?.addEventListener('click', () => openClientModal());

  byId('newInvoiceShortcut')?.addEventListener('click', () =>
    state.clients.length ? openDocumentModal(null, 'facture') : alert('Ajoutez d’abord un client.')
  );

  byId('newReceiptShortcut')?.addEventListener('click', () =>
    state.clients.length ? openDocumentModal(null, 'quittance') : alert('Ajoutez d’abord un client.')
  );

  byId('goClientsShortcut')?.addEventListener('click', () => setView('clients'));

  byId('addInvoiceBtn')?.addEventListener('click', () =>
    state.clients.length ? openDocumentModal(null, 'facture') : alert('Ajoutez d’abord un client.')
  );

  byId('addReceiptBtn')?.addEventListener('click', () =>
    state.clients.length ? openDocumentModal(null, 'quittance') : alert('Ajoutez d’abord un client.')
  );

  byId('firstReminderBtn')?.addEventListener('click', () => {
    const docs = state.documents.filter(d => d.type === 'facture' && d.status === 'unpaid');
    if (!docs.length) return alert('Aucune facture impayée.');
    const doc = docs.sort((a, b) => new Date(a.dueDate || a.date) - new Date(b.dueDate || b.date))[0];
    previewReminder(doc.id, 1);
  });

  byId('secondReminderBtn')?.addEventListener('click', () => {
    const docs = state.documents.filter(d => d.type === 'facture' && d.status === 'unpaid' && getOverdueDays(d) >= 15);
    if (!docs.length) return alert('Aucune facture éligible à une 2ème relance.');
    const doc = docs.sort((a, b) => new Date(a.dueDate || a.date) - new Date(b.dueDate || b.date))[0];
    previewReminder(doc.id, 2);
  });

  byId('formalNoticeBtn')?.addEventListener('click', () => {
    const docs = state.documents.filter(d => d.type === 'facture' && d.status === 'unpaid' && getOverdueDays(d) >= 30);
    if (!docs.length) return alert('Aucune facture éligible à une mise en demeure.');
    const doc = docs.sort((a, b) => new Date(a.dueDate || a.date) - new Date(b.dueDate || b.date))[0];
    previewReminder(doc.id, 3);
  });

  byId('clientSearch')?.addEventListener('input', renderClients);
  byId('documentSearch')?.addEventListener('input', renderDocuments);
  byId('documentFilter')?.addEventListener('change', renderDocuments);
  byId('reminderSearch')?.addEventListener('input', renderReminders);
  byId('reminderFilter')?.addEventListener('change', renderReminders);

  byId('clientForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const item = Object.fromEntries(fd.entries());

    const payload = normalizeClient({
      id: item.id || uid('client'),
      name: String(item.name || '').trim(),
      email: String(item.email || '').trim(),
      phone: String(item.phone || '').trim(),
      property: String(item.property || '').trim(),
      rentAmount: item.rentAmount ? Number(item.rentAmount) : 0,
      chargesAmount: item.chargesAmount ? Number(item.chargesAmount) : 0,
      dueDay: item.dueDay ? Number(item.dueDay) : '',
      address: String(item.address || '').trim(),
      notes: String(item.notes || '').trim(),
      leaseStartDate: String(item.leaseStartDate || '').trim(),
      leaseEndDate: String(item.leaseEndDate || '').trim(),
      securityDeposit: item.securityDeposit ? Number(item.securityDeposit) : 0,
      paymentMethod: String(item.paymentMethod || '').trim(),
      paymentFrequency: String(item.paymentFrequency || 'mensuel').trim(),
      tenantStatus: String(item.tenantStatus || 'actif').trim(),
      guarantorName: String(item.guarantorName || '').trim(),
      guarantorPhone: String(item.guarantorPhone || '').trim(),
      guarantorEmail: String(item.guarantorEmail || '').trim(),
    });

    const index = state.clients.findIndex(c => c.id === payload.id);
    if (index >= 0) state.clients[index] = payload;
    else state.clients.push(payload);

    refreshAll();
    byId('clientDialog')?.close();
  });

  byId('documentForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const item = Object.fromEntries(fd.entries());

    if (!item.clientId) return alert('Sélectionnez un client.');

    const payload = normalizeDocument({
      id: item.id || uid('doc'),
      type: item.type,
      clientId: item.clientId,
      number: String(item.number || '').trim(),
      date: item.date,
      dueDate: item.dueDate || getNextMonthFifth(),
      period: String(item.period || '').trim(),
      amount: Number(item.amount || 0),
      charges: Number(item.charges || 0),
      vatRate: Number(item.vatRate || 0),
      status: item.status,
      notes: String(item.notes || '').trim(),
    });

    const index = state.documents.findIndex(d => d.id === payload.id);
    if (index >= 0) state.documents[index] = payload;
    else state.documents.push(payload);

    refreshAll();
    byId('documentDialog')?.close();
  });

  byId('settingsForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    state.settings = { ...state.settings, ...Object.fromEntries(fd.entries()) };
    refreshAll();
    alert('Paramètres enregistrés.');
  });

  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => byId(btn.dataset.close)?.close());
  });

  byId('printNowBtn')?.addEventListener('click', () => window.print());
  byId('downloadPdfBtn')?.addEventListener('click', downloadCurrentPdf);
  byId('exportBtn')?.addEventListener('click', exportData);
  byId('importInput')?.addEventListener('change', importData);

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.action-menu')) {
      closeAllMenus();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllMenus();
    }
  });
}

bindEvents();
runMonthlyGenerationIfNeeded();
refreshAll();
