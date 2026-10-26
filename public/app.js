const rows = document.querySelector('#transaction-rows');
const toast = document.querySelector('#toast');
const dialog = document.querySelector('#confirm-dialog');
let toastTimer;
let editingTransactionId = null;

function showToast(message, isError = false) {
    toast.textContent = message;
    toast.classList.toggle('error', isError);
    toast.classList.add('visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 3000);
}

function formatDuration(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days) return `${days}d ${hours}h`;
    if (hours) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

function setDatabaseState(connected) {
    const value = connected ? 'Connected' : 'Unavailable';
    document.querySelector('#database-metric').textContent = value;
    document.querySelector('#database-detail').textContent = connected ? 'Readiness probe passed' : 'Check DB_HOST and credentials';
    document.querySelector('#runtime-database').textContent = value;
    document.querySelector('#database-dot').className = `state-dot ${connected ? 'connected' : 'disconnected'}`;
}

async function loadStatus() {
    try {
        const response = await fetch('/api/status', { headers: { Accept: 'application/json' } });
        const status = await response.json();
        const healthy = response.ok && status.status === 'operational';
        const banner = document.querySelector('.service-banner');
        banner.classList.toggle('degraded', !healthy);
        document.querySelector('#service-title').textContent = healthy ? 'All application systems operational' : 'Application is running in a degraded state';
        document.querySelector('#service-message').textContent = healthy
            ? 'API is serving requests and the transaction database is reachable.'
            : 'The API is responding, but the database connection needs attention.';
        document.querySelector('#service-tag').textContent = healthy ? 'OPERATIONAL' : 'DEGRADED';
        document.querySelector('#api-metric').textContent = 'Online';
        document.querySelector('#api-detail').textContent = `v${status.version} · ${status.environment}`;
        document.querySelector('#uptime-metric').textContent = formatDuration(status.uptime || 0);
        document.querySelector('#runtime-environment').textContent = status.environment || 'unknown';
        document.querySelector('#runtime-version').textContent = status.version || 'unknown';
        document.querySelector('#runtime-release').textContent = status.release || 'local';
        document.querySelector('#sidebar-environment').textContent = status.environment || 'unknown';
        document.querySelector('#sidebar-version').textContent = `v${status.version || 'unknown'}`;
        setDatabaseState(status.database === 'connected');
        document.querySelector('#last-checked').textContent = new Date(status.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (error) {
        document.querySelector('#service-title').textContent = 'Application API unreachable';
        document.querySelector('#service-message').textContent = 'Check that the server is running and try refreshing.';
        document.querySelector('#service-tag').textContent = 'OFFLINE';
        document.querySelector('.service-banner').classList.add('degraded');
        document.querySelector('#api-metric').textContent = 'Offline';
        document.querySelector('#api-detail').textContent = 'Health endpoint unavailable';
        document.querySelector('#last-checked').textContent = 'Request failed';
        setDatabaseState(false);
    }
}

function renderTransactions(transactions) {
    document.querySelector('#transaction-count').textContent = transactions.length.toLocaleString();
    const total = transactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    document.querySelector('#transaction-total').textContent = `Total recorded · ${new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(total)}`;
    document.querySelector('#table-foot').textContent = `${transactions.length} record${transactions.length === 1 ? '' : 's'} returned by the transaction API`;
    rows.replaceChildren();
    if (!transactions.length) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="4" class="empty-state">No transactions yet. Add a record to get started.</td>';
        rows.append(row);
        return;
    }
    for (const transaction of transactions) {
        const row = document.createElement('tr');
        const description = document.createElement('td');
        description.textContent = transaction.description;
        const id = document.createElement('td');
        id.className = 'record-id';
        id.textContent = `#${transaction.id}`;
        const amount = document.createElement('td');
        amount.className = 'amount';
        amount.textContent = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(transaction.amount);
        const action = document.createElement('td');
        action.className = 'action-cell';
        const edit = document.createElement('button');
        edit.className = 'edit-row';
        edit.type = 'button';
        edit.title = `Edit transaction ${transaction.id}`;
        edit.setAttribute('aria-label', `Edit transaction ${transaction.id}`);
        edit.textContent = 'Edit';
        edit.addEventListener('click', () => openTransactionEditor(transaction));
        const remove = document.createElement('button');
        remove.className = 'delete-row';
        remove.type = 'button';
        remove.title = `Delete transaction ${transaction.id}`;
        remove.setAttribute('aria-label', `Delete transaction ${transaction.id}`);
        remove.textContent = '×';
        remove.addEventListener('click', () => deleteTransaction(transaction.id));
        action.append(edit, remove);
        row.append(description, id, amount, action);
        rows.append(row);
    }
}

async function loadTransactions() {
    try {
        const response = await fetch('/transaction');
        if (!response.ok) throw new Error('Transaction service unavailable');
        const data = await response.json();
        renderTransactions(data.result || []);
    } catch (error) {
        document.querySelector('#transaction-count').textContent = '--';
        document.querySelector('#transaction-total').textContent = 'Database connection required';
        document.querySelector('#table-foot').textContent = error.message;
        rows.innerHTML = '<tr><td colspan="4" class="empty-state">Transactions could not be loaded.</td></tr>';
    }
}

async function deleteTransaction(id) {
    try {
        const response = await fetch(`/transaction/${id}`, { method: 'DELETE' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Could not delete transaction');
        showToast('Transaction deleted.');
        await Promise.all([loadTransactions(), loadStatus()]);
    } catch (error) {
        showToast(error.message, true);
    }
}

async function refreshDashboard() {
    const button = document.querySelector('#refresh-button');
    button.disabled = true;
    await Promise.all([loadStatus(), loadTransactions()]);
    button.disabled = false;
}

document.querySelector('#refresh-button').addEventListener('click', refreshDashboard);
document.querySelector('#clear-button').addEventListener('click', () => dialog.showModal());
const transactionDialog = document.querySelector('#transaction-dialog');
const transactionForm = document.querySelector('#transaction-form');

function openTransactionEditor(transaction = null) {
    editingTransactionId = transaction ? transaction.id : null;
    transactionForm.elements.amount.value = transaction ? transaction.amount : '';
    transactionForm.elements.desc.value = transaction ? transaction.description : '';
    document.querySelector('#transaction-dialog-title').textContent = transaction ? 'Edit transaction' : 'Add transaction';
    document.querySelector('#save-transaction').textContent = transaction ? 'Update transaction' : 'Save transaction';
    transactionDialog.showModal();
}

document.querySelector('#add-button').addEventListener('click', () => openTransactionEditor());
document.querySelector('#cancel-transaction').addEventListener('click', () => transactionDialog.close());
transactionForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const editing = editingTransactionId !== null;
    try {
        const response = await fetch(editing ? `/transaction/${editingTransactionId}` : '/transaction', {
            method: editing ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: formData.get('amount'), desc: formData.get('desc') })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Could not add transaction');
        transactionDialog.close();
        form.reset();
        editingTransactionId = null;
        showToast(editing ? 'Transaction updated.' : 'Transaction added.');
        await Promise.all([loadTransactions(), loadStatus()]);
    } catch (error) {
        showToast(error.message, true);
    }
});
document.querySelector('#confirm-clear').addEventListener('click', async (event) => {
    event.preventDefault();
    dialog.close();
    try {
        const response = await fetch('/transaction', { method: 'DELETE' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Could not clear transactions');
        showToast(`${result.deleted} transaction${result.deleted === 1 ? '' : 's'} cleared.`);
        await Promise.all([loadTransactions(), loadStatus()]);
    } catch (error) {
        showToast(error.message, true);
    }
});

refreshDashboard();
window.setInterval(() => Promise.all([loadStatus(), loadTransactions()]), 30000);