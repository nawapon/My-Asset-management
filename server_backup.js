// server.js (Clean Version)

const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const db = require('./database.js');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


// Middleware for Authentication
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// ========== API ROUTES ==========

// --- Auth Routes ---
app.post('/api/register', (req, res) => {
    const { fullName, username, password } = req.body;
    if (!fullName || !username || !password) {
        return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบถ้วน" });
    }

    // Check if username already exists
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) return res.status(500).json({ message: "เกิดข้อผิดพลาดกับเซิร์ฟเวอร์" });
        if (user) return res.status(400).json({ message: "ชื่อผู้ใช้นี้มีคนใช้แล้ว" });
        
        // Hash password
        bcrypt.hash(password, 10, (err, hash) => {
            if (err) return res.status(500).json({ message: "เกิดข้อผิดพลาดในการเข้ารหัส" });
            
            const sql = 'INSERT INTO users (fullName, username, password, role) VALUES (?, ?, ?, ?)';
            db.run(sql, [fullName, username, hash, 'user'], function(err) {
                if (err) return res.status(500).json({ message: "ไม่สามารถสมัครสมาชิกได้" });
                res.status(201).json({ message: "สมัครสมาชิกสำเร็จ!", userId: this.lastID });
            });
        });
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const sql = 'SELECT * FROM users WHERE username = ?';
    db.get(sql, [username], (err, user) => {
        if (err || !user) {
            return res.status(401).json({ message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        }
        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (isMatch) {
                const token = jwt.sign({ id: user.id, username: user.username, role: user.role, fullName: user.fullName }, JWT_SECRET, { expiresIn: '8h' });
                res.json({ message: 'เข้าสู่ระบบสำเร็จ', token, user: { id: user.id, username: user.username, role: user.role, fullName: user.fullName } });
            } else {
                res.status(401).json({ message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
            }
        });
    });
});


// --- Repair Request Routes ---
app.get('/api/repairs', authenticateToken, (req, res) => {
    let sql = `
        SELECT 
            rr.id, 
            rr.problemDescription, 
            rr.requestDate, 
            rr.status,
            e.assetNumber,
            u.fullName as requestUser
        FROM repair_requests rr
        JOIN equipment e ON rr.equipmentId = e.id
        JOIN users u ON rr.userId = u.id
    `;
    const params = [];

    if (req.user.role === 'user') {
        sql += ' WHERE rr.userId = ?';
        params.push(req.user.id);
    }
    sql += ' ORDER BY rr.requestDate DESC';

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ message: "Server error" });
        res.json(rows);
    });
});

app.post('/api/repairs', authenticateToken, (req, res) => {
    const { assetNumber, problemDescription } = req.body;
    const userId = req.user.id;

    if (!assetNumber || !problemDescription) {
        return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบถ้วน" });
    }

    db.get('SELECT id FROM equipment WHERE assetNumber = ?', [assetNumber], (err, equipment) => {
        if (err) return res.status(500).json({ message: "Server error" });
        if (!equipment) return res.status(404).json({ message: "ไม่พบครุภัณฑ์หมายเลขนี้" });
        
        const equipmentId = equipment.id;
        const requestDate = new Date().toISOString();
        const sql = 'INSERT INTO repair_requests (equipmentId, userId, problemDescription, requestDate, status) VALUES (?, ?, ?, ?, ?)';
        
        db.run(sql, [equipmentId, userId, problemDescription, requestDate, 'Pending'], function(err) {
            if (err) return res.status(500).json({ message: "ไม่สามารถสร้างใบแจ้งซ่อมได้" });
            res.status(201).json({ message: "แจ้งซ่อมสำเร็จ!", repairId: this.lastID });
        });
    });
});

app.put('/api/repairs/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'technician') {
        return res.status(403).json({ message: "ไม่มีสิทธิ์ดำเนินการ" });
    }

    const { status } = req.body;
    const { id } = req.params;
    const sql = 'UPDATE repair_requests SET status = ? WHERE id = ?';
    
    db.run(sql, [status, id], function(err) {
        if (err) return res.status(500).json({ message: "อัปเดตสถานะไม่สำเร็จ" });
        if (this.changes === 0) return res.status(404).json({ message: "ไม่พบรายการที่ต้องการอัปเดต" });
        res.json({ message: "อัปเดตสถานะสำเร็จ" });
    });
});


// Serve the main page - MUST BE LAST anong API routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});