const net = require('net');
const dns = require('dns');
const Becrypto = require('../crypto/crypto');

class remoteProcess {
    constructor(socket) {
        this.socket = socket;
        this.linkStatus = 'stepOne';
        this.deBuffer = Buffer.alloc(0);
        this.reBuffer = Buffer.alloc(0);

        socket.on('data', (data) => {
            return this.linkProcess(this.socket, data)
        })

        socket.on('close', () => {
            console.log(`socket close`);
            this.remote.end();
        })

        socket.on('error', (err) => {
            console.log(`socket error:`, err);
            this.remote.end();
        })
    }

    async linkProcess(socket, data) {
        if (this.linkStatus == 'stepOne') {
            let host = this.fistLinkProcess(data);
            let remoteServer = this.linkRemoteServer(socket, host);
        } else if (this.linkStatus == 'proxy') {
            this.deBuffer = Buffer.concat([this.deBuffer, data]);
            while (true) {
                if (this.deBuffer.length < 4) {
                    return;
                }
                this.cmdBuffer = this.deBuffer.slice(0, 4);
                this.cmdLen = this.cmdBuffer.readUInt32BE();

                if (this.deBuffer.length < this.cmdLen + 4) {
                    return;
                }

                this.crypto = new Becrypto();
                this.reBuffer = this.deBuffer.slice(4, this.cmdLen + 4);
                let deData = this.crypto.decrypt(this.reBuffer);
                this.deBuffer = this.deBuffer.slice(4 + this.cmdLen);

                this.remote.write(deData);
            }
        }
    }

    fistLinkProcess(data) {
        let offset = 0;
        let playLoadLength = data.readUInt32BE(offset, 4);
        offset += 4;;

        if (!playLoadLength - 4 == data) {
            console.log('??')
        }

        let cmd = data.readUInt8(offset);
        offset++;

        let ATYPType = data.readUInt8(offset);
        offset++;

        let hostLength = data.readUInt8(offset);
        offset++;

        let hostAddr = data.slice(offset, hostLength + offset)
        offset += hostLength;

        let portLength = data.readUInt8(offset);
        offset++;

        let port = data.slice(-portLength);

        return {
            cmd: cmd,
            host: hostAddr.toString(),
            port: port.toString()
        }
    }

    linkRemoteServer(socket, host) {
        console.log(`linkRemoteServer：`, host.host, host.port);
        dns.lookup(host.host, (err, addresses) => {
            host.host = addresses;
            console.log(host.host)
        });
        this.remote = net.createConnection({
            host: host.host,
            port: host.port
        }, () => {
            console.log('链接成功');
            let reBuffer = this.buildCmd(1);
            this.linkStatus = 'proxy';
            socket.write(reBuffer);
        })

        this.remote.on('data', (data) => {
            let crypto = new Becrypto();
            let enData = crypto.encrypt(data);
            socket.write(enData);
        })

        this.remote.on('end', () => {
            console.log('endProxy')
            socket.end()

        })

        this.remote.on('close', () => {
            console.log('链接关闭');
            socket.end();

        })

        this.remote.on('error', (err) => {
            console.log('链接错误：', err)
            let reBuffer = this.buildCmd(0);
            socket.write(reBuffer);
        })
    }

    buildCmd(cmd) {
        const newCmd = Buffer.alloc(1);
        newCmd.writeUInt8(cmd, 0);
        return newCmd;
    }
}

module.exports = remoteProcess;