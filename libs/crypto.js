const crypto = require('crypto');

/**
 * AES算法pkcs7 padding Decoder
 * @param {Buffer} buff 需要解码的Buffer
 * @returns {Blob|ArrayBuffer|Array.<T>|string|*}
 */
function PKCS7Decoder(buff) {
  let pad = buff[buff.length - 1];
  if (pad < 1 || pad > 32) {
    pad = 0;
  }
  return buff.slice(0, buff.length - pad);
}

/**
 * AES算法pkcs7 padding Encoder
 * @param {Buffer} buff 需要编码码的Buffer
 * @returns {Blob|ArrayBuffer|Array.<T>|string|*}
 */
function PKCS7Encoder(buff) {
  const blockSize = 32;
  const strSize = buff.length;
  const amountToPad = blockSize - (strSize % blockSize);
  const pad = new Buffer(amountToPad - 1);
  pad.fill(String.fromCharCode(amountToPad));
  return Buffer.concat([buff, pad]);
}

/**
 * aes crypto config
 * @typedef {{ corpId: string, token: string, aesKey: string, iv: byte[] }} CryptoConfig
 */

/**
 * 初始化AES解密的配置信息
 * @param {string} corpId 企业微信的corpId，当为第三方套件回调事件时，corpId的内容为suiteId
 * @param {string} token 企业微信的token，当为第三方套件回调事件时，token的内容为套件的token
 * @param {string} encodingAESKey 企业微信的encodingAESKey，当为第三方套件回调事件时，encodingAESKey的内容为套件的encodingAESKey
 * @return {CryptoConfig}
 */
function buildCryptoConfig(corpId, token, encodingAESKey) {
  const aesKey = new Buffer(`${encodingAESKey}=`, 'base64');

  return {
    corpId,
    token,
    aesKey,
    iv: aesKey.slice(0, 16),
  };
}

/**
 * 生成签名
 * @param {CryptoConfig} config
 * @param {string|number} timestamp 时间戳
 * @param {string} nonce 随机串
 * @param {string} encrypt 加密的数据
 * @returns {ArrayBuffer} String 排好序的签名
 */
function rawSignature(config, timestamp, nonce, encrypt) {
  const { token } = config;
  const rawList = [token, timestamp, nonce];
  if (encrypt) rawList.push(encrypt);

  const rawStr = rawList.sort().join('');
  const sha1 = crypto.createHash('sha1');
  sha1.update(rawStr);
  return sha1.digest('hex');
}

/**
 * 对给定的消息进行AES加密
 * @param {CryptoConfig} config
 * @param {string} sourceMsg 需要加密的明文
 * @returns {string} 加密后的结果
 */
function encrypt(config, sourceMsg) {
  const { aesKey, iv, corpId } = config;
  const msg = new Buffer(sourceMsg);
  const random16 = crypto.pseudoRandomBytes(16);
  const msgLen = new Buffer(4);
  msgLen.writeUInt32BE(msg.length, 0);

  const rawMsg = Buffer.concat([random16, msgLen, msg, new Buffer(corpId)]);
  const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
  const cipheredMsg = Buffer.concat([cipher.update(rawMsg), cipher.final()]);
  return cipheredMsg.toString('base64');
}

/**
 * 对给定的密文进行AES解密
 * @param {CryptoConfig} config
 * @param {string} str 需要解密的密文
 * @returns {string} 解密后的结果
 */
function decrypt(config, str) {
  const { aesKey, iv, corpId } = config;
  const aesCipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
  aesCipher.setAutoPadding(false);

  const decipheredBuff = PKCS7Decoder(
    Buffer.concat([aesCipher.update(str, 'base64'), aesCipher.final()]),
  );
  const data = decipheredBuff.slice(16);
  const msgLen = data.slice(0, 4).readUInt32BE(0);

  const decryptCorpId = data.slice(msgLen + 4).toString();

  if (corpId !== decryptCorpId) {
    throw new Error('corpId is invalid');
  }
  return data.slice(4, msgLen + 4).toString();
}

function buildNonce(length = 10) {
  return crypto.randomBytes(length).toString('hex');
}

module.exports = {
  encrypt,
  decrypt,
  buildCryptoConfig,
  buildNonce,
  rawSignature,
};
