// database.js (Updated repair_requests table schema)

const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./asset.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the asset management database.');
});

db.serialize(() => {
    // Users Table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        fullName TEXT,
        role TEXT NOT NULL DEFAULT 'user'
    )`);

    // Equipment Table
    db.run(`CREATE TABLE IF NOT EXISTS equipment (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assetNumber TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        type TEXT,
        location TEXT,
        status TEXT DEFAULT 'Normal'
    )`);

    // Repair Requests Table (Updated Schema with Timestamps)
    db.run(`CREATE TABLE IF NOT EXISTS repair_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        equipmentId INTEGER NOT NULL,
        userId INTEGER,
        reporterName TEXT,
        reporterLocation TEXT,
        reporterContact TEXT,
        problemDescription TEXT,
        requestDate TEXT,
        acceptedDate TEXT,
        completedDate TEXT,
        status TEXT DEFAULT 'Pending',
        technicianId INTEGER,
        solutionNotes TEXT,
        FOREIGN KEY(equipmentId) REFERENCES equipment(id),
        FOREIGN KEY(userId) REFERENCES users(id),
        FOREIGN KEY(technicianId) REFERENCES users(id)
    )`);
});

module.exports = db;

