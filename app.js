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
      clients: Array.isArray(parsed.clients) ? parsed.clients : [],
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
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
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: state.settings.currency || 'EUR',
  }).format(amount);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr + 'T00:00:00');
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(date);
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

/* 🔥 NOUVELLE FONCTION AJOUTÉE */
function getNextMonthFifth() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const nextMonthDate = new Date(year, month + 1, 5);
  return nextMonthDate.toISOString().slice(0, 10);
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

  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));

  const target = byId(`${view}View`);
  if (target) target.classList.add('active');

  byId('pageTitle').textContent = titles[view][0];
  byId('pageSubtitle').textContent = titles[view][1];
}

/* 🔥 PARTIE MODIFIÉE ICI */
function openDocumentModal(doc = null, presetType = 'facture', presetClientId = '') {
  const dialog = byId('documentDialog');
  const form = byId('documentForm');
  form.reset();

  const type = doc?.type || presetType;

  byId('documentModalTitle').textContent = doc
    ? 'Modifier le document'
    : `Nouvelle ${type === 'facture' ? 'facture' : 'quittance'}`;

  form.elements.id.value = doc?.id || '';
  form.elements.type.value = type;

  populateClientOptions(doc?.clientId || presetClientId);

  form.elements.number.value = doc?.number || nextDocumentNumber(type);
  form.elements.date.value = doc?.date || new Date().toISOString().slice(0, 10);

  /* 🔥 ICI LA MODIF IMPORTANTE */
  form.elements.dueDate.value = doc?.dueDate || getNextMonthFifth();

  form.elements.period.value = doc?.period || '';
  form.elements.amount.value = doc?.amount || '';
  form.elements.charges.value = doc?.charges || 0;
  form.elements.vatRate.value = doc?.vatRate ?? 0;
  form.elements.status.value = doc?.status || (type === 'quittance' ? 'paid' : 'unpaid');
  form.elements.notes.value = doc?.notes || '';

  if (!doc && presetClientId) {
    const client = state.clients.find(c => c.id === presetClientId);
    if (client?.rentAmount) form.elements.amount.value = client.rentAmount;

    form.elements.period.value = `Loyer ${new Intl.DateTimeFormat('fr-FR', {
      month: 'long',
      year: 'numeric',
    }).format(new Date())}`;
  }

  dialog.showModal();
}

function getOverdueDays(doc) {
  if (doc.status !== 'unpaid') return 0;
  const refDate = doc.dueDate || doc.date;
  if (!refDate) return 0;
  const due = new Date(refDate + 'T00:00:00');
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - due) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
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

function createDocumentHtml(doc) {
  const client = state.clients.find(c => c.id === doc.clientId) || {};
  const s = state.settings;
  const isInvoice = doc.type === 'facture';
  const typeTitle = isInvoice ? 'FACTURE' : 'QUITTANCE DE LOYER';

  const totalAmount = Number(doc.amount || 0);
  const charges = Number(doc.charges || 0);
  const vatRate = Number(doc.vatRate || 0);
  const rentOnly = Math.max(0, totalAmount - charges);
  const vatAmount = totalAmount * (vatRate / 100);
  const totalTtc = totalAmount + vatAmount;

  return `
    <div class="doc-sheet apple-doc">
      <div class="apple-doc-header">
        <div class="apple-doc-company">
          <h2>SCI DE L'ESPERANCE</h2>
          <p>35 RUE DES CAILLOUX<br>92110 CLICHY</p>
          ${s.siret ? `<p>SIRET : ${escapeHtml(s.siret)}</p>` : ''}
        </div>
        <div class="apple-doc-meta">
          <h1>${typeTitle}</h1>
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
          ${
            charges > 0
              ? `
              <tr>
                <td>Charges</td>
                <td>${formatMoney(charges)}</td>
              </tr>
            `
              : ''
          }
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

      ${
        doc.notes
          ? `<div class="apple-doc-conditions"><p><strong>Notes :</strong> ${escapeHtml(doc.notes)}</p></div>`
          : ''
      }

      <div class="apple-doc-signature-row">
        <img src="tampon-signature.png" class="apple-doc-stamp" alt="Tampon et signature">
      </div>

      <div class="apple-doc-footer">
        SCI DE L'ESPERANCE – au capital de 10.000 €<br>
        35 RUE DES CAILLOUX 92110 CLICHY
      </div>
    </div>
  `;
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
          <p><strong>Date :</strong> ${formatDate(new Date().toISOString().slice(0, 10))}</p>
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
        <p>
          Le retard constaté est de <strong>${overdueDays} jour(s)</strong>.
        </p>
        ${
          level === 1
            ? `<p>Nous vous remercions de bien vouloir procéder au règlement dans les meilleurs délais.</p>`
            : level === 2
            ? `<p>Nous vous demandons de régulariser votre situation sous 8 jours à compter de la réception de la présente.</p>`
            : `<p>Nous vous mettons en demeure de régler la somme due sous 8 jours, à défaut de quoi toute procédure utile pourra être engagée.</p>`
        }
        <p>Mode de paiement : Chèque ou virement.</p>
        <p>Indemnité forfaitaire applicable en cas de retard de paiement : 40 €.</p>
        <p>Veuillez agréer, Madame, Monsieur, l’expression de nos salutations distinguées.</p>
      </div>

      <div class="apple-doc-signature-row">
        <img src="tampon-signature.png" class="apple-doc-stamp" alt="Tampon et signature">
      </div>

      <div class="apple-doc-footer">
        SCI DE L'ESPERANCE – au capital de 10.000 €<br>
        35 RUE DES CAILLOUX 92110 CLICHY
      </div>
    </div>
  `;
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

    const titleEl = printArea.querySelector('.apple-doc-meta h1');
    const numberParagraph = Array.from(printArea.querySelectorAll('.apple-doc-meta p'))
      .find(p => p.textContent.includes('N°'));

    const rawTitle = titleEl ? titleEl.textContent.trim() : 'document';
    const rawNumber = numberParagraph
      ? numberParagraph.textContent.replace('N° :', '').replace('N°:', '').trim()
      : new Date().getTime().toString();

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

function bindEvents() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });

  byId('quickAddClient').addEventListener('click', () => openClientModal());
  byId('addClientBtn').addEventListener('click', () => openClientModal());

  byId('newInvoiceShortcut').addEventListener('click', () =>
    state.clients.length ? openDocumentModal(null, 'facture') : alert('Ajoutez d’abord un client.')
  );

  byId('newReceiptShortcut').addEventListener('click', () =>
    state.clients.length ? openDocumentModal(null, 'quittance') : alert('Ajoutez d’abord un client.')
  );

  byId('goClientsShortcut').addEventListener('click', () => setView('clients'));

  byId('addInvoiceBtn').addEventListener('click', () =>
    state.clients.length ? openDocumentModal(null, 'facture') : alert('Ajoutez d’abord un client.')
  );

  byId('addReceiptBtn').addEventListener('click', () =>
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

  byId('clientSearch').addEventListener('input', renderClients);
  byId('documentSearch').addEventListener('input', renderDocuments);
  byId('documentFilter').addEventListener('change', renderDocuments);

  byId('reminderSearch')?.addEventListener('input', renderReminders);
  byId('reminderFilter')?.addEventListener('change', renderReminders);

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
      dueDate: item.dueDate || item.date,
      period: item.period.trim(),
      amount: Number(item.amount || 0),
      charges: Number(item.charges || 0),
      vatRate: Number(item.vatRate || 0),
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

  byId('printNowBtn')?.addEventListener('click', () => window.print());
  byId('downloadPdfBtn')?.addEventListener('click', downloadCurrentPdf);
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
