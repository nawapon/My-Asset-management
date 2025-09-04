// server.js (Final Complete Version with Time Tracking)

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
const queries = require('./queries.js');

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

// ========== PUBLIC API ROUTES (NO TOKEN NEEDED) ==========
app.get('/api/public/equipment/:assetNumber', (req, res) => {
    const { assetNumber } = req.params;
    db.get(queries.Equipment.GET_DETAILS_BY_ASSET_NUMBER, [assetNumber], (err, row) => {
        if (err) return res.status(500).json({ "error": err.message });
        if (row) res.json(row);
        else res.status(404).json({ message: "ไม่พบครุภัณฑ์หมายเลขนี้" });
    });
});

app.post('/api/public/repairs', (req, res) => {
    const { assetNumber, problemDescription, reporterName, reporterLocation, reporterContact } = req.body;
    if (!assetNumber || !problemDescription || !reporterName || !reporterLocation || !reporterContact) {
        return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบถ้วน" });
    }
    db.get(queries.Equipment.GET_BY_ASSET_NUMBER, [assetNumber], (err, equipment) => {
        if (err) return res.status(500).json({ message: "Server error" });
        if (!equipment) return res.status(404).json({ message: "ไม่พบครุภัณฑ์หมายเลขนี้" });
        
        const params = [equipment.id, reporterName, reporterLocation, reporterContact, problemDescription, new Date().toISOString(), 'Pending'];
        db.run(queries.Repairs.INSERT_PUBLIC, params, function(err) {
            if (err) return res.status(500).json({ message: "ไม่สามารถสร้างใบแจ้งซ่อมได้" });
            res.status(201).json({ message: "แจ้งซ่อมสำเร็จ! เจ้าหน้าที่จะดำเนินการตรวจสอบต่อไป" });
        });
    });
});

// ========== AUTHENTICATED API ROUTES ==========

// --- Auth Routes ---
app.post('/api/register', (req, res) => {
    const { fullName, username, password } = req.body;
    if (!fullName || !username || !password) return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบถ้วน" });
    db.get(queries.Auth.GET_BY_USERNAME, [username], (err, user) => {
        if (err) return res.status(500).json({ message: "เกิดข้อผิดพลาดกับเซิร์ฟเวอร์" });
        if (user) return res.status(400).json({ message: "ชื่อผู้ใช้นี้มีคนใช้แล้ว" });
        bcrypt.hash(password, 10, (err, hash) => {
            if (err) return res.status(500).json({ message: "เกิดข้อผิดพลาดในการเข้ารหัส" });
            db.run(queries.Auth.INSERT_USER, [fullName, username, hash, 'user'], function(err) {
                if (err) return res.status(500).json({ message: "ไม่สามารถสมัครสมาชิกได้" });
                res.status(201).json({ message: "สมัครสมาชิกสำเร็จ!", userId: this.lastID });
            });
        });
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get(queries.Auth.GET_BY_USERNAME, [username], (err, user) => {
        if (err || !user) return res.status(401).json({ message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
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
    let sql = queries.Repairs.GET_ALL_BASE;
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
    const { assetNumber, problemDescription, reporterLocation, reporterContact } = req.body;
    if (!assetNumber || !problemDescription || !reporterLocation || !reporterContact) return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบถ้วน" });
    db.get(queries.Equipment.GET_BY_ASSET_NUMBER, [assetNumber], (err, equipment) => {
        if (err) return res.status(500).json({ message: "Server error" });
        if (!equipment) return res.status(404).json({ message: "ไม่พบครุภัณฑ์หมายเลขนี้" });
        const params = [equipment.id, req.user.id, req.user.fullName, reporterLocation, reporterContact, problemDescription, new Date().toISOString(), 'Pending'];
        db.run(queries.Repairs.INSERT_LOGGED_IN, params, function(err) {
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
    const now = new Date().toISOString();
    let updateQuery = 'UPDATE repair_requests SET status = ?';
    const queryParams = [status];
    if (status === 'In Progress') {
        updateQuery += ', acceptedDate = COALESCE(acceptedDate, ?)';
        queryParams.push(now);
    } else if (status === 'Completed') {
        updateQuery += ', completedDate = ?';
        queryParams.push(now);
    }
    updateQuery += ' WHERE id = ?';
    queryParams.push(id);
    db.run(updateQuery, queryParams, function(err) {
        if (err) return res.status(500).json({ message: "อัปเดตสถานะไม่สำเร็จ" });
        if (this.changes === 0) return res.status(404).json({ message: "ไม่พบรายการที่ต้องการอัปเดต" });
        res.json({ message: "อัปเดตสถานะสำเร็จ" });
    });
});


// --- Equipment Routes ---
app.get('/api/equipment/summary', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "ไม่มีสิทธิ์ดำเนินการ" });
    }
    Promise.all([
        new Promise((resolve, reject) => db.get(queries.Equipment.GET_SUMMARY.total, [], (err, row) => err ? reject(err) : resolve(row))),
        new Promise((resolve, reject) => db.all(queries.Equipment.GET_SUMMARY.byStatus, [], (err, rows) => err ? reject(err) : resolve(rows))),
        new Promise((resolve, reject) => db.all(queries.Equipment.GET_SUMMARY.byType, [], (err, rows) => err ? reject(err) : resolve(rows)))
    ]).then(([totalResult, statusResult, typeResult]) => {
        res.json({ total: totalResult.count, byStatus: statusResult, byType: typeResult });
    }).catch(err => res.status(500).json({ message: "Failed to retrieve summary data.", error: err.message }));
});


app.get('/api/equipment/history/:assetNumber', authenticateToken, (req, res) => {
    const { assetNumber } = req.params;
    db.get(queries.Equipment.GET_HISTORY_DETAILS, [assetNumber], (err, equipment) => {
        if (err) return res.status(500).json({ "error": err.message });
        if (!equipment) return res.status(404).json({ message: "ไม่พบครุภัณฑ์หมายเลขนี้" });
        db.all(queries.Equipment.GET_HISTORY_REPAIRS, [equipment.id], (err, history) => {
            if (err) return res.status(500).json({ "error": err.message });
            res.json({ details: equipment, history: history });
        });
    });
});

app.get('/api/equipment', authenticateToken, (req, res) => {
    const page = parseInt(req.query.page);
    const limit = parseInt(req.query.limit);
    const searchTerm = req.query.search || '';

    if (!page || !limit) {
        db.all(queries.Equipment.GET_ALL_BASE + " ORDER BY id DESC", [], (err, rows) => {
            if (err) return res.status(500).json({ "error": err.message });
            res.json({ data: rows, pagination: { totalPages: 1 } });
        });
        return;
    }

    const offset = (page - 1) * limit;
    let dataSql = queries.Equipment.GET_ALL_BASE;
    let countSql = queries.Equipment.COUNT_ALL_BASE;
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
            res.json({
                data: rows,
                pagination: { page, limit, totalItems: countResult.total, totalPages: Math.ceil(countResult.total / limit) }
            });
        });
    });
});

app.post('/api/equipment', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: "ไม่มีสิทธิ์ดำเนินการ" });
    const { assetNumber, name, type, location, status } = req.body;
    if (!assetNumber || !name) return res.status(400).json({ message: "กรุณากรอกเลขครุภัณฑ์และชื่ออุปกรณ์" });
    const params = [assetNumber, name, type, location, status || 'Normal'];
    db.run(queries.Equipment.INSERT, params, function(err) {
        if (err) return res.status(500).json({ message: "ไม่สามารถเพิ่มข้อมูลได้ อาจมีเลขครุภัณฑ์ซ้ำ" });
        res.status(201).json({ id: this.lastID, ...req.body });
    });
});

app.put('/api/equipment/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: "ไม่มีสิทธิ์ดำเนินการ" });
    const { assetNumber, name, type, location, status } = req.body;
    const { id } = req.params;
    const params = [assetNumber, name, type, location, status, id];
    db.run(queries.Equipment.UPDATE, params, function(err) {
        if (err) return res.status(500).json({ message: "ไม่สามารถอัปเดตข้อมูลได้" });
        res.json({ message: "อัปเดตข้อมูลสำเร็จ", changes: this.changes });
    });
});

app.delete('/api/equipment/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: "ไม่มีสิทธิ์ดำเนินการ" });
    db.run(queries.Equipment.DELETE, req.params.id, function(err) {
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
        .on('error', error => { fs.unlinkSync(filePath); res.status(500).json({ message: "Error parsing CSV file." }); })
        .on('data', row => equipmentData.push(row))
        .on('end', () => {
            fs.unlinkSync(filePath);
            if (equipmentData.length === 0) return res.status(400).json({ message: "CSV file is empty." });
            db.serialize(() => {
                const stmt = db.prepare(queries.CSV.IMPORT);
                equipmentData.forEach(item => stmt.run(item.assetNumber, item.name, item.type, item.location, item.status || 'Normal'));
                stmt.finalize(err => {
                    if (err) return res.status(500).json({ message: "Failed to import data." });
                    res.json({ message: `Successfully imported/updated ${equipmentData.length} items.` });
                });
            });
        });
});

app.get('/api/equipment/export', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: "ไม่มีสิทธิ์ดำเนินการ" });
    db.all(queries.CSV.EXPORT, [], (err, data) => {
        if (err) return res.status(500).json({ message: "Failed to export data." });
        const filename = `equipment-export-${new Date().toISOString().slice(0, 10)}.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        csv.write(data, { headers: true }).pipe(res);
    });
});

// --- User Management Routes ---
app.get('/api/users', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: "ไม่มีสิทธิ์ดำเนินการ" });
    db.all(queries.Users.GET_ALL, [], (err, rows) => {
        if (err) return res.status(500).json({ "error": err.message });
        res.json(rows);
    });
});

app.post('/api/users', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "ไม่มีสิทธิ์ดำเนินการ" });
    }
    const { fullName, username, password, role } = req.body;
    if (!fullName || !username || !password || !role) {
        return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบถ้วน" });
    }
     if (!['user', 'technician', 'admin'].includes(role)) {
        return res.status(400).json({ message: "บทบาทไม่ถูกต้อง" });
    }
    db.get(queries.Auth.GET_BY_USERNAME, [username], (err, user) => {
        if (err) return res.status(500).json({ message: "เกิดข้อผิดพลาดกับเซิร์ฟเวอร์" });
        if (user) return res.status(400).json({ message: "ชื่อผู้ใช้นี้มีคนใช้แล้ว" });
        
        bcrypt.hash(password, 10, (err, hash) => {
            if (err) return res.status(500).json({ message: "เกิดข้อผิดพลาดในการเข้ารหัส" });
            db.run(queries.Auth.INSERT_USER, [fullName, username, hash, role], function(err) {
                if (err) return res.status(500).json({ message: "ไม่สามารถสร้างผู้ใช้ได้" });
                res.status(201).json({ message: "สร้างผู้ใช้สำเร็จ!", userId: this.lastID });
            });
        });
    });
});

app.put('/api/users/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: "ไม่มีสิทธิ์ดำเนินการ" });
    const { role } = req.body;
    const { id } = req.params;
    if (Number(id) === req.user.id) return res.status(400).json({ message: "ไม่สามารถเปลี่ยนบทบาทของตนเองได้" });
    if (!['user', 'technician', 'admin'].includes(role)) return res.status(400).json({ message: "บทบาทไม่ถูกต้อง" });
    db.run(queries.Users.UPDATE_ROLE, [role, id], function(err) {
        if (err) return res.status(500).json({ message: "ไม่สามารถอัปเดตข้อมูลได้" });
        res.json({ message: "อัปเดตบทบาทสำเร็จ" });
    });
});

app.delete('/api/users/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: "ไม่มีสิทธิ์ดำเนินการ" });
    if (Number(req.params.id) === req.user.id) return res.status(400).json({ message: "ไม่สามารถลบบัญชีของตนเองได้" });
    db.run(queries.Users.DELETE, req.params.id, function(err) {
        if (err) return res.status(500).json({ message: "ไม่สามารถลบข้อมูลได้" });
        res.json({ message: "ลบผู้ใช้งานสำเร็จ" });
    });
});

// --- Catch-All Route ---
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

