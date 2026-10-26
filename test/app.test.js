const assert = require('node:assert/strict');
const { after, test } = require('node:test');
const transactionService = require('../TransactionService');

const transactions = new Map();
let nextId = 1;

transactionService.checkConnection = async () => {};
transactionService.addTransaction = async (amount, description) => {
    const id = nextId++;
    transactions.set(id, { id, amount, description });
    return id;
};
transactionService.getAllTransactions = async () => Array.from(transactions.values()).reverse();
transactionService.findTransactionById = async (id) => transactions.get(id) || null;
transactionService.updateTransactionById = async (id, amount, description) => {
    transactions.set(id, { id, amount, description });
    return 1;
};
transactionService.deleteTransactionById = async (id) => Number(transactions.delete(id));
transactionService.deleteAllTransactions = async () => {
    const deleted = transactions.size;
    transactions.clear();
    return deleted;
};

const app = require('../index');
const server = app.listen(0);
const baseUrl = new Promise((resolve) => server.once('listening', () => {
    resolve(`http://127.0.0.1:${server.address().port}`);
}));

after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
}));

test('transaction API validates and supports the full record lifecycle', async () => {
    const base = await baseUrl;
    const invalid = await fetch(`${base}/transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 0, desc: '' })
    });
    assert.equal(invalid.status, 400);

    const created = await fetch(`${base}/transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 12.5, desc: 'Initial record' })
    });
    assert.equal(created.status, 201);
    const { id } = await created.json();

    const updated = await fetch(`${base}/transaction/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 20, desc: 'Updated record' })
    });
    assert.equal(updated.status, 200);

    const lookup = await fetch(`${base}/transaction/${id}`);
    assert.deepEqual(await lookup.json(), { id, amount: 20, description: 'Updated record' });

    const listed = await fetch(`${base}/transaction`);
    assert.equal((await listed.json()).result.length, 1);

    const deleted = await fetch(`${base}/transaction/${id}`, { method: 'DELETE' });
    assert.equal(deleted.status, 200);

    const missing = await fetch(`${base}/transaction/${id}`);
    assert.equal(missing.status, 404);
    assert.equal((await fetch(`${base}/transaction/not-an-id`)).status, 400);
});
