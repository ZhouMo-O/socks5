const net = require('net');
const PORT = 5555;
const HOST = '127.0.0.1';
// const bufferProcess = require('./socketProcess');
const bufferProcess = require('./newSocketProcess')

const server = net.createServer((socket) => {
    const sockes = new bufferProcess(socket);


});

server.listen(PORT, HOST, () => {
    console.log('服务端：开始监听来自客户端的请求！');
})