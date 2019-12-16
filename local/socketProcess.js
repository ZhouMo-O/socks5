module.exports = bufferProcess = (socket) => {
    const net = require('net');

    console.log('服务端：收到来自客户端的请求');
    socket.on('data', (local) => {
        bufferProcess(socket, local);
    });

    socket.on('error', (err) => {
        console.log(err);
    })

    socket.on('close', () => {
        console.log('服务端：客户端断开连接');
    });

    let linkStatus = 'setpOne'; //记录当前应该执行那个步骤
    bufferProcess = (socket, data) => {
        if (linkStatus == 'setpOne') {
            streamProcess(data)
            firstLinkProcess(socket, data);
        } else if (linkStatus == 'setpTwo') {
            reProcess(data);
        } else if (linkStatus == 'proxy') {
            remote.write(data);
        }

    }

    let bufferFlag = 0; //记录当前的bufferData的下标，方便下次读取
    let bufferData = Buffer.alloc(16384); //持续保存当前客户端传过来的数据
    //第一个参数是onData穿过来的数据，第二个参数是现在这个链接的步骤，需要几个字节。
    streamProcess = (data) => {
        bufferFlag = bufferData.length + data.length;
        bufferData = Buffer.concat([bufferData, data], bufferFlag);
        return console.log(bufferData.length);
    }


    //第一次link的处理
    firstLinkProcess = (socket, local) => {
        let reBuffer = '';
        const sockesVersion = {
            SOCKES4: '4',
            SOCKES5: '5'
        }
        const sockesMethods = {
            NOAUTH: 0, //无需验证
            GSSAPI: 1, //gssapi方法 参考：https://en.wikipedia.org/wiki/GenericSecurityServicesApplicationProgram_Interface
            USER: 2 //需要账户名和密码认证        
        }

        console.log(`第一次链接处理的参数为:`);
        console.log(local)

        //传进来的本地数据是否满足长度
        if (local.length < 2) {
            return false;
        } else {
            reBuffer = Buffer.alloc(2);
        }

        if (local[0] == sockesVersion.SOCKES5) {
            reBuffer.write('\5', 0);
            let methods = local.slice(1, 2);
            for (let i = 0; i < methods.length; i++) {
                //首选NOAUTH
                if (methods[i] == sockesMethods.NOAUTH) {
                    reBuffer.write('\0', 1);
                } else {
                    console.log(`不支持的加密方法:${methods[i]}`);
                }
            }
        } else if (local[0] == sockesVersion.SOCKES4) {
            //当为socket4时
            reBuffer.write('4', 0);
        } else {
            console.log(`不支持的协议${local[0]}`)
            return false
        }
        linkStatus = 'setpTwo';
        return socket.write(reBuffer);
    }

    //第二次的处理
    let remote = '';
    reProcess = (data) => {
        let ip;
        let deIp;

        let port;
        let dePort;

        console.log('第二次处理的数据:', data);
        if (data.length < 10) {
            return false
        } else {
            ip = data.slice(4, 8);
            deIp = ip.readUInt32BE();

            port = data.slice(8, 10);
            dePort = port.readUInt16BE();
            console.log(_int2iP(deIp), dePort.toString());
        }
        remote = net.createConnection({
            port: 8089,
            host: "127.0.0.1"
        }, () => {
            console.log('remote');
            let cmdBuffer = buildConnectCmd(_int2iP(deIp), dePort.toString());
            let buffer = buildCmd(cmdBuffer);
            remote.write(buffer);
        })

        remote.on('data', (data) => {
            if (linkStatus == 'setpTwo') {
                let cmd = readConnenctBuffer(data);
                if (cmd == '0') {
                    cmd = 0x0;
                } else if (cmd == '1') {
                    cmd = 0x1;
                }
                let buffer = buildLocalCmd(cmd);
                socket.write(buffer);
                linkStatus = 'proxy';
            } else if (linkStatus == 'proxy') {
                console.log(data.length);
                socket.write(data);
            }
        })


    }
}


buildLocalCmd = (cmd) => {
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
    return headBuffer;
}

//解包并且判断是否链接成功
readConnenctBuffer = (data) => {
    let cmdHead = data.readUInt32BE(0, 4);
    let cmdBody = data.slice(4).readUInt8();
    if (!cmdBody == cmdHead) {
        console.log(`收到的命令结构不符${cmdBody}`)
        return false;
    }
    if (cmdBody == '1') {
        console.log('链接失败')
        return cmdBody
    } else if (cmdBody == '0') {
        console.log('链接成功')
        return cmdBody
    }

}

buildCmd = (palyload) => {
    const headBuffer = Buffer.alloc(4);
    headBuffer.writeInt32BE(palyload.length);
    const newBufer = Buffer.concat([headBuffer, palyload], palyload.length + 4);
    return newBufer;
};


buildConnectCmd = (addr, port) => {
    let offset = 0;
    let totalLength = 3 + addr.length + port.length;
    console.log(addr, port);

    const cmd = Buffer.alloc(totalLength);
    cmd.writeUInt8(0, offset);
    offset++;

    cmd.writeUInt8(addr.length, offset);
    offset++;

    cmd.write(addr, offset);
    offset += addr.length;

    cmd.writeUInt8(port.length, offset);
    offset++;

    cmd.write(port, offset);
    console.log(cmd);
    return cmd;
}

function _int2iP(num) {
    var str;
    var tt = new Array();
    tt[0] = (num >>> 24) >>> 0;
    tt[1] = ((num << 8) >>> 24) >>> 0;
    tt[2] = (num << 16) >>> 24;
    tt[3] = (num << 24) >>> 24;
    str = String(tt[0]) + "." + String(tt[1]) + "." + String(tt[2]) + "." + String(tt[3]);
    return str;
}