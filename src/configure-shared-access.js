import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const email = 'douglas.mendez1@catolica.edu.sv';
const password = readFileSync(0, 'utf8').replace(/\r?\n$/, '');
if (!password.trim() || password.length > 256) {
    console.error('Escribe la contrasena compartida para configurar el acceso.');
    process.exit(1);
}

const directory = process.env.DATA_DIR || 'data';
mkdirSync(directory, { recursive: true });
const database = new DatabaseSync(join(directory, 'telemetry.sqlite'));
try {
    database.exec(`PRAGMA busy_timeout=5000;
        CREATE TABLE IF NOT EXISTS users(email TEXT PRIMARY KEY, salt TEXT, hash TEXT);`);
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    database.prepare('INSERT INTO users(email, salt, hash) VALUES (?, ?, ?) ON CONFLICT(email) DO NOTHING')
        .run(email, salt, hash);
    const account = database.prepare('SELECT salt, hash FROM users WHERE email = ?').get(email);
    if (!timingSafeEqual(scryptSync(password, account.salt, 64), Buffer.from(account.hash, 'hex'))) {
        console.error('La cuenta ya existe con otra contrasena. No se cambio el acceso.');
        process.exitCode = 1;
    } else {
        console.log('Acceso compartido configurado.');
    }
} finally {
    database.close();
}
