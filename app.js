const STORAGE_KEY = 'sci_esperance_manager_v1';

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
      clients: parsed.clients || [],
      documents: parsed.documents || [],
    };
  } catch {
    return structuredClone(defaultData);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function formatMoney(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: state.settings.currency || 'EUR' }).format(amount);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr + 'T00:00:00');
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(date);
}

function byId(id) { return document.getElementById(id); }

function setView(view) {
  const titles = {
    dashboard: ['Tableau de bord', 'Vue rapide de votre activité'],
    clients: ['Clients', 'Base de données clients'],
    documents: ['Documents', 'Factures, quittances et suivi'],
    settings: ['Paramètres', 'Informations de la société'],
  };
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  byId(`${view}View`).classList.add('active');
  byId('pageTitle').textContent = titles[view][0];
  byId('pageSubtitle').textContent = titles[view][1];
}

function renderStats() {
  const paidTotal = state.documents.filter(d => d.status === 'paid').reduce((a, b) => a + Number(b.amount || 0), 0);
  const unpaidTotal = state.documents.filter(d => d.status === 'unpaid').reduce((a, b) => a + Number(b.amount || 0), 0);
  byId('statClients').textContent = state.clients.length;
  byId('statDocuments').textContent = state.documents.length;
  byId('statPaid').textContent = formatMoney(paidTotal);
  byId('statUnpaid').textContent = formatMoney(unpaidTotal);
}

function renderRecentDocuments() {
  const wrap = byId('recentDocuments');
  const docs = [...state.documents]
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
          <strong>${doc.number} — ${doc.period}</strong>
          <small>${doc.type === 'facture' ? 'Facture' : 'Quittance'} · ${client?.name || 'Client supprimé'} · ${formatDate(doc.date)}</small>
        </div>
        <div>
          <div class="tag ${doc.status}">${doc.status === 'paid' ? 'Payé' : 'Impayé'}</div>
        </div>
      </div>`;
  }).join('');
}

function renderClients() {
  const query = byId('clientSearch').value.trim().toLowerCase();
  const rows = state.clients.filter(c => {
    const txt = `${c.name} ${c.email} ${c.phone} ${c.property}`.toLowerCase();
    return txt.includes(query);
  });

  const wrap = byId('clientsTableWrap');
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
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(client => `
          <tr>
            <td><strong>${escapeHtml(client.name)}</strong><br><small>${escapeHtml(client.address || '')}</small></td>
            <td>${escapeHtml(client.email || '—')}<br><small>${escapeHtml(client.phone || '')}</small></td>
            <td>${escapeHtml(client.property || '—')}</td>
            <td>${client.rentAmount ? formatMoney(client.rentAmount) : '—'}</td>
            <td>${client.dueDay || '—'}</td>
            <td>
              <div class="action-row">
                <button class="link-btn" onclick="editClient('${client.id}')">Modifier</button>
                <button class="link-btn" onclick="createDocForClient('${client.id}','facture')">Facture</button>
                <button class="link-btn" onclick="createDocForClient('${client.id}','quittance')">Quittance</button>
                <button class="danger-link" onclick="deleteClient('${client.id}')">Supprimer</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
}

function renderDocuments() {
  const query = byId('documentSearch').value.trim().toLowerCase();
  const filter = byId('documentFilter').value;
  const docs = [...state.documents]
    .filter(doc => {
      const client = state.clients.find(c => c.id === doc.clientId);
      const txt = `${doc.number} ${doc.period} ${client?.name || ''} ${doc.notes || ''}`.toLowerCase();
      const matchQuery = txt.includes(query);
      const matchFilter = filter === 'all' || doc.type === filter || doc.status === filter;
      return matchQuery && matchFilter;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const wrap = byId('documentsTableWrap');
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
          <th>Montant</th>
          <th>Statut</th>
          <th>Actions</th>
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
            <td>${formatMoney(doc.amount)}</td>
            <td><span class="tag ${doc.status}">${doc.status === 'paid' ? 'Payé' : 'Impayé'}</span></td>
            <td>
              <div class="action-row">
                <button class="link-btn" onclick="previewDocument('${doc.id}')">Voir</button>
                <button class="link-btn" onclick="toggleStatus('${doc.id}')">${doc.status === 'paid' ? 'Mettre impayé' : 'Mettre payé'}</button>
                <button class="link-btn" onclick="editDocument('${doc.id}')">Modifier</button>
                <button class="danger-link" onclick="deleteDocument('${doc.id}')">Supprimer</button>
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

function renderSettings() {
  const form = byId('settingsForm');
  Object.entries(state.settings).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value || '';
  });
}

function refreshAll() {
  renderStats();
  renderRecentDocuments();
  renderClients();
  renderDocuments();
  renderSettings();
  populateClientOptions();
  saveState();
}

function openClientModal(client = null) {
  const dialog = byId('clientDialog');
  const form = byId('clientForm');
  form.reset();
  byId('clientModalTitle').textContent = client ? 'Modifier le client' : 'Nouveau client';
  form.elements.id.value = client?.id || '';
  ['name','email','phone','property','rentAmount','dueDay','address','notes'].forEach(field => {
    form.elements[field].value = client?.[field] || '';
  });
  dialog.showModal();
}

function populateClientOptions(selectedId = '') {
  const select = byId('documentForm').elements.clientId;
  select.innerHTML = state.clients.length
    ? state.clients.map(c => `<option value="${c.id}">${escapeHtml(c.name)}${c.property ? ' — ' + escapeHtml(c.property) : ''}</option>`).join('')
    : '<option value="">Aucun client</option>';
  if (selectedId) select.value = selectedId;
}

function nextDocumentNumber(type) {
  const year = new Date().getFullYear();
  const prefix = type === 'facture' ? 'FAC' : 'QUI';
  const count = state.documents.filter(d => d.type === type && d.number.startsWith(`${prefix}-${year}`)).length + 1;
  return `${prefix}-${year}-${String(count).padStart(3, '0')}`;
}

function openDocumentModal(doc = null, presetType = 'facture', presetClientId = '') {
  const dialog = byId('documentDialog');
  const form = byId('documentForm');
  form.reset();
  const type = doc?.type || presetType;
  byId('documentModalTitle').textContent = doc ? 'Modifier le document' : `Nouvelle ${type === 'facture' ? 'facture' : 'quittance'}`;
  form.elements.id.value = doc?.id || '';
  form.elements.type.value = type;
  populateClientOptions(doc?.clientId || presetClientId);
  form.elements.number.value = doc?.number || nextDocumentNumber(type);
  form.elements.date.value = doc?.date || new Date().toISOString().slice(0, 10);
  form.elements.period.value = doc?.period || '';
  form.elements.amount.value = doc?.amount || '';
  form.elements.status.value = doc?.status || (type === 'quittance' ? 'paid' : 'unpaid');
  form.elements.notes.value = doc?.notes || '';

  if (!doc && presetClientId) {
    const client = state.clients.find(c => c.id === presetClientId);
    if (client?.rentAmount) form.elements.amount.value = client.rentAmount;
    form.elements.period.value = `Loyer ${new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date())}`;
  }

  dialog.showModal();
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"]|'/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}

function createDocumentHtml(doc) {
  const client = state.clients.find(c => c.id === doc.clientId) || {};
  const s = state.settings;
  const typeTitle = doc.type === 'facture' ? 'Facture' : 'Quittance de loyer';
  const intro = doc.type === 'facture'
    ? 'Veuillez trouver ci-dessous le détail de la facture.'
    : 'Le présent document atteste du paiement du loyer mentionné ci-dessous.';

  return `
    <div class="doc-sheet">
      <div class="doc-top">
        <div>
          <div class="doc-title">${typeTitle}</div>
          <div class="doc-muted">${escapeHtml(doc.number)}</div>
          <div class="doc-muted">Date : ${formatDate(doc.date)}</div>
        </div>
        <div>
          <strong>${escapeHtml(s.companyName || '')}</strong><br>
          ${escapeHtml(s.address || '')}<br>
          ${escapeHtml([s.postalCode, s.city].filter(Boolean).join(' '))}<br>
          ${s.email ? `Email : ${escapeHtml(s.email)}<br>` : ''}
          ${s.phone ? `Tél : ${escapeHtml(s.phone)}<br>` : ''}
          ${s.siret ? `SIRET : ${escapeHtml(s.siret)}` : ''}
        </div>
      </div>

      <div class="doc-boxes">
        <div class="doc-box">
          <strong>Locataire / client</strong><br><br>
          ${escapeHtml(client.name || '')}<br>
          ${escapeHtml(client.address || '')}<br>
          ${client.email ? `Email : ${escapeHtml(client.email)}<br>` : ''}
          ${client.phone ? `Tél : ${escapeHtml(client.phone)}` : ''}
        </div>
        <div class="doc-box">
          <strong>Informations</strong><br><br>
          Bien : ${escapeHtml(client.property || '—')}<br>
          Période / objet : ${escapeHtml(doc.period)}<br>
          Statut : ${doc.status === 'paid' ? 'Payé' : 'Impayé'}<br>
          ${s.iban ? `IBAN : ${escapeHtml(s.iban)}` : ''}
        </div>
      </div>

      <p>${intro}</p>

      <table class="doc-table">
        <thead>
          <tr>
            <th>Désignation</th>
            <th>Montant</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${escapeHtml(doc.period)}</td>
            <td>${formatMoney(doc.amount)}</td>
          </tr>
        </tbody>
      </table>

      <div class="doc-total">
        <div class="doc-total-box">
          <strong>Total : ${formatMoney(doc.amount)}</strong>
        </div>
      </div>

      ${doc.notes ? `<p><strong>Notes :</strong> ${escapeHtml(doc.notes)}</p>` : ''}
      ${s.legalNote ? `<div class="doc-footer">${escapeHtml(s.legalNote)}</div>` : ''}
    </div>
  `;
}

window.editClient = function(id) {
  const client = state.clients.find(c => c.id === id);
  if (client) openClientModal(client);
}

window.deleteClient = function(id) {
  if (!confirm('Supprimer ce client ?')) return;
  state.clients = state.clients.filter(c => c.id !== id);
  state.documents = state.documents.filter(d => d.clientId !== id);
  refreshAll();
}

window.createDocForClient = function(clientId, type) {
  if (!state.clients.length) return alert('Ajoutez d’abord un client.');
  openDocumentModal(null, type, clientId);
}

window.editDocument = function(id) {
  const doc = state.documents.find(d => d.id === id);
  if (doc) openDocumentModal(doc, doc.type, doc.clientId);
}

window.deleteDocument = function(id) {
  if (!confirm('Supprimer ce document ?')) return;
  state.documents = state.documents.filter(d => d.id !== id);
  refreshAll();
}

window.toggleStatus = function(id) {
  const doc = state.documents.find(d => d.id === id);
  if (!doc) return;
  doc.status = doc.status === 'paid' ? 'unpaid' : 'paid';
  refreshAll();
}

window.previewDocument = function(id) {
  const doc = state.documents.find(d => d.id === id);
  if (!doc) return;
  byId('printArea').innerHTML = createDocumentHtml(doc);
  byId('printDialog').showModal();
}

function bindEvents() {
  document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));

  byId('quickAddClient').addEventListener('click', () => openClientModal());
  byId('addClientBtn').addEventListener('click', () => openClientModal());
  byId('newInvoiceShortcut').addEventListener('click', () => state.clients.length ? openDocumentModal(null, 'facture') : alert('Ajoutez d’abord un client.'));
  byId('newReceiptShortcut').addEventListener('click', () => state.clients.length ? openDocumentModal(null, 'quittance') : alert('Ajoutez d’abord un client.'));
  byId('goClientsShortcut').addEventListener('click', () => setView('clients'));
  byId('addInvoiceBtn').addEventListener('click', () => state.clients.length ? openDocumentModal(null, 'facture') : alert('Ajoutez d’abord un client.'));
  byId('addReceiptBtn').addEventListener('click', () => state.clients.length ? openDocumentModal(null, 'quittance') : alert('Ajoutez d’abord un client.'));

  byId('clientSearch').addEventListener('input', renderClients);
  byId('documentSearch').addEventListener('input', renderDocuments);
  byId('documentFilter').addEventListener('change', renderDocuments);

  byId('clientForm').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const item = Object.fromEntries(fd.entries());
    const payload = {
      id: item.id || uid('client'),
      name: item.name.trim(),
      email: item.email.trim(),
      phone: item.phone.trim(),
      property: item.property.trim(),
      rentAmount: item.rentAmount ? Number(item.rentAmount) : 0,
      dueDay: item.dueDay ? Number(item.dueDay) : '',
      address: item.address.trim(),
      notes: item.notes.trim(),
    };
    const index = state.clients.findIndex(c => c.id === payload.id);
    if (index >= 0) state.clients[index] = payload;
    else state.clients.push(payload);
    byId('clientDialog').close();
    refreshAll();
  });

  byId('documentForm').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const item = Object.fromEntries(fd.entries());
    if (!item.clientId) return alert('Sélectionnez un client.');
    const payload = {
      id: item.id || uid('doc'),
      type: item.type,
      clientId: item.clientId,
      number: item.number.trim(),
      date: item.date,
      period: item.period.trim(),
      amount: Number(item.amount || 0),
      status: item.status,
      notes: item.notes.trim(),
    };
    const index = state.documents.findIndex(d => d.id === payload.id);
    if (index >= 0) state.documents[index] = payload;
    else state.documents.push(payload);
    byId('documentDialog').close();
    refreshAll();
  });

  byId('settingsForm').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    state.settings = { ...state.settings, ...Object.fromEntries(fd.entries()) };
    refreshAll();
    alert('Paramètres enregistrés.');
  });

  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => byId(btn.dataset.close).close());
  });

  byId('printNowBtn').addEventListener('click', () => window.print());
  byId('exportBtn').addEventListener('click', exportData);
  byId('importInput').addEventListener('change', importData);
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
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      state = {
        settings: { ...defaultData.settings, ...(parsed.settings || {}) },
        clients: Array.isArray(parsed.clients) ? parsed.clients : [],
        documents: Array.isArray(parsed.documents) ? parsed.documents : [],
      };
      refreshAll();
      alert('Données importées.');
    } catch {
      alert('Fichier invalide.');
    }
  };
  reader.readAsText(file);
}

bindEvents();
refreshAll();
