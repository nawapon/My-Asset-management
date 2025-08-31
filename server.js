// server.js (Final Complete Version)

const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
const csv = require('fast-csv');
require('dotenv').config();

const db = require('./database.js');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

// สร้างโฟลเดอร์ tmp/csv หากยังไม่มี
const uploadDir = 'tmp/csv';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


// Middleware for Authentication
function authenticateToken(req, res, next) {
    let token;
    const authHeader = req.headers['authorization'];
    if (authHeader) token = authHeader.split(' ')[1];
    if (!token && req.query.token) token = req.query.token;
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
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) return res.status(500).json({ message: "เกิดข้อผิดพลาดกับเซิร์ฟเวอร์" });
        if (user) return res.status(400).json({ message: "ชื่อผู้ใช้นี้มีคนใช้แล้ว" });
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

// --- Equipment Routes (with Search & Pagination) ---
app.get('/api/equipment', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "ไม่มีสิทธิ์ดำเนินการ" });
    }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const offset = (page - 1) * limit;
    const searchTerm = req.query.search || '';

    let dataSql = "SELECT * FROM equipment";
    let countSql = "SELECT COUNT(*) as total FROM equipment";
    const params = [];

    if (searchTerm) {
        const whereClause = " WHERE (LOWER(assetNumber) LIKE ? OR LOWER(name) LIKE ?)";
        dataSql += whereClause;
        countSql += whereClause;
        const likeTerm = `%${searchTerm.toLowerCase()}%`;
        params.push(likeTerm, likeTerm);
    }
    
    dataSql += " ORDER BY id DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    db.all(dataSql, params, (err, rows) => {
        if (err) return res.status(500).json({ "error": err.message });
        const countParams = searchTerm ? [`%${searchTerm.toLowerCase()}%`, `%${searchTerm.toLowerCase()}%`] : [];
        db.get(countSql, countParams, (err, countResult) => {
            if (err) return res.status(500).json({ "error": err.message });
            const totalItems = countResult.total;
            const totalPages = Math.ceil(totalItems / limit);
            res.json({
                data: rows,
                pagination: { page, limit, totalItems, totalPages }
            });
        });
    });
});

app.post('/api/equipment', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: "ไม่มีสิทธิ์ดำเนินการ" });
    const { assetNumber, name, type, location, status } = req.body;
    if (!assetNumber || !name) return res.status(400).json({ message: "กรุณากรอกเลขครุภัณฑ์และชื่ออุปกรณ์" });
    const sql = 'INSERT INTO equipment (assetNumber, name, type, location, status) VALUES (?, ?, ?, ?, ?)';
    db.run(sql, [assetNumber, name, type, location, status || 'Normal'], function(err) {
        if (err) return res.status(500).json({ message: "ไม่สามารถเพิ่มข้อมูลได้ อาจมีเลขครุภัณฑ์ซ้ำ" });
        res.status(201).json({ id: this.lastID, ...req.body });
    });
});

app.put('/api/equipment/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: "ไม่มีสิทธิ์ดำเนินการ" });
    const { assetNumber, name, type, location, status } = req.body;
    const { id } = req.params;
    const sql = 'UPDATE equipment SET assetNumber = ?, name = ?, type = ?, location = ?, status = ? WHERE id = ?';
    db.run(sql, [assetNumber, name, type, location, status, id], function(err) {
        if (err) return res.status(500).json({ message: "ไม่สามารถอัปเดตข้อมูลได้" });
        res.json({ message: "อัปเดตข้อมูลสำเร็จ", changes: this.changes });
    });
});

app.delete('/api/equipment/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: "ไม่มีสิทธิ์ดำเนินการ" });
    const { id } = req.params;
    const sql = 'DELETE FROM equipment WHERE id = ?';
    db.run(sql, id, function(err) {
        if (err) return res.status(500).json({ message: "ไม่สามารถลบข้อมูลได้" });
        res.json({ message: "ลบข้อมูลสำเร็จ", changes: this.changes });
    });
});

// --- CSV Import/Export Routes ---
app.post('/api/equipment/import', authenticateToken, upload.single('csvFile'), (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: "ไม่มีสิทธิ์ดำเนินการ" });
    if (!req.file) return res.status(400).json({ message: "No file uploaded." });
    
    const filePath = req.file.path;
    let equipmentData = [];
    fs.createReadStream(filePath)
        .pipe(csv.parse({ headers: true }))
        .on('error', error => {
            fs.unlinkSync(filePath);
            res.status(500).json({ message: "Error parsing CSV file." });
        })
        .on('data', row => equipmentData.push(row))
        .on('end', () => {
            fs.unlinkSync(filePath);
            if (equipmentData.length === 0) return res.status(400).json({ message: "CSV file is empty or invalid." });
            
            const sql = `INSERT INTO equipment (assetNumber, name, type, location, status) VALUES (?, ?, ?, ?, ?)
                         ON CONFLICT(assetNumber) DO UPDATE SET name=excluded.name, type=excluded.type, location=excluded.location, status=excluded.status;`;
            db.serialize(() => {
                const stmt = db.prepare(sql);
                equipmentData.forEach(item => {
                    stmt.run(item.assetNumber, item.name, item.type, item.location, item.status || 'Normal');
                });
                stmt.finalize(err => {
                    if (err) return res.status(500).json({ message: "Failed to import data to database." });
                    res.json({ message: `Successfully imported/updated ${equipmentData.length} items.` });
                });
            });
        });
});

app.get('/api/equipment/export', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: "ไม่มีสิทธิ์ดำเนินการ" });
    const sql = "SELECT * FROM equipment";
    db.all(sql, [], (err, data) => {
        if (err) return res.status(500).json({ message: "Failed to fetch data for export." });
        const filename = `equipment-export-${new Date().toISOString().slice(0, 10)}.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        csv.write(data, { headers: true }).pipe(res);
    });
});

// --- User Management Routes ---
app.get('/api/users', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: "ไม่มีสิทธิ์ดำเนินการ" });
    const sql = "SELECT id, fullName, username, role FROM users ORDER BY id DESC";
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ "error": err.message });
        res.json(rows);
    });
});

app.put('/api/users/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: "ไม่มีสิทธิ์ดำเนินการ" });
    const { role } = req.body;
    const { id } = req.params;
    if (Number(id) === req.user.id) return res.status(400).json({ message: "ไม่สามารถเปลี่ยนบทบาทของตนเองได้" });
    if (!['user', 'technician', 'admin'].includes(role)) return res.status(400).json({ message: "บทบาทไม่ถูกต้อง" });
    const sql = 'UPDATE users SET role = ? WHERE id = ?';
    db.run(sql, [role, id], function(err) {
        if (err) return res.status(500).json({ message: "ไม่สามารถอัปเดตข้อมูลได้" });
        res.json({ message: "อัปเดตบทบาทสำเร็จ" });
    });
});

app.delete('/api/users/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: "ไม่มีสิทธิ์ดำเนินการ" });
    const { id } = req.params;
    if (Number(id) === req.user.id) return res.status(400).json({ message: "ไม่สามารถลบบัญชีของตนเองได้" });
    const sql = 'DELETE FROM users WHERE id = ?';
    db.run(sql, id, function(err) {
        if (err) return res.status(500).json({ message: "ไม่สามารถลบข้อมูลได้" });
        res.json({ message: "ลบผู้ใช้งานสำเร็จ" });
    });
});

// --- Catch-All Route (Using Regex to avoid parsing issues) ---
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
