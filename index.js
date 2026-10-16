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
console.log("Version Stupid Beta 1.2.2");

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
