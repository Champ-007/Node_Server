const process = require('node:process');
const http = require('http');

// Introduction
console.log("Server start");
console.log("Version Stupid Beta 1.2");

// Launch server to port 3000
const server = http.createServer(function (request, response) {
    console.log("Response sent.");
    response.writeHead(200, {'Content-Type': 'text/plain'});
    response.write("Greetings, alien.");
    response.end();
}).listen(3000);

// Create goodbye message
process.on('exit', function() {
    console.log("Server closed");
});
