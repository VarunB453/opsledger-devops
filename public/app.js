(() => {
    'use strict';

    // ---------- Config ----------
    const REFRESH_MS = 30000;
    const CURRENCY = 'USD';
    const ICON = { ok: '#i-check-circle', warn: '#i-alert', bad: '#i-x-circle', idle: '#i-clock', receipt: '#i-transactions', trash: '#i-trash' };

    const money = new Intl.NumberFormat(undefined, { style: 'currency', currency: CURRENCY });
    const clock = new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // ---------- DOM helpers ----------
    const $ = (selector, root = document) => root.querySelector(selector);

    // Only touch the DOM when a value changed, so live regions don't re-announce on every poll.
    function setText(element, value) {
        if (element.textContent !== value) element.textContent = value;
    }

    function svgIcon(href, className = 'icon') {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', className);
        svg.setAttribute('aria-hidden', 'true');
        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', href);
        svg.append(use);
        return svg;
    }

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    const refs = {
        rows: $('#transaction-rows'),
        table: $('#transaction-rows').closest('table'),
        foot: $('#transaction-foot'),
        tableWrap: $('#table-wrap'),
        tableState: $('#table-state'),
        footLabel: $('#foot-label'),
        footTotal: $('#foot-total'),
        notice: $('#transactions-notice'),
        noticeText: $('#transactions-notice-text'),
        clearButton: $('#clear-button'),
        refreshButton: $('#refresh-button'),
        toast: $('#toast'),
        confirm: $('#confirm-dialog'),
        txDialog: $('#transaction-dialog'),
        txForm: $('#transaction-form'),
    };

    const state = {
        transactions: null,     // last good list, or null if never loaded
        signature: '',          // used to skip re-rendering unchanged data
        loadedAt: null,
        refreshing: false,
        lastRefresh: 0,
    };

    // ---------- Toast ----------
    let toastTimer;
    function showToast(message, isError = false) {
        refs.toast.textContent = message;
        refs.toast.classList.toggle('error', isError);
        refs.toast.classList.add('visible');
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => refs.toast.classList.remove('visible'), 3500);
    }

    // ---------- Formatting ----------
    function formatDuration(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (days) return `${days}d ${hours}h`;
        if (hours) return `${hours}h ${minutes}m`;
        if (minutes) return `${minutes}m`;
        return `${Math.max(0, Math.floor(seconds))}s`;
    }

    function formatMoney(value) {
        const number = Number(value);
        return Number.isFinite(number) ? money.format(number) : '—';
    }

    function formatTime(value) {
        const date = value ? new Date(value) : new Date();
        return clock.format(Number.isNaN(date.getTime()) ? new Date() : date);
    }

    function setUpdated(label, value) {
        setText($('#updated-label'), label);
        setText($('#last-checked'), value);
    }

    // ---------- Health state ----------
    const HEALTH = {
        checking: { title: 'Connecting to application', message: 'Fetching live health and database status.', tag: 'Checking', icon: ICON.idle },
        operational: { title: 'All application systems operational', message: 'API is serving requests and the transaction database is reachable.', tag: 'Operational', icon: ICON.ok },
        degraded: { title: 'Application is running in a degraded state', message: 'The API is responding, but the database connection needs attention.', tag: 'Degraded', icon: ICON.warn },
        offline: { title: 'Application API unreachable', message: 'Check that the server is running, then refresh.', tag: 'Offline', icon: ICON.bad },
    };

    function setHealth(name) {
        const health = HEALTH[name];
        $('#status-banner').dataset.state = name;
        $('#service-tag').dataset.state = name;
        $('#sidebar-dot').dataset.state = name;
        $('#banner-icon-use').setAttribute('href', health.icon);
        setText($('#service-title'), health.title);
        setText($('#service-message'), health.message);
        setText($('#service-tag'), health.tag);
        // Surface problems in the browser tab for people who keep this page open in the background.
        const prefix = name === 'degraded' || name === 'offline' ? `${health.tag}: ` : '';
        document.title = `${prefix}OpsLedger | Operations`;
    }

    function setDatabaseState(name) {
        const labels = {
            connected: ['Connected', 'Readiness probe passed', ''],
            unavailable: ['Unavailable', 'Check DB_HOST and credentials', 'warn'],
            unknown: ['Unknown', 'Cannot check while the API is offline', ''],
        };
        const [label, detail, tone] = labels[name];
        const metric = $('#database-metric');
        setText(metric, label);
        setText($('#database-detail'), detail);
        metric.closest('.metric').dataset.state = tone;
        setText($('#runtime-database'), label);
        $('#database-dot').dataset.state = name;
    }

    function setPathStep(id, stateName, value) {
        $(`#${id}`).dataset.state = stateName;
        setText($(`#${id}-value`), value);
        const symbol = stateName === 'done' || stateName === 'operational' ? '#i-check'
            : stateName === 'degraded' ? '#i-alert'
            : stateName === 'offline' ? '#i-x-circle' : '#i-minus';
        $(`#${id} use`).setAttribute('href', symbol);
    }

    // Delivery path reflects what the API actually reports instead of fixed checkmarks.
    function renderDeliveryPath(status, healthName) {
        const release = status && status.release && status.release !== 'local' ? String(status.release) : '';
        const version = status && status.version && status.version !== 'unknown' ? String(status.version) : '';
        const environment = (status && status.environment) || 'unknown';
        setPathStep('path-commit', release ? 'done' : 'unset', release ? release.slice(0, 7) : 'Not reported');
        setPathStep('path-build', version ? 'done' : 'unset', version ? `Version ${version}` : 'Not reported');
        const runtimeLabel = { operational: 'Operational', degraded: 'Degraded', offline: 'Offline' }[healthName] || 'Checking';
        setPathStep('path-runtime', healthName === 'checking' ? 'unknown' : healthName, status ? `${environment}, ${runtimeLabel.toLowerCase()}` : 'Unreachable');
        $('#path-hint').hidden = Boolean(release && version);
    }

    // ---------- Status ----------
    async function loadStatus() {
        try {
            const response = await fetch('/api/status', { headers: { Accept: 'application/json' }, cache: 'no-store' });
            const status = await response.json().catch(() => null);
            if (!status || typeof status !== 'object') throw new Error(`Unexpected response (HTTP ${response.status})`);

            const healthy = response.ok && status.status === 'operational';
            const healthName = healthy ? 'operational' : 'degraded';
            const version = status.version && status.version !== 'unknown' ? `v${status.version}` : 'unknown';
            const environment = status.environment || 'unknown';

            setHealth(healthName);
            setText($('#api-metric'), 'Online');
            setText($('#api-detail'), version === 'unknown' ? environment : `${version} in ${environment}`);
            setText($('#uptime-metric'), formatDuration(Number(status.uptime) || 0));
            setText($('#runtime-environment'), environment);
            setText($('#runtime-version'), status.version || 'unknown');
            setText($('#sidebar-environment'), environment);
            setText($('#sidebar-version'), version === 'unknown' ? '--' : version);
            setDatabaseState(status.database === 'connected' ? 'connected' : 'unavailable');

            const release = status.release || 'local';
            setText($('#runtime-release'), release);
            $('#copy-release').hidden = !(navigator.clipboard && window.isSecureContext) || release === 'local';

            renderDeliveryPath(status, healthName);
            setUpdated('Updated', formatTime(status.timestamp));
        } catch (error) {
            setHealth('offline');
            setText($('#api-metric'), 'Offline');
            $('#api-metric').closest('.metric').dataset.state = 'bad';
            setText($('#api-detail'), 'Health endpoint unavailable');
            setText($('#uptime-metric'), '--');
            setDatabaseState('unknown');
            renderDeliveryPath(null, 'offline');
            setUpdated('Status check', 'failed, retrying');
            return;
        }
        $('#api-metric').closest('.metric').dataset.state = '';
    }

    // ---------- Transactions: rendering ----------
    function stateBox({ icon, tone = '', title, text, action }) {
        const box = el('div', 'state-box');
        const iconWrap = el('span', `state-icon ${tone}`.trim());
        iconWrap.setAttribute('aria-hidden', 'true');
        iconWrap.append(svgIcon(icon));
        box.append(iconWrap, el('strong', '', title), el('p', '', text));
        if (action) box.append(action);
        return box;
    }

    // Empty and error states replace the table (no column headers over nothing).
    function showTableState(box) {
        refs.tableWrap.hidden = true;
        refs.tableState.replaceChildren(box);
        refs.tableState.hidden = false;
        refs.rows.replaceChildren();
        refs.foot.hidden = true;
    }

    function showTableRows() {
        refs.tableState.hidden = true;
        refs.tableWrap.hidden = false;
    }

    function actionButton(label, onClick, primary = false) {
        const button = el('button', `btn ${primary ? 'btn-primary' : 'btn-secondary'}`, label);
        button.type = 'button';
        button.addEventListener('click', onClick);
        return button;
    }

    function setTableBusy(busy) {
        refs.table.setAttribute('aria-busy', String(busy));
    }

    function renderTransactions(transactions) {
        const total = transactions.reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0);
        const count = transactions.length;

        setText($('#transaction-count'), count.toLocaleString());
        setText($('#transaction-total'), `Total recorded: ${money.format(total)}`);
        refs.clearButton.disabled = count === 0;
        setTableBusy(false);

        if (!count) {
            showTableState(stateBox({
                icon: ICON.receipt,
                title: 'No transactions yet',
                text: 'Records you add appear here, with a running total.',
                action: actionButton('Add transaction', openAddDialog, true),
            }));
            return;
        }

        showTableRows();
        const fragment = document.createDocumentFragment();
        for (const transaction of transactions) {
            const row = document.createElement('tr');

            const description = el('td');
            const text = el('span', 'desc', transaction.description);
            text.title = transaction.description;
            description.append(text, el('span', 'id-inline', `#${transaction.id}`));

            const id = el('td', 'cell-id', `#${transaction.id}`);
            const amount = el('td', 'cell-amount', formatMoney(transaction.amount));

            const action = el('td', 'cell-action');
            const remove = el('button', 'icon-btn danger');
            remove.type = 'button';
            remove.title = 'Delete transaction';
            remove.setAttribute('aria-label', `Delete transaction ${transaction.id}: ${transaction.description}`);
            remove.append(svgIcon(ICON.trash));
            remove.addEventListener('click', () => confirmDelete(transaction));
            action.append(remove);

            row.append(description, id, amount, action);
            fragment.append(row);
        }
        refs.rows.replaceChildren(fragment);

        setText(refs.footLabel, `Total (${count} record${count === 1 ? '' : 's'})`);
        setText(refs.footTotal, money.format(total));
        refs.foot.hidden = false;
    }

    function applyTransactions(list, { force = false } = {}) {
        const signature = JSON.stringify(list);
        state.transactions = list;
        state.loadedAt = new Date();
        refs.notice.hidden = true;
        // Skip identical data so background polling never steals keyboard focus from a row button.
        if (!force && signature === state.signature) return;
        state.signature = signature;
        renderTransactions(list);
    }

    function handleTransactionsError(error) {
        const reason = error && error.message ? error.message : 'Transaction service unavailable';
        if (state.transactions) {
            // Keep the last good data visible and say how old it is.
            refs.noticeText.textContent = `Couldn't refresh transactions. Showing data from ${formatTime(state.loadedAt)}.`;
            refs.notice.hidden = false;
            return;
        }
        setTableBusy(false);
        setText($('#transaction-count'), '--');
        setText($('#transaction-total'), 'Database connection required');
        refs.clearButton.disabled = true;
        state.signature = '';
        showTableState(stateBox({
            icon: ICON.warn,
            tone: 'bad',
            title: "Transactions couldn't be loaded",
            text: `${reason}. Check the database connection and try again.`,
            action: actionButton('Try again', () => refreshDashboard()),
        }));
    }

    async function loadTransactions({ force = false } = {}) {
        try {
            const response = await fetch('/transaction', { headers: { Accept: 'application/json' }, cache: 'no-store' });
            if (!response.ok) throw new Error('Transaction service unavailable');
            const data = await response.json();
            applyTransactions(Array.isArray(data.result) ? data.result : [], { force });
        } catch (error) {
            handleTransactionsError(error);
        }
    }

    // ---------- Refresh ----------
    async function refreshDashboard({ force = false } = {}) {
        if (state.refreshing) return;
        state.refreshing = true;
        refs.refreshButton.setAttribute('aria-busy', 'true');
        try {
            await Promise.all([loadStatus(), loadTransactions({ force })]);
            state.lastRefresh = Date.now();
        } finally {
            state.refreshing = false;
            refs.refreshButton.removeAttribute('aria-busy');
        }
    }

    // ---------- Confirm dialog (single delete + clear all) ----------
    const confirmUi = {
        title: $('#confirm-title'),
        message: $('#confirm-message'),
        error: $('#confirm-error'),
        action: $('#confirm-action'),
        cancel: $('#confirm-cancel'),
        pending: false,
        handler: null,
    };

    function openConfirm({ title, message, confirmLabel, pendingLabel, handler }) {
        confirmUi.title.textContent = title;
        confirmUi.message.textContent = message;
        confirmUi.action.textContent = confirmLabel;
        confirmUi.action.dataset.label = confirmLabel;
        confirmUi.action.dataset.pending = pendingLabel;
        confirmUi.error.hidden = true;
        confirmUi.handler = handler;
        setConfirmPending(false);
        refs.confirm.showModal();
    }

    function setConfirmPending(pending) {
        confirmUi.pending = pending;
        confirmUi.action.disabled = pending;
        confirmUi.cancel.disabled = pending;
        confirmUi.action.setAttribute('aria-busy', String(pending));
        confirmUi.action.textContent = pending ? confirmUi.action.dataset.pending : confirmUi.action.dataset.label;
    }

    confirmUi.cancel.addEventListener('click', () => refs.confirm.close());
    confirmUi.action.addEventListener('click', async () => {
        if (confirmUi.pending || !confirmUi.handler) return;
        setConfirmPending(true);
        confirmUi.error.hidden = true;
        try {
            const successMessage = await confirmUi.handler();
            refs.confirm.close();
            showToast(successMessage);
            await refreshDashboard({ force: true });
        } catch (error) {
            // Show the failure inside the dialog; a toast would be hidden behind the modal.
            confirmUi.error.textContent = error.message;
            confirmUi.error.hidden = false;
            setConfirmPending(false);
        }
    });
    refs.confirm.addEventListener('cancel', (event) => { if (confirmUi.pending) event.preventDefault(); });

    async function request(url, options) {
        let response;
        try {
            response = await fetch(url, options);
        } catch (error) {
            throw new Error('Could not reach the server. Check your connection and try again.');
        }
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || `Request failed (HTTP ${response.status}).`);
        return result;
    }

    function confirmDelete(transaction) {
        openConfirm({
            title: `Delete transaction #${transaction.id}?`,
            message: `${transaction.description} (${formatMoney(transaction.amount)}) will be permanently removed from the database.`,
            confirmLabel: 'Delete transaction',
            pendingLabel: 'Deleting…',
            handler: async () => {
                await request(`/transaction/${encodeURIComponent(transaction.id)}`, { method: 'DELETE' });
                return 'Transaction deleted.';
            },
        });
    }

    function confirmClear() {
        const count = state.transactions ? state.transactions.length : 0;
        openConfirm({
            title: 'Clear all transactions?',
            message: `This permanently deletes ${count === 1 ? 'the 1 transaction' : `all ${count} transactions`} from the database. This can't be undone.`,
            confirmLabel: 'Clear all',
            pendingLabel: 'Clearing…',
            handler: async () => {
                const result = await request('/transaction', { method: 'DELETE' });
                const deleted = Number(result.deleted) || 0;
                return `${deleted} transaction${deleted === 1 ? '' : 's'} cleared.`;
            },
        });
    }

    // ---------- Add transaction dialog ----------
    const txUi = {
        amount: $('#amount-input'),
        desc: $('#description-input'),
        error: $('#transaction-error'),
        submit: $('#save-transaction'),
        cancel: $('#cancel-transaction'),
        pending: false,
    };

    function setFieldError(input, message) {
        const field = input.closest('.field');
        const error = $(`#${input.id.replace('-input', '')}-error`);
        error.textContent = message || '';
        error.hidden = !message;
        if (message) {
            field.dataset.invalid = '';
            input.setAttribute('aria-invalid', 'true');
        } else {
            delete field.dataset.invalid;
            input.removeAttribute('aria-invalid');
        }
    }

    function validateTransaction() {
        const amount = txUi.amount.value.trim();
        const description = txUi.desc.value.trim();
        let amountError = '';
        if (txUi.amount.validity.badInput) amountError = 'Enter a valid number.';
        else if (!amount) amountError = 'Enter an amount.';
        else if (!(Number(amount) > 0)) amountError = 'Amount must be greater than 0.';
        else if (!/^\d+(\.\d{1,2})?$/.test(amount)) amountError = 'Use at most two decimal places.';
        setFieldError(txUi.amount, amountError);
        setFieldError(txUi.desc, description ? '' : 'Enter a description.');
        return { valid: !amountError && Boolean(description), amount, description };
    }

    function openAddDialog() {
        refs.txForm.reset();
        setFieldError(txUi.amount, '');
        setFieldError(txUi.desc, '');
        txUi.error.hidden = true;
        setTxPending(false);
        refs.txDialog.showModal();
    }

    function setTxPending(pending) {
        txUi.pending = pending;
        txUi.submit.disabled = pending;
        txUi.cancel.disabled = pending;
        txUi.submit.setAttribute('aria-busy', String(pending));
        txUi.submit.textContent = pending ? 'Saving…' : 'Save transaction';
    }

    txUi.amount.addEventListener('input', () => setFieldError(txUi.amount, ''));
    txUi.desc.addEventListener('input', () => setFieldError(txUi.desc, ''));
    txUi.cancel.addEventListener('click', () => refs.txDialog.close());
    refs.txDialog.addEventListener('cancel', (event) => { if (txUi.pending) event.preventDefault(); });

    refs.txForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (txUi.pending) return;
        txUi.error.hidden = true;
        const { valid, amount, description } = validateTransaction();
        if (!valid) {
            (txUi.amount.getAttribute('aria-invalid') ? txUi.amount : txUi.desc).focus();
            return;
        }
        setTxPending(true);
        try {
            await request('/transaction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount, desc: description }),
            });
            refs.txDialog.close();
            showToast('Transaction added.');
            await refreshDashboard({ force: true });
        } catch (error) {
            txUi.error.textContent = error.message;
            txUi.error.hidden = false;
            setTxPending(false);
        }
    });

    // Close a dialog when the backdrop is clicked (but not when a text selection drag ends there).
    for (const dialog of [refs.confirm, refs.txDialog]) {
        let downOnBackdrop = false;
        dialog.addEventListener('pointerdown', (event) => { downOnBackdrop = event.target === dialog; });
        dialog.addEventListener('click', (event) => {
            const busy = dialog === refs.confirm ? confirmUi.pending : txUi.pending;
            if (downOnBackdrop && event.target === dialog && !busy) dialog.close();
            downOnBackdrop = false;
        });
    }

    // ---------- Release id copy ----------
    $('#copy-release').addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText($('#runtime-release').textContent);
            showToast('Release identifier copied.');
        } catch (error) {
            showToast('Could not copy. Select the identifier and copy it manually.', true);
        }
    });

    // ---------- Navigation: keep aria-current in sync with the section in view ----------
    const navLinks = [...document.querySelectorAll('.nav-item')];
    const navTargets = navLinks.map((link) => $(link.getAttribute('href')));

    function setActiveNav(id) {
        for (const link of navLinks) {
            if (link.getAttribute('href') === `#${id}`) link.setAttribute('aria-current', 'location');
            else link.removeAttribute('aria-current');
        }
    }

    function updateNavFromScroll() {
        const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
        const line = window.innerHeight * 0.35;
        let current = navTargets[0];
        for (const target of navTargets) {
            if (target.getBoundingClientRect().top <= line) current = target;
        }
        if (atBottom && window.scrollY > 0) current = navTargets[navTargets.length - 1];
        setActiveNav(current.id);
    }

    let scrollFrame = 0;
    window.addEventListener('scroll', () => {
        if (scrollFrame) return;
        scrollFrame = window.requestAnimationFrame(() => { scrollFrame = 0; updateNavFromScroll(); });
    }, { passive: true });
    for (const link of navLinks) {
        link.addEventListener('click', () => setActiveNav(link.getAttribute('href').slice(1)));
    }
    if (location.hash && navTargets.some((target) => `#${target.id}` === location.hash)) setActiveNav(location.hash.slice(1));

    // ---------- Wire up ----------
    refs.refreshButton.addEventListener('click', () => refreshDashboard());
    $('#notice-retry').addEventListener('click', () => refreshDashboard());
    $('#add-button').addEventListener('click', openAddDialog);
    refs.clearButton.addEventListener('click', confirmClear);

    refreshDashboard();
    window.setInterval(() => { if (!document.hidden) refreshDashboard(); }, REFRESH_MS);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && Date.now() - state.lastRefresh > REFRESH_MS) refreshDashboard();
    });
})();
