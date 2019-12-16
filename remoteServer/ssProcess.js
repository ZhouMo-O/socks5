module.exports = (socket) => {
    const net = require('net');
    let linkStatus = 'setpOne';

    socket.on('data', (data) => {
        console.log(data);
        bufferProcess(socket, data);
    })


    bufferProcess = (socket, data) => {
        console.log(data.toString())
        if (linkStatus == 'setpOne') {
            let {
                cmd,
                ip,
                port
            } = readBuffer(data); //把校验过的包以解构赋值给cmd和palyload
            cmdProcess(cmd, ip, port, socket)
            console.log(cmd, ip, port)
        } else if (linkStatus == 'proxy') {
            remote.write(data);
        }

    }

    readBuffer = (data) => {
        let offset = 0;
        let bufferHead;
        let cmd;
        let ip;
        let ipLength;
        let port;
        let portLength;
        let palyLoad;

        if (data.length > 4) {
            bufferHead = data.readUInt32BE(0, 4);
        } else {
            console.log('命令结构不符，head格式不正确')
            return false
        }

        if (data.length - 4 == bufferHead) {
            palyLoad = data.slice(4);
        } else {
            console.log('命令结构不符，palyload格式不正确')
            return false
        }
        cmd = palyLoad.readUInt8(0, ++offset);
        ipLength = palyLoad.readUInt8(offset, ++offset) + offset;

        ip = palyLoad.slice(offset, ipLength);
        offset = ipLength;

        portLength = palyLoad.readUInt8(offset, ++offset);
        port = palyLoad.slice(offset, offset + portLength);


        return {
            cmd: cmd,
            ip: ip,
            port: port
        };
    }
    let remote;
    cmdProcess = (cmd, ip, port, socket) => {
        switch (cmd) {
            case 0:
                remote = net.createConnection({
                    port: port.toString(),
                    host: ip.toString()
                }, () => {
                    console.log('connect server');
                    let cmdHead = buildPalyLoad('0');
                    let newBuffer = buildCmd(cmdHead);
                    linkStatus = 'proxy';
                    socket.write(newBuffer);
                })

                remote.on('error', (err) => {
                    console.log(err);
                    let cmdHead = buildPalyLoad('1');
                    let newBuffer = buildCmd(cmdHead);
                    socket.write(newBuffer);
                })

                remote.on('data', (data) => {
                    console.log(data.toString);
                    socket.write(data);
                })

                remote.on('close', (data) => {
                    console.log(`close:`);
                })

                break
            default:
                console.log(`未知命令${cmd}`);
        }
    }


    buildCmd = (palyload) => {
        const headBuffer = Buffer.alloc(4);
        headBuffer.writeInt32BE(palyload.length);
        const newBufer = Buffer.concat([headBuffer, palyload], palyload.length + 4);
        return newBufer;
    }

    buildPalyLoad = (cmd) => {
        let offset = 0;
        let totalLength = cmd.length;
        console.log(totalLength);

        const newCmd = Buffer.alloc(1);
        newCmd.writeUInt8(cmd, offset);
        return newCmd;

    }
}