#!/usr/bin/env node
/**
 * Read-only MySQL preflight. No DDL, DML, migration, or data clearing.
 * Run on the actual backend host with credentials stored in its secret manager.
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const keys = ['DB_HOST','DB_NAME','DB_USERNAME','DB_PASSWORD'];
const missing = keys.filter(k => !process.env[k] || process.env[k].startsWith('REPLACE_'));
if (missing.length) {
    console.error('Missing DB settings: ' + missing.join(', '));
    process.exit(2);
}
const dbName = process.env.DB_NAME;
if (!/^[A-Za-z0-9_]+$/.test(dbName)) {
    console.error('Unsafe DB_NAME; only letters, numbers and underscore allowed.');
    process.exit(2);
}
let connection;
try {
    connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: dbName,
        connectTimeout: 10000,
        ssl: process.env.DB_SSL === 'true' ? {rejectUnauthorized: true} : undefined,
    });
    const [[version]] = await connection.query('SELECT VERSION() AS version, DATABASE() AS selectedDatabase');
    const [tables] = await connection.query('SHOW FULL TABLES');
    console.log('Connected to database:', version.selectedDatabase);
    console.log('MySQL/MariaDB version:', version.version);
    console.log('Existing table count:', tables.length);
    if (tables.length) {
        console.error('STOP: Database is not empty. Do not run initial migrations before reviewing existing tables.');
        process.exitCode = 3;
    } else {
        console.log('Database appears empty. This is READ-ONLY verification, not migration approval.');
    }
} catch (err) {
    // Never print full mysql2 error object; it can contain connection details.
    const permitted = new Set(['ER_ACCESS_DENIED_ERROR','ENOTFOUND','ECONNREFUSED','ETIMEDOUT','EHOSTUNREACH','PROTOCOL_CONNECTION_LOST']);
    const code = permitted.has(err?.code) ? err.code : 'DB_CONNECTION_ERROR';
    console.error('Database preflight failed:', code);
    process.exitCode = 4;
} finally {
    await connection?.end();
}
