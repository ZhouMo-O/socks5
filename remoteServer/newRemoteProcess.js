const net = require('net');
const dns = require('dns');

class remoteProcess {
    constructor(socket) {
        this.socket = socket;
        this.linkStatus = 'stepOne';

        socket.on('data', (data) => {
            return this.linkProcess(this.socket, data)
        })

        socket.on('close', (close) => {
            console.log(close);
        })

        socket.on('error', (err) => {
            console.log(err);
        })
    }

    async linkProcess(socket, data) {
        if (this.linkStatus == 'stepOne') {
            let host = this.fistLinkProcess(socket, data);
            let remoteServer = this.linkRemoteServer(socket, host);
        } else if (this.linkStatus == 'proxy') {
            this.remote.write(data);
        }
    }

    fistLinkProcess(socket, data) {
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

        if (ATYPType == 3) {
            let host = hostAddr.toString()
            console.log('正在解析的域名', host);
            dns.lookup(host, (err, addresses) => {
                if (err) {
                    let reBuffer = this.buildCmd(0);
                    console.log('域名解析错误,返回对端', reBuffer);
                    socket.write(reBuffer);
                    console.log(err);
                };
                // addresses.forEach(ip => {
                //     console.log('域名解析后的IP', ip)
                // })
                console.log(`命令号:${cmd} 目标域名${host} 主机Ip:${addresses}:${port}`)
                console.log(cmd, addresses, port);
                return {
                    cmd: cmd,
                    host: addresses,
                    port: port.toString()
                }
            });
        }

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

        this.remote.on('timeout', () => {
            let reBuffer = this.buildCmd(6);
            console.log('timeout');
            socket.write(reBuffer);
            req.destroyed || req.destroy();
        })

        this.remote.on('data', (data) => {
            socket.write(data);
        })

        this.remote.on('end', () => {
            console.log('endProxy')
        })

        this.remote.on('close', () => {
            console.log('链接关闭')
            let reBuffer = this.buildCmd(0);
            socket.write(reBuffer);
        })

        this.remote.on('err', (err) => {
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