const process = require('node:process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const db = require('./db');

// Variables
const endpoints = {
    '/':           { file: 'home.html', type: 'text/html' },
    '/home.html': { file: 'home.html', type: 'text/html' },
    '/home.css':  { file: 'home.css',  type: 'text/css' },
    '/home.js':   { file: 'home.js',   type: 'text/javascript' }
};

// Introduction
console.log("Server start");
console.log("Version Stupid Beta 1.3");

// Safely kill the server
function Shutdown(signal)
{
    console.log(`\nreceived ${signal}, shutting down...`);

    // Stop accepting new requests
    server.close(function (err) {
        if (err) {
            console.error(err);
            process.exitCode = 1;
        }
    });

    // Kill all connections
    server.closeAllConnections();

    // Safely close database
    db.close();

}

// Check that task from frontend is correct
function validateTask(task)
{
    if (typeof task.course !== 'string' || task.course.trim() === '') return 'Course is required';
    if (typeof task.name !== 'string' || task.name.trim() === '')     return 'Task name is required';
    if (task.dueDate != null && (typeof task.dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(task.dueDate)))
        return 'Due date must be a date and time (YYYY-MM-DDTHH:MM)';

    const hours = task.estimatedTotalHours;
    if (hours != null && (typeof hours !== 'number' || hours < 0))    return 'Hours must be a number 0 or higher';

    return null;
}

// Launch server to port 3000
const server = http.createServer(function (request, response) {
    console.log("Request received.");
    console.log(`Request URL: ${request.url}`);

    const entry = endpoints[request.url];
    
    if (request.url === '/api/tasks' && request.method === 'GET')
    {
        console.log(`API endpoint: ${request.url}`);
        response.writeHead(200, {'Content-Type': 'application/json'});
        response.end(JSON.stringify(db.getTasks()));
        return;
    }

    if (request.url === '/api/tasks' && request.method === 'POST')
    {
        // The body arrives in chunks; collect them, then handle it all at the end
        let body = '';
        request.on('data', function (chunk) { body += chunk; });
        request.on('end', function () {
            let task;
            try
            {
                task = JSON.parse(body);
            }
            catch
            {
                response.writeHead(400, {'Content-Type': 'text/plain'});
                response.end('Invalid JSON');
                return;
            }

            // Never trust the browser: check the values again here
            const error = validateTask(task);
            if (error)
            {
                response.writeHead(400, {'Content-Type': 'text/plain'});
                response.end(error);
                return;
            }

            try
            {
                const id = db.addTask(task);
                console.log(`Added task ${id}`);
                response.writeHead(201, {'Content-Type': 'application/json'});
                response.end(JSON.stringify(db.getTask(id)));   // send back the saved row
            }
            catch (err)
            {
                console.error(err);
                response.writeHead(500, {'Content-Type': 'text/plain'});
                response.end('Could not save task');
            }
        });
        return;
    }

    if (!entry)
    {
        response.writeHead(404, {'Content-Type': 'text/plain'});
        response.end("Endpoint not found.");
        return;
    }

    fs.readFile(path.join(__dirname, entry.file), function (err, data) {
        if (err)
        {
            console.log("Error: Could not read file");
            response.writeHead(500, {'Content-Type': 'text/plain'});
            response.end("Server Error");
            return;
        }
        console.log(`Sent ${entry.file}`);
        response.writeHead(200, {'Content-Type': entry.type});
        response.end(data);
    });

}).listen(3000);

// Create goodbye message
process.once('SIGINT', Shutdown);
process.once('SIGTERM', Shutdown);

process.on('exit', function (code) {
    console.log(`Server closed with exit code ${code}`);
})
