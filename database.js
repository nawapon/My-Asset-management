// database.js

const sqlite3 = require('sqlite3').verbose();

// สร้างหรือเชื่อมต่อกับไฟล์ฐานข้อมูลชื่อ 'asset.db'
const db = new sqlite3.Database('./asset.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the asset management database.');
});

// สร้างตารางถ้ายังไม่มี
db.serialize(() => {
    // ตารางผู้ใช้งาน (users)
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        fullName TEXT,
        role TEXT NOT NULL DEFAULT 'user'
    )`, (err) => {
        if (err) console.error("Error creating users table", err);
    });

    // ตารางครุภัณฑ์ (equipment)
    db.run(`CREATE TABLE IF NOT EXISTS equipment (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assetNumber TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        type TEXT,
        location TEXT,
        status TEXT DEFAULT 'Normal'
    )`, (err) => {
        if (err) console.error("Error creating equipment table", err);
    });

    // ตารางแจ้งซ่อม (repair_requests) - ยังไม่ได้ใช้งานใน UI แต่มีโครงสร้างไว้
    db.run(`CREATE TABLE IF NOT EXISTS repair_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        equipmentId INTEGER,
        userId INTEGER,
        reporterName TEXT,
        reporterLocation TEXT,
        reporterContact INTEGER,
        problemDescription TEXT,
        requestDate TEXT,
        status TEXT DEFAULT 'Pending',
        technicianId INTEGER,
        solutionNotes TEXT,
        FOREIGN KEY(equipmentId) REFERENCES equipment(id),
        FOREIGN KEY(userId) REFERENCES users(id),
        FOREIGN KEY(technicianId) REFERENCES users(id)
    )`, (err) => {
         if (err) console.error("Error creating repair_requests table", err);
    });
});

module.exports = db;
