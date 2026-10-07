# Node Server

## Greetings

Hello, world. This project is an ultra-simple experiment in web development, created by Micah Keller.

## Purpose

I started this project in order to learn more about internet protocol and using popular web dev tools, and to develop a bespoke baby ecosystem to serve as a legitimate data organization/productivity tool for me, in order to streamline my workflow as a student and indie dev.

## Structure

**This field will be iterated upon and elaborated within as the complexity of the project progresses**
So far, all the code does is run a node server that returns a short response message. I can request this message as long as the receiving device is on the same local network, and I input the exact IP of the server.

## Use

To use this project, you need node.js installed. Then, simply run `node .` to start the server from the index.js file. Then, on any machine running on your server's local network, enter `http://[YOUR_IP]:3000` in the address bar, and you should receive an insecure web connection returning only "Greetings, alien.".

## Learning

### Node.js
- npm is a package manager
- `node [filename]` is how you run a javascript file
- `node .` is how you run index.js