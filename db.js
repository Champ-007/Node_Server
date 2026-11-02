// const process = require('node:process');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const { execArgv } = require('process');

const db = new DatabaseSync(path.join(__dirname, 'database.db'));

// Schema: tasks table
db.exec(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY,
    course TEXT NOT NULL,
    name TEXT NOT NULL,
    dueDate TEXT,
    estimatedTotalHours REAL CHECK (estimatedTotalHours >= 0),
    loggedHours REAL NOT NULL DEFAULT 0 CHECK (loggedHours >= 0)
)`);

// db.exec(`CREATE TABLE IF NOT EXISTS`);

const statements = {
    addTask:  db.prepare(`INSERT INTO tasks (course, name, dueDate, estimatedTotalHours) VALUES (?, ?, ?, ?)`),
    getAll:   db.prepare(`SELECT * FROM tasks`),
    getByID:  db.prepare(`SELECT * FROM tasks WHERE id = ?`),
    setHours: db.prepare(`UPDATE tasks SET loggedHours = ? WHERE id  = ?`),
    logHours: db.prepare(`UPDATE tasks SET loggedHours = loggedHours + ? WHERE id  = ?`),
    setDueDate: db.prepare(`UPDATE tasks SET dueDate = ? WHERE id = ?`),
    remove:   db.prepare(`DELETE FROM tasks WHERE id = ?`)
};

function addTask({course, name, dueDate = null, estimatedTotalHours = null})
{
    const result = statements.addTask.run(course, name, dueDate, estimatedTotalHours);
    return Number(result.lastInsertRowid);
}

function getTasks()          { return statements.getAll.all(); }
function getTask(id)         { return statements.getByID.get(id); }
function setHours(id, hours) { return statements.setHours.run(hours, id).changes > 0; }
function logHours(id, hours) { return statements.logHours.run(hours, id).changes > 0; }
function deleteTask(id)      { return statements.remove.run(id).changes > 0; }
function close()             { if (db.isOpen) db.close(); }

module.exports = { addTask, getTasks, getTask, setHours, logHours, deleteTask, close };