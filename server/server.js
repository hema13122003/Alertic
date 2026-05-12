const express = require('express');
const cors = require('cors');
require('dotenv').config();
const formattedResponse = require('./utils/responseFormatter');
const db = require('./db');
const multer = require('multer');
const xlsx = require('xlsx');

const upload = multer({ storage: multer.memoryStorage() });

const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});
const cron = require('node-cron');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'alertic_secret_key_2024';

app.use(cors());
app.use(express.json());

// Socket.io connection handling
let activeSessions = new Map(); // id -> socket_id

io.on('connection', (socket) => {
  console.log('Terminal connected:', socket.id);
  
  socket.on('register', (userId) => {
    activeSessions.set(parseInt(userId), socket.id);
    console.log(`User ${userId} registered to session ${socket.id}`);
  });

  socket.on('join-group', (groupId) => {
    if (groupId) {
      socket.join(`group_${groupId}`);
      console.log(`Sector locked: ${socket.id} joined group_${groupId}`);
    }
  });

  socket.on('disconnect', () => {
    for (let [id, socketId] of activeSessions.entries()) {
      if (socketId === socket.id) {
        activeSessions.delete(id);
        break;
      }
    }
    console.log('Terminal disconnected:', socket.id);
  });
});

// Helper to handle empty strings for unique database columns
const emptyStringToNull = (val) => (val === undefined || val === null || val.toString().trim() === '') ? null : val;

// Helper to ensure bind parameters are not undefined
const paramsOrNull = (arr) => arr.map(v => v === undefined ? null : v);

const PORT = process.env.PORT || 5000;

// PERIOD CONFIGURATION (Synced with Frontend)
const PERIOD_TIMES = {
  1: { start: '09:00', end: '09:50' },
  2: { start: '09:50', end: '10:40' },
  3: { start: '10:55', end: '11:45' },
  4: { start: '11:45', end: '12:35' },
  5: { start: '13:15', end: '14:05' },
  6: { start: '14:05', end: '14:55' },
  7: { start: '15:10', end: '16:00' },
  8: { start: '16:00', end: '16:50' }
};

const DAY_MAP = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Ensuring the triggers table exists
const initTriggersDb = async () => {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS notification_triggers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        faculty_id INT NOT NULL,
        day VARCHAR(20) NOT NULL,
        period_id INT NOT NULL,
        trigger_date DATE NOT NULL,
        status ENUM('pending', 'triggered', 'acknowledged') DEFAULT 'pending',
        UNIQUE KEY unique_trigger (faculty_id, trigger_date, period_id)
      )`);
    console.log("Notification Triggers table ready.");
  } catch (err) {
    console.error("Triggers table init error:", err);
  }
};
initTriggersDb();

cron.schedule('* * * * *', async () => {
  const now = new Date();
  const currentDay = DAY_MAP[now.getDay()];
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const currentTimeInMins = currentHour * 60 + currentMin;
  const triggerDate = now.toISOString().split('T')[0];

  try {
    const [rows] = await db.execute(`
      SELECT t.*, f.name as faculty_name 
      FROM timetable t
      JOIN faculties f ON t.faculty_id = f.id
      WHERE t.day = ?
    `, [currentDay]);

    for (const entry of rows) {
      const timeRange = PERIOD_TIMES[entry.period];
      if (!timeRange) continue;

      const [startH, startM] = timeRange.start.split(':').map(Number);
      const [endH, endM] = timeRange.end.split(':').map(Number);
      
      const startInMins = startH * 60 + startM;
      const endInMins = endH * 60 + endM;
      const diff = startInMins - currentTimeInMins;

      // 1. One-Time Trigger Window Check
      // We only trigger when the class is LIVE NOW or UPCOMING (within a small 2-minute window of the start)
      if (currentTimeInMins >= startInMins && currentTimeInMins < endInMins) {
         // Check if already triggered today for this period
         const [existing] = await db.execute(`
           SELECT * FROM notification_triggers 
           WHERE faculty_id = ? AND trigger_date = ? AND period_id = ?
         `, [entry.faculty_id, triggerDate, entry.period]);

         if (existing.length === 0) {
            // New Trigger!
            await db.execute(`
              INSERT INTO notification_triggers (faculty_id, day, period_id, trigger_date, status)
              VALUES (?, ?, ?, ?, 'triggered')
            `, [entry.faculty_id, currentDay, entry.period, triggerDate]);

            const payload = {
              id: `${entry.faculty_id}-${triggerDate}-${entry.period}`,
              status: "live",
              period: entry.period,
              subject: entry.subject_name,
              faculty: entry.faculty_name,
              room: entry.classroom,
              group: entry.group_id,
              alert_minutes: endInMins - currentTimeInMins,
              timeLeft: `${endInMins - currentTimeInMins} mins left`
            };

            const socketId = activeSessions.get(entry.faculty_id);
            if (socketId) {
              io.to(socketId).emit("incoming-alert", payload);
            }

            // Also broadcast to the student group room
            io.to(`group_${entry.group_id}`).emit("incoming-alert", payload);
            console.log(`Command signal broadcast to sector: group_${entry.group_id}`);
         }
      }
    }
  } catch (err) {
    console.error("Cron check error:", err);
  }
});

// Acknowledge Alert API
app.post('/api/alerts/acknowledge', async (req, res) => {
  const { faculty_id, period_id } = req.body;
  const triggerDate = new Date().toISOString().split('T')[0];

  try {
    await db.execute(`
      UPDATE notification_triggers 
      SET status = 'acknowledged' 
      WHERE faculty_id = ? AND period_id = ? AND trigger_date = ?
    `, [faculty_id, period_id, triggerDate]);
    
    formattedResponse(res, true, 200, "Alert acknowledged", null);
  } catch (err) {
    console.error("Acknowledgment error:", err);
    formattedResponse(res, false, 500, "Failed to acknowledge alert", null);
  }
});

// Fetch Active (Triggered) Alerts
app.get('/api/alerts/active/:facultyId', async (req, res) => {
  const { facultyId } = req.params;
  const triggerDate = new Date().toISOString().split('T')[0];

  try {
    const [rows] = await db.execute(`
      SELECT n.*, t.subject_name, t.classroom, t.group_id
      FROM notification_triggers n
      JOIN timetable t ON n.faculty_id = t.faculty_id AND n.period_id = t.period AND n.day = t.day
      WHERE n.faculty_id = ? AND n.trigger_date = ? AND n.status = 'triggered'
    `, [facultyId, triggerDate]);

    formattedResponse(res, true, 200, "Active alerts fetched", rows);
  } catch (err) {
    console.error("Active alert fetch error:", err);
    formattedResponse(res, false, 500, "Failed to fetch active alerts", null);
  }
});

// Health check
app.get('/api/health', (req, res) => {
  formattedResponse(res, true, 200, "Server is healthy", { status: "UP" });
});

// Dashboard Statistics
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const [[{ count: facultyCount }]] = await db.execute('SELECT COUNT(*) as count FROM faculties');
    const [[{ count: studentCount }]] = await db.execute('SELECT COUNT(*) as count FROM students');
    const [[{ count: activeStaff }]] = await db.execute("SELECT COUNT(*) as count FROM faculties WHERE status = 'Active'");
    
    formattedResponse(res, true, 200, "Dashboard stats fetched successfully", {
      totalFaculty: facultyCount,
      totalStudents: studentCount,
      activeFaculty: activeStaff,
      activeSessions: 0, 
      alertSensors: 0
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    formattedResponse(res, false, 500, "Failed to fetch dashboard stats", null);
  }
});

// Faculty Specific Login
app.post('/api/faculty/login', async (req, res) => {
  const { emp_id, password } = req.body;
  try {
    const [rows] = await db.execute(
      'SELECT u.*, s.id as faculty_master_id, s.name, s.dept FROM users u JOIN faculties s ON u.emp_id = s.emp_id WHERE u.emp_id = ? AND u.password = ? AND u.role = "faculty"',
      [emp_id, password]
    );

    if (rows.length > 0) {
      const user = rows[0];
      const token = jwt.sign({ id: user.id, emp_id: user.emp_id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
      formattedResponse(res, true, 200, "Faculty Login Successful", { 
        token, 
        user: { id: user.faculty_master_id, name: user.name, emp_id: user.emp_id, dept: user.dept, role: user.role } 
      });
    } else {
      formattedResponse(res, false, 401, "Invalid Employee ID or Password", null);
    }
  } catch (error) {
    console.error("Faculty login error:", error);
    formattedResponse(res, false, 500, "Internal Server Error", null);
  }
});

// General Login endpoint (Admin/Student)
app.post('/api/login', async (req, res) => {
  const { identifier, password } = req.body;
  try {
    const [rows] = await db.execute(
      'SELECT * FROM users WHERE (email = ? OR phone = ? OR emp_id = ?) AND password = ?', 
      paramsOrNull([identifier, identifier, identifier, password])
    );
    if (rows.length > 0) {
      const user = rows[0];
      let faculty_id = null;
      let student = null;
      if (user.role === 'faculty') {
        const [facs] = await db.execute('SELECT id FROM faculties WHERE emp_id = ?', [user.emp_id]);
        faculty_id = facs[0]?.id;
      } else if (user.role === 'student') {
        const [studs] = await db.execute('SELECT * FROM students WHERE enroll_no = ? OR reg_no = ? OR email = ?', [user.emp_id, user.emp_id, user.email]);
        student = studs[0];
        // Auto-populate group_id if missing in legacy records
        if (student && !student.group_id && student.dept && student.semester && student.section) {
          const DEPT_MAP = {
            'Engineering': 'ENG', 'Arts': 'ARTS', 'Science': 'SCI', 
            'Commerce': 'COM', 'Management': 'MGMT', 'Computer Applications': 'MCA'
          };
          const mappedDept = DEPT_MAP[student.dept] || 'DP';
          student.group_id = `${mappedDept}-${student.program?.replace(/\\s+/g, '').toUpperCase()}-SEM${student.semester}-${student.section}`;
          
          await db.execute('UPDATE students SET group_id = ? WHERE id = ?', [student.group_id, student.id]);
        }
      }
      formattedResponse(res, true, 200, "Login Successful! Welcome to Alertic.", { id: user.id, faculty_id, student, email: user.email, role: user.role });
    } else {
      formattedResponse(res, false, 401, "Invalid credentials", null);
    }
  } catch (error) {
    console.error("Login error:", error);
    formattedResponse(res, false, 500, "Internal Server Error", null);
  }
});

// Real data for Faculties
app.get('/api/faculties', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM faculties');
    formattedResponse(res, true, 200, "Faculty data fetched successfully", rows);
  } catch (error) {
    console.error("Fetch faculty error:", error);
    formattedResponse(res, false, 500, "Failed to fetch faculty data", null);
  }
});

// Add New Faculty
app.post('/api/faculties', async (req, res) => {
  const { name, emp_id, dept, role, email, phone, status, password } = req.body;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Insert into faculties table
    await connection.execute(
      'INSERT INTO faculties (name, emp_id, dept, email, phone, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      paramsOrNull([
        name, 
        emptyStringToNull(emp_id), 
        dept, 
        emptyStringToNull(email), 
        emptyStringToNull(phone), 
        role, 
        status || 'Active'
      ])
    );

    // 2. Create User Account
    await connection.execute(
      'INSERT INTO users (email, phone, emp_id, password, role) VALUES (?, ?, ?, ?, ?)',
      [
        emptyStringToNull(email), 
        emptyStringToNull(phone), 
        emptyStringToNull(emp_id), 
        password || '12345678', 
        'faculty'
      ]
    );

    await connection.commit();
    formattedResponse(res, true, 201, "Faculty member added and account created", null);
  } catch (error) {
    await connection.rollback();
    console.error("Add faculty error:", error);
    if (error.code === 'ER_DUP_ENTRY') {
      return formattedResponse(res, false, 409, "A faculty member with this Email, Phone, or ID already exists.", null);
    }
    formattedResponse(res, false, 500, "Failed to add faculty member", null);
  } finally {
    connection.release();
  }
});

// Get all students
app.get('/api/students', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM students');
    formattedResponse(res, true, 200, "Student data fetched successfully", rows);
  } catch (error) {
    console.error("Fetch students error:", error);
    formattedResponse(res, false, 500, "Failed to fetch student data", null);
  }
});

// Add New Student
app.post('/api/students', async (req, res) => {
  const { name, enroll_no, reg_no, email, password, dept, section, program, semester, academic_year, group_id } = req.body;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Insert into students table
    // Ensure group_id perfectly matches timetable architecture formats
    const DEPT_MAP = {
      'Engineering': 'ENG', 'Arts': 'ARTS', 'Science': 'SCI', 
      'Commerce': 'COM', 'Management': 'MGMT', 'Computer Applications': 'MCA'
    };
    const mappedDept = DEPT_MAP[dept] || 'DP';
    const computedGid = `${mappedDept}-${program?.replace(/\\s+/g, '').toUpperCase()}-SEM${semester}-${section}`;
    const finalGid = group_id || computedGid;

    // Smart email fallback generation per user logic rules
    const generateEmailDefault = (studentName) => {
      if (!studentName) return '';
      return `${studentName.toLowerCase().trim().replace(/\s+/g, '.')}@college.edu`;
    };
    const finalEmail = email ? email : generateEmailDefault(name);

    await connection.execute(`
      INSERT INTO students (name, email, enroll_no, reg_no, dept, section, program, semester, academic_year, group_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [name, finalEmail, enroll_no, reg_no, dept, section, program, semester, academic_year, finalGid, 'Active']);

    // 2. Create User Account
    if (finalEmail) {
      await connection.execute(`
        INSERT INTO users (email, password, role, emp_id)
        VALUES (?, ?, ?, ?)
      `, [finalEmail, password || '12345678', 'student', enroll_no]);
    }

    await connection.commit();
    formattedResponse(res, true, 201, "Student registered and account localized", null);
  } catch (error) {
    await connection.rollback();
    console.error("Add student error:", error);
    if (error.code === 'ER_DUP_ENTRY') {
      return formattedResponse(res, false, 409, "A student with this Enrollment No, Reg No, or Email already exists.", null);
    }
    formattedResponse(res, false, 500, "Failed to register student assets", null);
  } finally {
    connection.release();
  }
});

// Update Student
app.put('/api/students/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, status, dept, section, program, semester, academic_year, enroll_no } = req.body;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(`
      UPDATE students 
      SET name = ?, email = ?, status = ?, dept = ?, section = ?, program = ?, semester = ?, academic_year = ?
      WHERE id = ?
    `, [name, email, status, dept, section, program, semester, academic_year, id]);

    // Track user sync - student email must match their login identity
    if (enroll_no && email) {
      await connection.execute(
        'UPDATE users SET email = ? WHERE emp_id = ? AND role = \'student\'',
        [email, enroll_no]
      );
    }

    await connection.commit();
    formattedResponse(res, true, 200, "Student updated and synced successfully", null);
  } catch (error) {
    await connection.rollback();
    console.error("Update student error:", error);
    formattedResponse(res, false, 500, "Failed to update student record", null);
  } finally {
    connection.release();
  }
});

// Delete student
app.delete('/api/students/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.execute('DELETE FROM students WHERE id = ?', [id]);
    formattedResponse(res, true, 200, "Student deleted successfully", null);
  } catch (error) {
    console.error("Delete student error:", error);
    formattedResponse(res, false, 500, "Failed to delete student", null);
  }
});

// Update Faculty
app.put('/api/faculties/:id', async (req, res) => {
  const { id } = req.params;
  const { name, emp_id, dept, role, email, phone, status } = req.body;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Get current emp_id to update users table too
    const [[currentFaculty]] = await connection.execute('SELECT emp_id FROM faculties WHERE id = ?', [id]);
    if (!currentFaculty) {
      await connection.rollback();
      return formattedResponse(res, false, 404, "Faculty member not found", null);
    }

    // 1. Update faculties table
    await connection.execute(
      'UPDATE faculties SET name = ?, emp_id = ?, dept = ?, email = ?, phone = ?, role = ?, status = ? WHERE id = ?',
      paramsOrNull([name, emptyStringToNull(emp_id), dept, emptyStringToNull(email), emptyStringToNull(phone), role, status, id])
    );

    // 2. Update users table (if emp_id, email, or phone changed)
    await connection.execute(
      'UPDATE users SET emp_id = ?, email = ?, phone = ? WHERE emp_id = ?',
      paramsOrNull([emptyStringToNull(emp_id), emptyStringToNull(email), emptyStringToNull(phone), currentFaculty.emp_id])
    );

    await connection.commit();
    formattedResponse(res, true, 200, "Faculty member updated successfully", null);
  } catch (error) {
    await connection.rollback();
    console.error("Update faculty error:", error);
    formattedResponse(res, false, 500, "Failed to update faculty member", null);
  } finally {
    connection.release();
  }
});

// Delete Faculty
app.delete('/api/faculties/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.execute('DELETE FROM faculties WHERE id = ?', [id]);
    if (result.affectedRows > 0) {
      formattedResponse(res, true, 200, "Faculty member deleted successfully", null);
    } else {
      formattedResponse(res, false, 404, "Faculty member not found", null);
    }
  } catch (error) {
    console.error("Delete faculty error:", error);
    formattedResponse(res, false, 500, "Failed to delete faculty member", null);
  }
});

// Bulk Import Students
app.post('/api/students/import', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return formattedResponse(res, false, 400, "No file uploaded", null);
  }

  const connection = await db.getConnection();
  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    await connection.beginTransaction();

    for (const row of data) {
      const { Name, "Enroll No": enrollNo, "Reg No": regNo, Email, Password, Status, Dept, Section, Program, Semester, "Academic Year": academicYear } = row;
      
      if (!Name || !enrollNo || !regNo) continue;

      const emailVal = emptyStringToNull(Email);
      const passVal = Password || '12345678';

      // Basic server-side email validation for import
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailVal && !emailRegex.test(emailVal)) {
        console.warn(`Skipping user account creation for ${Name} due to invalid email: ${emailVal}`);
        // We still insert the student, but skip user account creation if email is bad
      } else if (emailVal) {
        // 2. Create/Update User Account
        await connection.execute(
          'INSERT INTO users (email, password, role, emp_id) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE password=VALUES(password), emp_id=VALUES(emp_id)',
          [emailVal, passVal, 'student', enrollNo]
        );
      }

      // 1. Insert into students table
      const gid = `${Dept}_${Semester}_${Section}`;
      await connection.execute(
        'INSERT INTO students (name, enroll_no, reg_no, status, dept, section, program, semester, academic_year, group_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), status=VALUES(status), dept=VALUES(dept), section=VALUES(section), program=VALUES(program), semester=VALUES(semester), academic_year=VALUES(academic_year), group_id=VALUES(group_id)',
        [Name, enrollNo, regNo, Status || 'Active', Dept || null, Section || null, Program || null, Semester || null, academicYear || null, gid]
      );
    }

    await connection.commit();
    formattedResponse(res, true, 201, "Student data and user accounts processed successfully", null);
  } catch (error) {
    await connection.rollback();
    console.error("Import error:", error);
    formattedResponse(res, false, 500, "Failed to import student data", null);
  } finally {
    connection.release();
  }
});

// Delete Student
// --- TIMETABLE API ---

// 1. Get all subjects
app.get('/api/subjects', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM subjects');
    formattedResponse(res, true, 200, "Subjects fetched successfully", rows);
  } catch (error) {
    console.error("Fetch subjects error:", error);
    formattedResponse(res, false, 500, "Failed to fetch subjects", null);
  }
});

// 2. Add New Subject
app.post('/api/subjects', async (req, res) => {
  const { name, code, dept } = req.body;
  try {
    await db.execute('INSERT INTO subjects (name, code, dept) VALUES (?, ?, ?)', [name, code, dept]);
    formattedResponse(res, true, 201, "Subject added successfully", null);
  } catch (error) {
    console.error("Add subject error:", error);
    formattedResponse(res, false, 500, "Failed to add subject", null);
  }
});

// 2.5 Get All Unique Timetable Headers (Dept & Section)
app.get('/api/timetable/list', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT DISTINCT dept, section, academic_year, program, semester, group_id 
      FROM timetable 
      ORDER BY group_id
    `);
    formattedResponse(res, true, 200, "Timetable list fetched successfully", rows);
  } catch (error) {
    console.error("Fetch timetable list error:", error);
    formattedResponse(res, false, 500, "Failed to fetch timetable list", null);
  }
});

// 2b. Get all current timetable assignments (for global availability check)
app.get('/api/timetable/all-assignments', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT faculty_id, day, period, academic_year, group_id, program, section, semester 
      FROM timetable
    `);
    formattedResponse(res, true, 200, "Global assignments fetched", rows);
  } catch (error) {
    console.error("Fetch assignments error:", error);
    formattedResponse(res, false, 500, "Failed to fetch assignments", null);
  }
});

// 3. Get Timetable by group_id (with dept/section/semester/program fallback)
app.get('/api/timetable', async (req, res) => {
  const { group_id, dept, section, semester, program } = req.query;
  try {
    let [rows] = await db.execute(`
      SELECT t.*, COALESCE(s.name, t.subject_name) as subject_name_display, st.name as faculty_name 
      FROM timetable t
      LEFT JOIN subjects s ON t.subject_id = s.id
      LEFT JOIN faculties st ON t.faculty_id = st.id
      WHERE t.group_id = ?
    `, paramsOrNull([group_id]));

    // Fallback: if group_id returns nothing and dept/section/semester are provided
    if (rows.length === 0 && dept && section && semester) {
      let query = `
        SELECT t.*, COALESCE(s.name, t.subject_name) as subject_name_display, st.name as faculty_name 
        FROM timetable t
        LEFT JOIN subjects s ON t.subject_id = s.id
        LEFT JOIN faculties st ON t.faculty_id = st.id
        WHERE t.dept = ? AND t.section = ? AND t.semester = ?
      `;
      const queryParams = [dept, section, semester];
      
      if (program) {
        query += ` AND t.program = ?`;
        queryParams.push(program);
      }
      
      [rows] = await db.execute(query, paramsOrNull(queryParams));
    }

    formattedResponse(res, true, 200, "Timetable fetched successfully", rows);
  } catch (error) {
    console.error("Fetch timetable error:", error);
    formattedResponse(res, false, 500, "Failed to fetch timetable", null);
  }
});

// 4. Check Faculty Conflict
app.post('/api/timetable/check-conflict', async (req, res) => {
  const { faculty_id, day, period, group_id, academic_year } = req.body;
  try {
    const [rows] = await db.execute(`
      SELECT t.*, COALESCE(s.name, t.subject_name) as subject_display_name 
      FROM timetable t
      LEFT JOIN subjects s ON t.subject_id = s.id
      WHERE t.faculty_id = ? AND t.day = ? AND t.period = ? AND t.academic_year = ?
      AND t.group_id != ?
    `, [faculty_id, day, period, academic_year, group_id]);

    if (rows.length > 0) {
      const conflict = rows[0];
      formattedResponse(res, true, 200, "Conflict detected", { 
        hasConflict: true, 
        message: `This faculty is already assigned to ${conflict.program} (${conflict.dept}) Sem ${conflict.semester} Sec ${conflict.section} for ${conflict.subject_display_name} during this period.`
      });
    } else {
      formattedResponse(res, true, 200, "No conflict", { hasConflict: false });
    }
  } catch (error) {
    console.error("Conflict check error:", error);
    formattedResponse(res, false, 500, "Failed to check conflict", null);
  }
});

// 5. Save Timetable Slot (Add/Update)
app.post('/api/timetable', async (req, res) => {
  const { dept, section, subject_id, subject_name, faculty_id, day, period, classroom, year, academic_year, program, semester, group_id } = req.body;
  const ay = academic_year || year;
  const gid = group_id || `${dept}_${semester}_${section}`;
  try {
    // Institution-wide cleanup: Remove faculty from OTHER classes at the same time
    await db.execute(`
      DELETE FROM timetable 
      WHERE faculty_id = ? AND day = ? AND period = ? AND academic_year = ?
      AND group_id != ?
    `, [faculty_id, day, period, ay, gid]);

    await db.execute(`
      INSERT INTO timetable (dept, section, subject_id, subject_name, faculty_id, day, period, classroom, academic_year, program, semester, group_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        subject_id = VALUES(subject_id),
        subject_name = VALUES(subject_name),
        faculty_id = VALUES(faculty_id),
        classroom = VALUES(classroom),
        academic_year = VALUES(academic_year),
        program = VALUES(program),
        semester = VALUES(semester),
        dept = VALUES(dept),
        section = VALUES(section)
    `, paramsOrNull([dept, section, subject_id || null, subject_name || null, faculty_id, day, period, classroom, ay, program, semester, gid]));

    formattedResponse(res, true, 200, "Timetable updated successfully", null);
  } catch (error) {
    console.error("Save timetable error:", error);
    formattedResponse(res, false, 500, "Failed to save timetable", null);
  }
});

// 5b. Batch Save Timetable
app.post('/api/timetable/batch', async (req, res) => {
  const { entries } = req.body;
  if (!entries || !Array.isArray(entries)) {
    return formattedResponse(res, false, 400, "Invalid entries provided", null);
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    for (const entry of entries) {
      const { dept, section, subject_id, subject_name, faculty_id, day, period, classroom, year, academic_year, program, semester } = entry;
      const ay = academic_year || year;
      const gid = entry.group_id || `${dept}_${semester}_${section}`;
      
      // Automatic cleanup: Wipe this faculty's assignments from OTHER classes for this slot
      await connection.execute(`
        DELETE FROM timetable 
        WHERE faculty_id = ? AND day = ? AND period = ? AND academic_year = ?
        AND group_id != ?
      `, [faculty_id, day, period, ay, gid]);

      await connection.execute(`
        INSERT INTO timetable (dept, section, subject_id, subject_name, faculty_id, day, period, classroom, academic_year, program, semester, group_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          subject_id = VALUES(subject_id),
          subject_name = VALUES(subject_name),
          faculty_id = VALUES(faculty_id),
          classroom = VALUES(classroom),
          academic_year = VALUES(academic_year),
          program = VALUES(program),
          semester = VALUES(semester),
          dept = VALUES(dept),
          section = VALUES(section)
      `, paramsOrNull([dept, section, subject_id || null, subject_name || null, faculty_id, day, period, classroom, ay, program, semester, gid]));
    }

    await connection.commit();
    formattedResponse(res, true, 200, "Batch timetable updated successfully", null);
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Batch save error:", error.message);
    formattedResponse(res, false, 409, error.message || "Failed to persist batch changes", null);
  } finally {
    if (connection) connection.release();
  }
});


// 6. Delete Timetable Slot
app.delete('/api/timetable/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.execute('DELETE FROM timetable WHERE id = ?', paramsOrNull([id]));
    formattedResponse(res, true, 200, "Slot removed successfully", null);
  } catch (error) {
    console.error("Delete slot error:", error);
    formattedResponse(res, false, 500, "Failed to remove slot", null);
  }
});

// 6b. Bulk Delete Timetable
app.delete('/api/timetable/bulk/delete', async (req, res) => {
  const { group_id, dept, section, semester } = req.query;
  try {
    if (group_id && group_id !== 'null' && group_id !== 'undefined') {
      const [{ affectedRows }] = await db.execute(`
        DELETE FROM timetable 
        WHERE group_id = ?
      `, paramsOrNull([group_id]));
      
      // If no rows were deleted but we have fallback parameters, try those
      if (affectedRows === 0 && dept && section && semester) {
        await db.execute(`
          DELETE FROM timetable 
          WHERE dept = ? AND section = ? AND semester = ?
        `, paramsOrNull([dept, section, semester]));
      }
    } else if (dept && section && semester) {
      // Direct fallback if group_id is entirely missing
      await db.execute(`
        DELETE FROM timetable 
        WHERE dept = ? AND section = ? AND semester = ?
      `, paramsOrNull([dept, section, semester]));
    }
    
    formattedResponse(res, true, 200, "Entire timetable deleted successfully", null);
  } catch (error) {
    console.error("Bulk delete error:", error);
    formattedResponse(res, false, 500, "Failed to delete timetable", null);
  }
});

// 7. Get Faculty Personalized Timetable (Current Day)
app.get('/api/faculties/my-timetable/:faculty_id', async (req, res) => {
  const { faculty_id } = req.params;
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
  
  try {
    const [rows] = await db.execute(`
      SELECT t.*, COALESCE(s.name, t.subject_name) as subject_name, s.code as subject_code
      FROM timetable t
      LEFT JOIN subjects s ON t.subject_id = s.id
      WHERE t.faculty_id = ? AND t.day = ?
      ORDER BY period
    `, paramsOrNull([faculty_id, dayName]));
    formattedResponse(res, true, 200, "Faculty timetable fetched successfully", rows);
  } catch (error) {
    console.error("Fetch faculty timetable error:", error);
    formattedResponse(res, false, 500, "Failed to fetch faculty timetable", null);
  }
});

// --- STUDENT MODULE APIs ---
// 1. Get Student Dashboard Data
app.get('/api/student/dashboard/:enroll_no', async (req, res) => {
  const { enroll_no } = req.params;
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];

  try {
    // A. Fetch Student Info
    const [students] = await db.execute('SELECT * FROM students WHERE enroll_no = ?', [enroll_no]);
    if (students.length === 0) {
      return formattedResponse(res, false, 404, "Student record not found", null);
    }
    const student = students[0];

    // B. Fetch Today's Timetable — try group_id first, then fall back to dept+semester+section
    let [schedule] = await db.execute(`
      SELECT t.*, COALESCE(s.name, t.subject_name) as subject_name, st.name as faculty_name 
      FROM timetable t
      LEFT JOIN subjects s ON t.subject_id = s.id
      LEFT JOIN faculties st ON t.faculty_id = st.id
      WHERE t.group_id = ? AND t.day = ?
      ORDER BY t.period
    `, paramsOrNull([student.group_id, dayName]));

    // Fallback: if no rows found by group_id, try matching by dept + semester + section + program
    if (schedule.length === 0 && student.dept && student.semester && student.section) {
      let query = `
        SELECT t.*, COALESCE(s.name, t.subject_name) as subject_name, st.name as faculty_name 
        FROM timetable t
        LEFT JOIN subjects s ON t.subject_id = s.id
        LEFT JOIN faculties st ON t.faculty_id = st.id
        WHERE t.dept = ? AND t.semester = ? AND t.section = ? AND t.day = ?
      `;
      const queryParams = [student.dept, student.semester, student.section, dayName];

      if (student.program) {
        query += ` AND t.program = ?`;
        queryParams.push(student.program);
      }
      
      query += ` ORDER BY t.period`;

      [schedule] = await db.execute(query, paramsOrNull(queryParams));
    }

    formattedResponse(res, true, 200, "Student dashboard synchronized", {
      student,
      schedule,
      day: dayName
    });
  } catch (error) {
    console.error("Student dashboard error:", error);
    formattedResponse(res, false, 500, "Failed to sync dashboard", null);
  }
});

// --- SMART FACULTY MODULE APIs ---

// 1. Aggregated Dashboard Stats
app.get('/api/faculty/dashboard/:faculty_id', async (req, res) => {
  const { faculty_id } = req.params;
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
  
  try {
    // A. Today's Full Schedule
    const [schedule] = await db.execute(`
      SELECT t.*, COALESCE(s.name, t.subject_name) as subject_name, t.dept, t.section
      FROM timetable t
      LEFT JOIN subjects s ON t.subject_id = s.id
      WHERE t.faculty_id = ? AND t.day = ?
      ORDER BY t.period
    `, paramsOrNull([faculty_id, dayName]));

    // B. Fetch Alert Settings
    const [settings] = await db.execute('SELECT alert_before_minutes FROM alert_settings WHERE faculty_id = ?', [faculty_id]);
    const alertInterval = settings[0]?.alert_before_minutes || 5;

    formattedResponse(res, true, 200, "Dashboard data synchronized", {
      schedule,
      day: dayName,
      alertInterval
    });
  } catch (error) {
    console.error("Faculty dashboard aggregation error:", error);
    formattedResponse(res, false, 500, "Failed to sync dashboard intelligence", null);
  }
});

// 2. Full Weekly Timetable
app.get('/api/faculty/full-timetable/:faculty_id', async (req, res) => {
  const { faculty_id } = req.params;
  try {
    const [rows] = await db.execute(`
      SELECT t.*, COALESCE(s.name, t.subject_name) as subject_name, t.dept, t.section
      FROM timetable t
      LEFT JOIN subjects s ON t.subject_id = s.id
      WHERE t.faculty_id = ?
      ORDER BY FIELD(day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'), period
    `, [faculty_id]);
    formattedResponse(res, true, 200, "Weekly timetable fetched", rows);
  } catch (error) {
    console.error("Weekly timetable error:", error);
    formattedResponse(res, false, 500, "Failed to fetch weekly records", null);
  }
});

// 3. Update Alert Settings
app.post('/api/faculty/alert-settings', async (req, res) => {
  const { faculty_id, alert_before_minutes } = req.body;
  try {
    await db.execute(`
      INSERT INTO alert_settings (faculty_id, alert_before_minutes) 
      VALUES (?, ?) 
      ON DUPLICATE KEY UPDATE alert_before_minutes = VALUES(alert_before_minutes)
    `, [faculty_id, alert_before_minutes]);
    formattedResponse(res, true, 200, "Alert protocols updated", null);
  } catch (error) {
    console.error("Alert settings update error:", error);
    formattedResponse(res, false, 500, "Failed to update alert preference", null);
  }
});

app.delete('/api/students/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.execute('DELETE FROM students WHERE id = ?', [id]);
    if (result.affectedRows > 0) {
      formattedResponse(res, true, 200, "Student record deleted successfully", null);
    } else {
      formattedResponse(res, false, 404, "Student record not found", null);
    }
  } catch (error) {
    console.error("Delete student error:", error);
    formattedResponse(res, false, 500, "Failed to delete student record", null);
  }
});

// Manual Session Log
app.post('/api/faculty/manual-log', async (req, res) => {
  const { faculty_id, subject_name, room_number, group_id, period_id } = req.body;
  try {
    const timestamp = new Date().toISOString();
    await db.execute(
      'INSERT INTO acknowledgments (faculty_id, subject_name, room_number) VALUES (?, ?, ?)',
      [faculty_id, `${subject_name} (Manual Start)`, room_number]
    );
    formattedResponse(res, true, 200, "Session logged as activated.", { timestamp });
  } catch (err) {
    console.error("Manual log error:", err);
    formattedResponse(res, false, 500, "Log sync failed.", null);
  }
});

// --- END OF ALERT ENGINE ---

http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
