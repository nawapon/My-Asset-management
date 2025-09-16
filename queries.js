// queries.js
// Centralized SQL queries, adapted for MariaDB/MySQL.

module.exports = {
    Auth: {
        GET_BY_USERNAME: `SELECT * FROM users WHERE username = ?`,
        INSERT_USER: `INSERT INTO users (fullName, username, password, role) VALUES (?, ?, ?, ?)`
    },
    Repairs: {
        GET_ALL_BASE: `
            SELECT 
                rr.id, rr.problemDescription, rr.requestDate, rr.status,
                rr.reporterLocation, rr.reporterContact, rr.acceptedDate, rr.completedDate,
                e.assetNumber,
                COALESCE(u.fullName, rr.reporterName, 'N/A') as requestUser
            FROM repair_requests rr
            JOIN equipment e ON rr.equipmentId = e.id
            LEFT JOIN users u ON rr.userId = u.id`,
        GET_BY_ID: `
            SELECT 
                rr.id, rr.problemDescription, rr.requestDate, rr.status,
                rr.reporterLocation, rr.reporterContact, rr.acceptedDate, rr.completedDate,
                rr.solutionNotes, e.assetNumber,
                COALESCE(u.fullName, rr.reporterName, 'N/A') as requestUser
            FROM repair_requests rr
            JOIN equipment e ON rr.equipmentId = e.id
            LEFT JOIN users u ON rr.userId = u.id
            WHERE rr.id = ?`,
        INSERT_PUBLIC: `
            INSERT INTO repair_requests 
            (equipmentId, reporterName, reporterLocation, reporterContact, problemDescription, requestDate, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
        INSERT_LOGGED_IN: `
            INSERT INTO repair_requests 
            (equipmentId, userId, reporterName, reporterLocation, reporterContact, problemDescription, requestDate, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        DELETE: `DELETE FROM repair_requests WHERE id = ?`
    },
    Equipment: {
        GET_DETAILS_BY_ASSET_NUMBER: `SELECT name, type, location, status FROM equipment WHERE assetNumber = ?`,
        GET_BY_ASSET_NUMBER: `SELECT id, name FROM equipment WHERE assetNumber = ?`,
        GET_HISTORY_DETAILS: `SELECT * FROM equipment WHERE assetNumber = ?`,
        GET_HISTORY_REPAIRS: `
            SELECT rr.*, COALESCE(u.fullName, rr.reporterName, 'N/A') as requestUser 
            FROM repair_requests rr 
            LEFT JOIN users u ON rr.userId = u.id
            WHERE rr.equipmentId = ? 
            ORDER BY rr.requestDate DESC`,
        GET_ALL_BASE: `SELECT * FROM equipment`,
        COUNT_ALL_BASE: `SELECT COUNT(*) as total FROM equipment`,
        INSERT: `INSERT INTO equipment (assetNumber, name, type, location, status) VALUES (?, ?, ?, ?, ?)`,
        UPDATE: `UPDATE equipment SET assetNumber = ?, name = ?, type = ?, location = ?, status = ? WHERE id = ?`,
        DELETE: `DELETE FROM equipment WHERE id = ?`,
        GET_SUMMARY: {
            total: "SELECT COUNT(*) as count FROM equipment",
            byStatus: "SELECT status, COUNT(*) as count FROM equipment GROUP BY status",
            byType: "SELECT type, COUNT(*) as count FROM equipment WHERE type IS NOT NULL AND type != '' GROUP BY type ORDER BY count DESC",
            timeSummary: `
                SELECT 
                    AVG(TIMESTAMPDIFF(SECOND, requestDate, acceptedDate)) as avgResponseSeconds,
                    AVG(TIMESTAMPDIFF(SECOND, acceptedDate, completedDate)) as avgResolutionSeconds
                FROM repair_requests 
                WHERE status = 'Completed' AND acceptedDate IS NOT NULL AND completedDate IS NOT NULL`,
            timeByType: `
                SELECT 
                    e.type, 
                    AVG(TIMESTAMPDIFF(SECOND, rr.acceptedDate, rr.completedDate)) as avgResolutionSeconds
                FROM repair_requests rr
                JOIN equipment e ON rr.equipmentId = e.id
                WHERE rr.status = 'Completed' AND rr.acceptedDate IS NOT NULL AND rr.completedDate IS NOT NULL AND e.type IS NOT NULL AND e.type != ''
                GROUP BY e.type
                ORDER BY avgResolutionSeconds DESC
                LIMIT 5`
        }
    },
    CSV: {
        IMPORT: `
            INSERT INTO equipment (assetNumber, name, type, location, status) 
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                name=VALUES(name),
                type=VALUES(type),
                location=VALUES(location),
                status=VALUES(status);`,
        EXPORT: `SELECT * FROM equipment`
    },
    Users: {
        GET_ALL: `SELECT id, fullName, username, role FROM users ORDER BY id DESC`,
        GET_BY_ID: `SELECT id, fullName, username, role FROM users WHERE id = ?`,
        UPDATE_WITHOUT_PASSWORD: `UPDATE users SET fullName = ?, username = ?, role = ? WHERE id = ?`,
        UPDATE_WITH_PASSWORD: `UPDATE users SET fullName = ?, username = ?, role = ?, password = ? WHERE id = ?`,
        DELETE: `DELETE FROM users WHERE id = ?`,
        CHECK_USERNAME_EXISTS: `SELECT id FROM users WHERE username = ? AND id != ?`
    },
    PasswordResets: {
        INSERT_REQUEST: `INSERT INTO password_resets (userId, requestDate, status) VALUES (?, ?, 'pending')`,
        GET_PENDING_REQUESTS: `
            SELECT pr.id, pr.requestDate, u.id as userId, u.username 
            FROM password_resets pr
            JOIN users u ON pr.userId = u.id
            WHERE pr.status = 'pending'
            ORDER BY pr.requestDate ASC`,
        UPDATE_REQUEST_STATUS: `UPDATE password_resets SET status = ? WHERE userId = ? AND status = 'pending'`,
        DELETE_COMPLETED: `DELETE FROM password_resets WHERE status = 'completed'`
    }
};

