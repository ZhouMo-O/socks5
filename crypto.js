const crypto = require('crypto');
const algorithm = 'aes-256-gcm';
const key = 'key';
const password = crypto.scryptSync(key, 'salt', 32)


const encrypt = (data) => {
    let nonce = crypto.randomBytes(16);
    let cipher = crypto.createCipheriv(algorithm, password, nonce) //加密方法，原始密码，16位的随机混淆 返回一个 cipher对象
    let buf = Buffer.concat([cipher.update(data), cipher.final()]) //加密数据
    let tag = cipher.getAuthTag();
    let cmdHead = Buffer.alloc(4);
    cmdHead.writeUInt32BE(nonce.length + buf.length + tag.length);
    return Buffer.concat([cmdHead, nonce, buf, tag]) //尝试直接返回一个拼接好的数据
}

const decrypt = (data) => {
    let nonce = data.slice(0, 16);
    let palyload = data.slice(16, -16); //前面16个字节的混淆，后面16个字节的tag，去掉就是中间的palyload;
    let tag = data.slice(-16);
    let decipher = crypto.createDecipheriv(algorithm, password, nonce); //返回一个Decipher对象
    decipher.setAuthTag(tag); //在解密之前需要先传入末尾的tag签名;
    let debuf = decipher.update(palyload);
    let defin = decipher.final();
    if (debuf == '') {
        return false;
    } else {
        let buf = Buffer.concat([debuf, defin]); //解密数据
        return buf;
    }
}

module.exports = encrypt;
module.exports = decrypt;