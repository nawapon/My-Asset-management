// server.js (Corrected for MariaDB/mysql2 async/await syntax)

const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
const csv = require('fast-csv');
require('dotenv').config();

const db = require('./database.js'); // This is now the mysql2 pool
const queries = require('./queries.js');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware setup...
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
const uploadDir = 'tmp/csv';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

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

// ========== ASYNC/AWAIT WRAPPER for cleaner routes ==========
const asyncHandler = fn => (req, res, next) => {
    return Promise
        .resolve(fn(req, res, next))
        .catch(next);
};

// ========== ALL ROUTES ARE NOW ASYNC/AWAIT ==========

// --- Public Routes ---
app.get('/api/public/equipment/:assetNumber', asyncHandler(async (req, res) => {
    const { assetNumber } = req.params;
    const [rows] = await db.query(queries.Equipment.GET_DETAILS_BY_ASSET_NUMBER, [assetNumber]);
    if (rows.length > 0) {
        res.json(rows[0]);
    } else {
        res.status(404).json({ message: "ไม่พบครุภัณฑ์หมายเลขนี้" });
    }
}));

app.post('/api/public/repairs', asyncHandler(async (req, res) => {
    const { assetNumber, problemDescription, reporterName, reporterLocation, reporterContact } = req.body;
    if (!assetNumber || !problemDescription || !reporterName || !reporterLocation || !reporterContact) {
        return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบถ้วน" });
    }
    const [equipmentRows] = await db.query(queries.Equipment.GET_BY_ASSET_NUMBER, [assetNumber]);
    const equipment = equipmentRows[0];
    if (!equipment) return res.status(404).json({ message: "ไม่พบครุภัณฑ์หมายเลขนี้" });
    
    const params = [equipment.id, reporterName, reporterLocation, reporterContact, problemDescription, new Date(), 'Pending'];
    await db.query(queries.Repairs.INSERT_PUBLIC, params);
    res.status(201).json({ message: "แจ้งซ่อมสำเร็จ! เจ้าหน้าที่จะดำเนินการตรวจสอบต่อไป" });
}));


// --- Auth Routes ---
app.post('/api/login', asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    const [rows] = await db.query(queries.Auth.GET_BY_USERNAME, [username]);
    const user = rows[0];

    if (!user) {
        return res.status(401).json({ message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role, fullName: user.fullName }, JWT_SECRET, { expiresIn: '8h' });
        res.json({ message: 'เข้าสู่ระบบสำเร็จ', token, user: { id: user.id, username: user.username, role: user.role, fullName: user.fullName } });
    } else {
        res.status(401).json({ message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }
}));

app.post('/api/register', asyncHandler(async (req, res) => {
    const { fullName, username, password } = req.body;
    if (!fullName || !username || !password) {
        return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบถ้วน" });
    }

    const [existingUsers] = await db.query(queries.Auth.GET_BY_USERNAME, [username]);
    if (existingUsers.length > 0) {
        return res.status(400).json({ message: "ชื่อผู้ใช้นี้มีคนใช้แล้ว" });
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(queries.Auth.INSERT_USER, [fullName, username, hash, 'user']);
    res.status(201).json({ message: "สมัครสมาชิกสำเร็จ!", userId: result.insertId });
}));


// --- Repair Request Routes ---
app.get('/api/repairs', authenticateToken, asyncHandler(async (req, res) => {
    let sql = queries.Repairs.GET_ALL_BASE;
    const params = [];
    if (req.user.role === 'user') {
        sql += ' WHERE rr.userId = ?';
        params.push(req.user.id);
    }
    sql += ' ORDER BY rr.requestDate DESC';
    const [rows] = await db.query(sql, params);
    res.json(rows);
}));

app.get('/api/repairs/:id', authenticateToken, asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'technician') {
        return res.status(403).json({ message: "ไม่มีสิทธิ์ดำเนินการ" });
    }
    const [rows] = await db.query(queries.Repairs.GET_BY_ID, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: "ไม่พบรายการแจ้งซ่อม" });
    res.json(rows[0]);
}));

app.post('/api/repairs', authenticateToken, asyncHandler(async (req, res) => {
    // 1. Validate user from token
    if (!req.user || typeof req.user.id === 'undefined') {
        console.error('Authentication error: User ID not found in token payload.');
        return res.status(401).json({ message: "ข้อมูลผู้ใช้ไม่ถูกต้อง, กรุณาเข้าสู่ระบบใหม่อีกครั้ง" });
    }

    let connection;
    try {
        // 2. Validate request body
        const { assetNumber, problemDescription, reporterLocation, reporterContact } = req.body;
        if (!assetNumber || !problemDescription || !reporterLocation || !reporterContact) {
            return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบถ้วน" });
        }
        
        connection = await db.getConnection();

        // 3. Find equipment
        const [equipmentRows] = await connection.query(queries.Equipment.GET_BY_ASSET_NUMBER, [assetNumber]);
        const equipment = equipmentRows[0];
        if (!equipment) {
            return res.status(404).json({ message: `ไม่พบครุภัณฑ์หมายเลขนี้: ${assetNumber}` });
        }

        // 4. Determine reporter's name, ensuring it's not null.
        const reporterName = req.user.fullName || req.user.username;
        if (!reporterName) {
            console.error('Data inconsistency: reporterName is null or undefined for userId:', req.user.id);
            return res.status(500).json({ message: 'ข้อมูลผู้ใช้ไม่สมบูรณ์ ไม่สามารถระบุชื่อผู้แจ้งซ่อมได้' });
        }

        // 5. Prepare parameters for insertion
        const params = [
            equipment.id, 
            req.user.id, 
            reporterName, 
            reporterLocation, 
            reporterContact, 
            problemDescription, 
            new Date(), 
            'Pending'
        ];
        
        // 6. Execute insert query
        const [result] = await connection.query(queries.Repairs.INSERT_LOGGED_IN, params);
        
        // 7. Send success response
        res.status(201).json({ message: "แจ้งซ่อมสำเร็จ!", repairId: result.insertId });

    } catch (dbError) {
        console.error(`Database error in POST /api/repairs for user ${req.user.id}:`, dbError);
        res.status(500).json({ message: `เกิดข้อผิดพลาดบนเซิร์ฟเวอร์: ${dbError.message}` });
    } finally {
        if (connection) connection.release();
    }
}));


app.put('/api/repairs/:id', authenticateToken, asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'technician') {
        return res.status(403).json({ message: "ไม่มีสิทธิ์ดำเนินการ" });
    }
    const { status, solutionNotes } = req.body;
    const { id } = req.params;
    const now = new Date();

    let updateFields = ['status = ?'];
    const queryParams = [status];

    if (status === 'In Progress') {
        updateFields.push('acceptedDate = COALESCE(acceptedDate, ?)');
        queryParams.push(now);
    } else if (status === 'Completed') {
        updateFields.push('completedDate = ?');
        queryParams.push(now);
    }
    
    if (solutionNotes !== undefined) {
        updateFields.push('solutionNotes = ?');
        queryParams.push(solutionNotes);
    }

    const updateQuery = `UPDATE repair_requests SET ${updateFields.join(', ')} WHERE id = ?`;
    queryParams.push(id);
    
    const [result] = await db.query(updateQuery, queryParams);
    if (result.affectedRows === 0) return res.status(404).json({ message: "ไม่พบรายการที่ต้องการอัปเดต" });
    res.json({ message: "อัปเดตสถานะสำเร็จ" });
}));


// --- Equipment Routes ---
app.get('/api/equipment/summary', authenticateToken, asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "ไม่มีสิทธิ์ดำเนินการ" });
    }
    const [[totalResult]] = await db.query(queries.Equipment.GET_SUMMARY.total);
    const [statusResult] = await db.query(queries.Equipment.GET_SUMMARY.byStatus);
    const [typeResult] = await db.query(queries.Equipment.GET_SUMMARY.byType);
    const [[timeResult]] = await db.query(queries.Equipment.GET_SUMMARY.timeSummary);
    const [timeByTypeResult] = await db.query(queries.Equipment.GET_SUMMARY.timeByType);

    res.json({
        total: totalResult.count,
        byStatus: statusResult,
        byType: typeResult,
        timeSummary: timeResult,
        timeByType: timeByTypeResult
    });
}));

app.get('/api/equipment/details/:assetNumber', authenticateToken, asyncHandler(async (req, res) => {
    const { assetNumber } = req.params;
    const [rows] = await db.query(queries.Equipment.GET_DETAILS_BY_ASSET_NUMBER, [assetNumber]);
    res.json(rows.length > 0 ? rows[0] : null);
}));

app.get('/api/equipment/history/:assetNumber', authenticateToken, asyncHandler(async (req, res) => {
    const { assetNumber } = req.params;
    const [equipmentRows] = await db.query(queries.Equipment.GET_HISTORY_DETAILS, [assetNumber]);
    const equipment = equipmentRows[0];

    if (!equipment) return res.status(404).json({ message: "ไม่พบครุภัณฑ์หมายเลขนี้" });
    
    const [history] = await db.query(queries.Equipment.GET_HISTORY_REPAIRS, [equipment.id]);
    res.json({ details: equipment, history: history });
}));

app.get('/api/equipment', authenticateToken, asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page);
    const limit = parseInt(req.query.limit);
    const searchTerm = req.query.search || '';

    if (!page || !limit) {
        const [rows] = await db.query(queries.Equipment.GET_ALL_BASE + " ORDER BY id DESC");
        return res.json({ data: rows, pagination: { totalPages: 1 } });
    }

    const offset = (page - 1) * limit;
    let dataSql = queries.Equipment.GET_ALL_BASE;
    let countSql = queries.Equipment.COUNT_ALL_BASE;
    const params = [];
    const countParams = [];

    if (searchTerm) {
        const whereClause = " WHERE (LOWER(assetNumber) LIKE ? OR LOWER(name) LIKE ?)";
        dataSql += whereClause;
        countSql += whereClause;
        const likeTerm = `%${searchTerm.toLowerCase()}%`;
        params.push(likeTerm, likeTerm);
        countParams.push(likeTerm, likeTerm);
    }
    
    dataSql += " ORDER BY id DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [rows] = await db.query(dataSql, params);
    const [[countResult]] = await db.query(countSql, countParams);

    res.json({
        data: rows,
        pagination: { page, limit, totalItems: countResult.total, totalPages: Math.ceil(countResult.total / limit) }
    });
}));

app.post('/api/equipment', authenticateToken, asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: "ไม่มีสิทธิ์ดำเนินการ" });
    const { assetNumber, name, type, location, status } = req.body;
    if (!assetNumber || !name) return res.status(400).json({ message: "กรุณากรอกเลขครุภัณฑ์และชื่ออุปกรณ์" });
    
    const params = [assetNumber, name, type, location, status || 'Normal'];
    const [result] = await db.query(queries.Equipment.INSERT, params);
    res.status(201).json({ id: result.insertId, ...req.body });
}));

app.put('/api/equipment/:id', authenticateToken, asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: "ไม่มีสิทธิ์ดำเนินการ" });
    const { assetNumber, name, type, location, status } = req.body;
    const { id } = req.params;
    const params = [assetNumber, name, type, location, status, id];
    const [result] = await db.query(queries.Equipment.UPDATE, params);
    res.json({ message: "อัปเดตข้อมูลสำเร็จ", changes: result.affectedRows });
}));

app.delete('/api/equipment/:id', authenticateToken, asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: "ไม่มีสิทธิ์ดำเนินการ" });
    const [result] = await db.query(queries.Equipment.DELETE, req.params.id);
    res.json({ message: "ลบข้อมูลสำเร็จ", changes: result.affectedRows });
}));

// --- CSV Import/Export Routes ---
app.post('/api/equipment/import', authenticateToken, upload.single('csvFile'), (req, res) => {
    const filePath = req.file.path;
    const promises = [];
    fs.createReadStream(filePath)
        .pipe(csv.parse({ headers: true, bom: true })) // Added bom: true for UTF-8 with BOM
        .on('error', error => {
            console.error(error);
            // Cleanup the uploaded file
            fs.unlinkSync(filePath);
            res.status(500).json({ message: 'Error processing CSV file.' });
        })
        .on('data', row => {
            const params = [
                row['เลขครุภัณฑ์'] || row.assetNumber,
                row['ชื่ออุปกรณ์'] || row.name,
                row['ประเภท'] || row.type,
                row['สถานที่'] || row.location,
                row['สถานะ'] || row.status || 'Normal'
            ];
            // Only push the promise if assetNumber is valid
            if (params[0]) {
                 promises.push(db.query(queries.CSV.IMPORT, params));
            }
        })
        .on('end', rowCount => {
            Promise.all(promises)
                .then(() => {
                    fs.unlinkSync(filePath); // Cleanup the uploaded file
                    res.json({ message: `นำเข้าข้อมูล ${promises.length} รายการสำเร็จ!` });
                })
                .catch(err => {
                    console.error('Import Error:', err);
                    fs.unlinkSync(filePath); // Cleanup the uploaded file
                    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูลลงฐานข้อมูล' });
                });
        });
});

app.get('/api/equipment/export', authenticateToken, asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: "ไม่มีสิทธิ์ดำเนินการ" });
    const [data] = await db.query(queries.CSV.EXPORT);
    const filename = `equipment-export-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    // Add BOM for better Excel compatibility with UTF-8
    res.write('\uFEFF'); 
    csv.write(data, { headers: true }).pipe(res);
}));

// --- User Management Routes ---
app.get('/api/users', authenticateToken, asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: "ไม่มีสิทธิ์ดำเนินการ" });
    const [rows] = await db.query(queries.Users.GET_ALL);
    res.json(rows);
}));

app.post('/api/users', authenticateToken, asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "ไม่มีสิทธิ์ดำเนินการ" });
    }
    const { fullName, username, password, role } = req.body;
    if (!fullName || !username || !password || !role || !['user', 'technician', 'admin'].includes(role)) {
        return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง" });
    }
    const [existingUsers] = await db.query(queries.Auth.GET_BY_USERNAME, [username]);
    if (existingUsers.length > 0) {
        return res.status(400).json({ message: "ชื่อผู้ใช้นี้มีคนใช้แล้ว" });
    }
    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(queries.Auth.INSERT_USER, [fullName, username, hash, role]);
    res.status(201).json({ message: "สร้างผู้ใช้สำเร็จ!", userId: result.insertId });
}));

app.put('/api/users/:id', authenticateToken, asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "ไม่มีสิทธิ์ดำเนินการ" });
    }
    const { id } = req.params;
    const { fullName, username, role, password } = req.body;

    if (!fullName || !username || !role || !['user', 'technician', 'admin'].includes(role)) {
        return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง: กรุณากรอกชื่อ, ชื่อผู้ใช้, และบทบาทให้ครบถ้วน" });
    }

    if (Number(id) === req.user.id && role !== 'admin') {
        return res.status(400).json({ message: "ไม่สามารถลดระดับบทบาทของตนเองได้" });
    }
    
    const [existingUsers] = await db.query(queries.Users.CHECK_USERNAME_EXISTS, [username, id]);
    if (existingUsers.length > 0) {
        return res.status(409).json({ message: "ชื่อผู้ใช้นี้มีคนใช้แล้ว" });
    }

    if (password && password.length > 0) {
        const hash = await bcrypt.hash(password, 10);
        const [result] = await db.query(queries.Users.UPDATE_WITH_PASSWORD, [fullName, username, role, hash, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "ไม่พบผู้ใช้งานที่ต้องการอัปเดต" });
        }
        res.json({ message: "อัปเดตข้อมูลผู้ใช้สำเร็จ" });
    } else {
        const [result] = await db.query(queries.Users.UPDATE_WITHOUT_PASSWORD, [fullName, username, role, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "ไม่พบผู้ใช้งานที่ต้องการอัปเดต" });
        }
        res.json({ message: "อัปเดตข้อมูลผู้ใช้สำเร็จ" });
    }
}));


app.delete('/api/users/:id', authenticateToken, asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: "ไม่มีสิทธิ์ดำเนินการ" });
    if (Number(req.params.id) === req.user.id) return res.status(400).json({ message: "ไม่สามารถลบบัญชีของตนเองได้" });
    
    const [result] = await db.query(queries.Users.DELETE, req.params.id);
    res.json({ message: "ลบผู้ใช้งานสำเร็จ", changes: result.affectedRows });
}));

// --- Catch-All Route ---
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error("GLOBAL ERROR HANDLER:", err);
    res.status(500).json({message: "เกิดข้อผิดพลาดบางอย่างในเซิร์ฟเวอร์"});
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

