// database.js (MariaDB/MySQL Connection with Password Reset Table)

const mysql = require('mysql2');
require('dotenv').config();

// สร้าง connection pool ซึ่งมีประสิทธิภาพดีกว่าการสร้าง connection ทุกครั้ง
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'asset_management',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// สร้างตารางต่างๆ หากยังไม่มี
const initialSetup = async () => {
    let connection;
    try {
        connection = await pool.promise().getConnection();
        console.log('Connected to the MariaDB database.');

        // ใช้ utf8mb4 เพื่อรองรับภาษาไทย
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                fullName VARCHAR(255),
                role VARCHAR(50) NOT NULL DEFAULT 'user'
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS equipment (
                id INT AUTO_INCREMENT PRIMARY KEY,
                assetNumber VARCHAR(255) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                type VARCHAR(255),
                location VARCHAR(255),
                status VARCHAR(50) DEFAULT 'Normal'
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS repair_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                equipmentId INT NOT NULL,
                userId INT,
                reporterName VARCHAR(255),
                reporterLocation VARCHAR(255),
                reporterContact VARCHAR(255),
                problemDescription TEXT,
                imagePath VARCHAR(255),
                requestDate DATETIME,
                acceptedDate DATETIME,
                completedDate DATETIME,
                status VARCHAR(50) DEFAULT 'Pending',
                technicianId INT,
                solutionNotes TEXT,
                FOREIGN KEY (equipmentId) REFERENCES equipment(id) ON DELETE CASCADE,
                FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        
        console.log('Tables are ready.');

    } catch (err) {
        console.error('Error during initial setup:', err);
    } finally {
        if (connection) connection.release();
    }
};

initialSetup();

module.exports = pool.promise();

