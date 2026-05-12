-- Create Database
CREATE DATABASE IF NOT EXISTS alertic_db;
USE alertic_db;

-- Table for authentication
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20) UNIQUE,
    emp_id VARCHAR(50) UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'faculty', 'student') NOT NULL
);

-- Table for faculty members
CREATE TABLE IF NOT EXISTS faculties (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    emp_id VARCHAR(50) NOT NULL UNIQUE,
    dept VARCHAR(100),
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20) UNIQUE,
    role VARCHAR(100),
    status ENUM('Active', 'Inactive') DEFAULT 'Active',
    img VARCHAR(255)
);

-- Table for students
CREATE TABLE IF NOT EXISTS students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    enroll_no VARCHAR(50) NOT NULL UNIQUE,
    reg_no VARCHAR(50) NOT NULL UNIQUE,
    status ENUM('Active', 'Inactive') DEFAULT 'Active',
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20) UNIQUE,
    dept VARCHAR(100),
    section VARCHAR(50),
    program VARCHAR(100),
    semester VARCHAR(50),
    academic_year VARCHAR(50),
    group_id VARCHAR(100)
);

-- Table for subjects
CREATE TABLE IF NOT EXISTS subjects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    dept VARCHAR(100)
);

-- Table for timetable
CREATE TABLE IF NOT EXISTS timetable (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dept VARCHAR(100) NOT NULL,
    section VARCHAR(50) NOT NULL,
    subject_id INT,
    subject_name VARCHAR(255),
    faculty_id INT NOT NULL,
    day VARCHAR(20) NOT NULL,
    period INT NOT NULL,
    classroom VARCHAR(50),
    academic_year VARCHAR(50),
    program VARCHAR(100),
    semester VARCHAR(50),
    group_id VARCHAR(100),
    UNIQUE KEY unique_group_slot (group_id, day, period),
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL,
    FOREIGN KEY (faculty_id) REFERENCES faculties(id) ON DELETE CASCADE
);

-- Table for alert acknowledgments
CREATE TABLE IF NOT EXISTS acknowledgments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    faculty_id INT NOT NULL,
    subject_name VARCHAR(255),
    room_number VARCHAR(50),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (faculty_id) REFERENCES faculties(id) ON DELETE CASCADE
);

-- Table for alert settings
CREATE TABLE IF NOT EXISTS alert_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    faculty_id INT NOT NULL UNIQUE,
    alert_before_minutes INT DEFAULT 15,
    FOREIGN KEY (faculty_id) REFERENCES faculties(id) ON DELETE CASCADE
);

-- Insert a default admin
INSERT IGNORE INTO users (email, password, role) VALUES ('admin@alertic.com', 'admin123', 'admin');
