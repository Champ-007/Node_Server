const process = require('node:process');
const http = require('http');

// Introduction
console.log("Server start");
console.log("Version Stupid Beta 1.2");

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

    // Close idle connections
    server.closeAllConnections();
}

// Launch server to port 3000
const server = http.createServer(function (request, response) {
    console.log("Response sent.");
    response.writeHead(200, {'Content-Type': 'text/plain'});
    response.write("Greetings, alien.");
    response.end();
}).listen(3000);

// Create goodbye message
process.once('SIGINT', Shutdown);
process.once('SIGTERM', Shutdown);

process.on('exit', function (code) {
    console.log(`Server closed with exit code ${code}`);
})
