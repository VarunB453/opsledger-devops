const dbcreds = require('./DbConfig');
const mysql = require('mysql2/promise');

const connection = mysql.createPool({
    host: process.env.DB_HOST || dbcreds.DB_HOST,
    user: process.env.DB_USER || dbcreds.DB_USER,
    password: process.env.DB_PWD || dbcreds.DB_PWD,
    database: process.env.DB_DATABASE || dbcreds.DB_DATABASE,
    waitForConnections: true,
    connectionLimit: 10
});

async function checkConnection() {
    await connection.query('SELECT 1');
}

async function addTransaction(amount, description) {
    const [result] = await connection.execute(
        'INSERT INTO `transactions` (`amount`, `description`) VALUES (?, ?)',
        [amount, description]
    );
    return result.insertId;
}

async function getAllTransactions() {
    const [rows] = await connection.query(
        'SELECT id, amount, description FROM transactions ORDER BY id DESC'
    );
    return rows;
}

async function findTransactionById(id) {
    const [rows] = await connection.execute(
        'SELECT id, amount, description FROM transactions WHERE id = ?',
        [id]
    );
    return rows[0] || null;
}

async function deleteAllTransactions() {
    const [result] = await connection.query('DELETE FROM transactions');
    return result.affectedRows;
}

async function deleteTransactionById(id) {
    const [result] = await connection.execute(
        'DELETE FROM transactions WHERE id = ?',
        [id]
    );
    return result.affectedRows;
}

module.exports = {
    checkConnection,
    addTransaction,
    getAllTransactions,
    findTransactionById,
    deleteAllTransactions,
    deleteTransactionById
};

