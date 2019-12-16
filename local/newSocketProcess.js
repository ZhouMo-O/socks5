const net = require('net');
const Becrypto = require('../crypto/crypto');

class socketProcess {
    constructor(socket) {
        this.socket = socket;
        this.linkStatus = 'stepOne';

        socket.on('data', (data) => {
            return this.linkProcess(this.socket, data)
        })

        socket.on('close', (close) => {
            console.log(close)
        })

        socket.on('error', (err) => {
            console.log(err)
        })
    }

    linkProcess(socket, data) {
        if (this.linkStatus == 'stepOne') {
            return this.fistLinkProcess(socket, data);
        } else if (this.linkStatus == 'stepTwo') {
            return this.secondLinkProcess(socket, data);
        } else if (this.linkStatus == 'proxy') {
            console.log(`remoteData`, data.toString());
            let crypto = new Becrypto();
            let enData = crypto.encrypt(data);
            return this.remote.write(enData);
        }
    }

    fistLinkProcess(socket, data) {
        console.log('第一次link处理数据', data);
        const authMethdos = {
            NOAUTH: 0, //no auth
            USERNAME: 1 //username/password
        }

        const VERSION = parseInt(data[0], 10);
        const METHODS = parseInt(data[1], 10);

        let reBuffer = Buffer.alloc(2);
        let methdosList = data.slice(2);

        if (methdosList.length !== METHODS) {
            console.log('命令结构不全', methdosList);
            return false
        }

        if (VERSION === 5) {
            reBuffer.writeUInt8(VERSION, 0);
        } else {
            console.log(`不支持的socket协议:${VERSION}`);
            return false
        }

        if (methdosList[0] == authMethdos.NOAUTH) {
            reBuffer.writeUInt8(authMethdos.NOAUTH, 1);
        } else {
            console.log(`暂不支持的加密方法`)
        }

        console.log(`第一次link返回`, reBuffer);
        this.linkStatus = 'stepTwo';
        return this.socket.write(reBuffer)
    }

    secondLinkProcess(socket, data) {
        console.log('第二次link处理数据', data);
        const ATYP = parseInt(data[3], 10);

        if (ATYP === 1 && data.length == 10) {
            return this.readSecondLinkBuffer_ip(socket, ATYP, data);
        } else if (ATYP === 3 && data.length >= 10) {
            return this.readSecondLinkBuffer_domain(socket, ATYP, data)
        } else {
            console.log(`暂不支持的ATYP类型${ATYP}`);
            return false
        }
    }
    readSecondLinkBuffer_domain(socket, ATYP, data) {
        let doMain, deDoMain, port, dePort;
        doMain = data.slice(5, -2);
        deDoMain = doMain.toString();

        port = data.slice(-2);
        dePort = port.readUInt16BE();

        console.log(`访问的域名:${deDoMain}:${dePort}`);
        return this.linkRemoteServer(socket, ATYP, deDoMain.toString(), dePort.toString())
    }

    readSecondLinkBuffer_ip(socket, ATYP, data) {
        let ip, deIp, port, dePort;
        ip = data.slice(4, 8);
        deIp = ip.readUInt32BE();

        port = data.slice(8, 10);
        dePort = port.readUInt16BE();
        console.log(`访问目标地址:${this.int2iP(deIp)}:${dePort.toString()}`);

        return this.linkRemoteServer(socket, ATYP, this.int2iP(deIp), dePort.toString())
    }

    linkRemoteServer(socket, ATYP, host, port) {
        this.remote = net.createConnection({
            port: 8089,
            host: '127.0.0.1'
        }, () => {
            console.log('链接成功');
            let palyload = this.buildConnectPlayLoad(ATYP, host, port);
            let cmdBuffer = this.buildCmd(palyload);
            this.remote.write(cmdBuffer);
        });

        this.remote.on('data', (data) => {
            if (this.linkStatus == 'stepTwo') {
                let deCmd = data.readUInt8();
                if (deCmd == 1) {
                    let cmd = this.buildLocalCmd(0x0);
                    socket.write(cmd);
                } else if (deCmd == 0) {
                    let cmd = this.buildLocalCmd(0x1);
                    socket.write(cmd);
                }
                this.linkStatus = 'proxy';
            } else if (this.linkStatus == 'proxy') {
                console.log('proxyData', data);
                let crypto = new Becrypto();
                let beData = crypto.decrypt(data.slice(4));
                socket.write(beData);
            }
        })

        this.remote.on('error', (err) => {
            console.log('连接错误', err);
        })

        this.remote.on('timeout', () => {
            console.log('timeout');
            req.destroyed || req.destroy();
        })

        this.remote.on('end', () => {
            console.log('endProxy')
        })

        this.remote.on('close', (close) => {
            console.log('连接关闭', close);
        })
    }

    //根据remote服务器的返回结果打一个对应的包返回给socks5。
    buildLocalCmd(cmd) {
        console.log(cmd);
        let offset = 0;
        let headBuffer = Buffer.alloc(10);
        headBuffer.writeUInt8(5, offset);
        offset++;

        headBuffer.writeUInt8(cmd, offset);
        offset++;

        headBuffer.writeUInt8(0, offset);
        offset++;

        headBuffer.writeUInt8(1, offset);
        offset++;

        headBuffer.writeUInt32BE(0, offset);
        offset += 4;

        headBuffer.writeInt16BE(0, offset);
        console.log(`第二次link返回数据`, headBuffer);
        return headBuffer;
    }

    //  第一个字段表示整个命令的长度，第二个字段表示本次link的命令，
    //  第三个表示host的类型，是ip还是域名，第四个字节表示host的长度，第五个是host内容
    //  第六个是端口长度，第七个是端口内容

    //  cmdLength|cmd| ATYPType|hostlength|HostAddr|PortLength|  Port |
    //      1    | 1 |    1    |    1    |Variable|    1     |Variable|

    buildCmd(palyload) {
        const cmdHead = Buffer.alloc(4);
        cmdHead.writeUInt32BE(palyload.length);
        const cmdBuffer = Buffer.concat([cmdHead, palyload], 4 + palyload.length);
        console.log(`cmd`, cmdBuffer);
        return cmdBuffer;
    }

    buildConnectPlayLoad(ATYP, host, port) {
        let offset = 0;
        let totalLength = 4 + host.length + port.length;
        let reBuffer = Buffer.alloc(totalLength);

        reBuffer.writeUInt8(0, offset);
        offset++;

        reBuffer.writeUInt8(ATYP, offset);
        offset++;

        reBuffer.writeUInt8(host.length, offset);
        offset++;

        reBuffer.write(host, offset);
        offset += host.length;

        reBuffer.writeUInt8(port.length, offset);
        offset++;

        reBuffer.write(port, offset);
        console.log(`playload`, reBuffer);
        return reBuffer;
    }

    int2iP(num) {
        var str;
        var tt = new Array();
        tt[0] = (num >>> 24) >>> 0;
        tt[1] = ((num << 8) >>> 24) >>> 0;
        tt[2] = (num << 16) >>> 24;
        tt[3] = (num << 24) >>> 24;
        str = String(tt[0]) + "." + String(tt[1]) + "." + String(tt[2]) + "." + String(tt[3]);
        return str;
    }
}


module.exports = socketProcess;