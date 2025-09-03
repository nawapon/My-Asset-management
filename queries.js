// queries.js
// This file centralizes all SQL queries for the application.

module.exports = {
    Auth: {
        GET_BY_USERNAME: `SELECT * FROM users WHERE username = ?`,
        INSERT_USER: `INSERT INTO users (fullName, username, password, role) VALUES (?, ?, ?, ?)`
    },
    Repairs: {
        GET_ALL_BASE: `
            SELECT 
                rr.id, rr.problemDescription, rr.requestDate, rr.status,
                rr.reporterLocation, rr.reporterContact,
                e.assetNumber,
                COALESCE(u.fullName, rr.reporterName, 'N/A') as requestUser
            FROM repair_requests rr
            JOIN equipment e ON rr.equipmentId = e.id
            LEFT JOIN users u ON rr.userId = u.id`,
        INSERT_PUBLIC: `
            INSERT INTO repair_requests 
            (equipmentId, reporterName, reporterLocation, reporterContact, problemDescription, requestDate, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
        INSERT_LOGGED_IN: `
            INSERT INTO repair_requests 
            (equipmentId, userId, reporterName, reporterLocation, reporterContact, problemDescription, requestDate, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        UPDATE_STATUS: `UPDATE repair_requests SET status = ? WHERE id = ?`
    },
    Equipment: {
        GET_DETAILS_BY_ASSET_NUMBER: `SELECT name, type, location, status FROM equipment WHERE assetNumber = ?`,
        GET_BY_ASSET_NUMBER: `SELECT id FROM equipment WHERE assetNumber = ?`,
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
        DELETE: `DELETE FROM equipment WHERE id = ?`
    },
    CSV: {
        IMPORT: `
            INSERT INTO equipment (assetNumber, name, type, location, status) 
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(assetNumber) DO UPDATE SET
                name=excluded.name,
                type=excluded.type,
                location=excluded.location,
                status=excluded.status;`,
        EXPORT: `SELECT * FROM equipment`
    },
    Users: {
        GET_ALL: `SELECT id, fullName, username, role FROM users ORDER BY id DESC`,
        UPDATE_ROLE: `UPDATE users SET role = ? WHERE id = ?`,
        DELETE: `DELETE FROM users WHERE id = ?`
    }
};

