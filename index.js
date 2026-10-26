const transactionService = require('./TransactionService');
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'opsledger-api',
        uptime: Math.floor(process.uptime()),
        version: process.env.APP_VERSION || require('./package.json').version,
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
    });
});

app.get('/ready', async (req, res) => {
    try {
        await transactionService.checkConnection();
        res.json({ status: 'ready', database: 'connected' });
    } catch (error) {
        res.status(503).json({ status: 'not_ready', database: 'unavailable' });
    }
});

app.get('/api/status', async (req, res) => {
    let database = 'unavailable';
    try {
        await transactionService.checkConnection();
        database = 'connected';
    } catch (error) {
        res.status(503);
    }
    res.json({
        service: 'opsledger-api',
        status: database === 'connected' ? 'operational' : 'degraded',
        database,
        version: process.env.APP_VERSION || require('./package.json').version,
        environment: process.env.NODE_ENV || 'development',
        release: process.env.GIT_COMMIT || process.env.BUILD_NUMBER || 'local',
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

app.post('/transaction', async (req, res) => {
    const amount = Number(req.body.amount);
    const description = typeof req.body.desc === 'string' ? req.body.desc.trim() : '';
    if (!Number.isFinite(amount) || amount <= 0 || !description || description.length > 255) {
        return res.status(400).json({ message: 'Provide a positive amount and a description up to 255 characters.' });
    }
    try {
        const id = await transactionService.addTransaction(amount, description);
        res.status(201).json({ message: 'Transaction added.', id });
    } catch (error) {
        res.status(503).json({ message: 'Transaction service is unavailable.' });
    }
});

app.get('/transaction', async (req, res) => {
    try {
        const result = await transactionService.getAllTransactions();
        res.json({ result });
    } catch (error) {
        res.status(503).json({ message: 'Transaction service is unavailable.' });
    }
});

app.delete('/transaction', async (req, res) => {
    try {
        const deleted = await transactionService.deleteAllTransactions();
        res.json({ message: 'Transactions cleared.', deleted });
    } catch (error) {
        res.status(503).json({ message: 'Transaction service is unavailable.' });
    }
});

app.get('/transaction/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({ message: 'Transaction id must be a positive integer.' });
    }
    try {
        const transaction = await transactionService.findTransactionById(id);
        if (!transaction) return res.status(404).json({ message: 'Transaction not found.' });
        res.json(transaction);
    } catch (error) {
        res.status(503).json({ message: 'Transaction service is unavailable.' });
    }
});

app.delete('/transaction/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({ message: 'Transaction id must be a positive integer.' });
    }
    try {
        const deleted = await transactionService.deleteTransactionById(id);
        if (!deleted) return res.status(404).json({ message: 'Transaction not found.' });
        res.json({ message: 'Transaction deleted.' });
    } catch (error) {
        res.status(503).json({ message: 'Transaction service is unavailable.' });
    }
});

if (require.main === module) {
    const port = process.env.PORT || 8080;
    app.listen(port, () => {
        console.log(`OpsLedger API listening on port ${port}`);
    });
}

module.exports = app;