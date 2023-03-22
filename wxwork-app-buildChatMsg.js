const { encrypt, decrypt, buildNonce, rawSignature } = require('./libs/crypto');

function buildReplyContent(reply) {
  return `<xml>
   <ToUserName><![CDATA[${reply.fromUserName}]]></ToUserName>
   <FromUserName><![CDATA[${reply.toUserName}]]></FromUserName> 
   <CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
   <MsgType><![CDATA[text]]></MsgType>
   <Content><![CDATA[${reply.content}]]></Content>
</xml>`;
}

function buildReplyPayload(config, reply) {
  const encryptReply = encrypt(config, buildReplyContent(reply));
  const timestamp = Date.now();
  const nonce = buildNonce(10);
  return `<xml>
   <Encrypt><![CDATA[${encryptReply}]]></Encrypt>
   <MsgSignature><![CDATA[${rawSignature(
     config,
     timestamp,
     nonce,
     encryptReply,
   )}]]></MsgSignature>
   <TimeStamp>${timestamp}</TimeStamp>
   <Nonce><![CDATA[${nonce}]]></Nonce>
</xml>`;
}

module.exports = function (RED) {
  function WxworkAppBuildChatMsg(n) {
    RED.nodes.createNode(this, n);

    // load from wxworkAppNode
    const wxworkApp = RED.nodes.getNode(n.app);
    const node = this;
    this.on('input', async (msg, send, done) => {
      try {
        node.log(`[build chat msg] start read(${n.property}): `);
        const reply = RED.util.getMessageProperty(msg, n.property);
        node.log(`[build chat msg] reply info: ${JSON.stringify(reply)}`);
        // 用于自动回复消息，暂时都需要单独发请求回复消息
        msg.payload = buildReplyPayload(wxworkApp.cryptoConfig, reply);

        send(msg);
        done();
      } catch (err) {
        done(err);
      }
    });
  }

  RED.nodes.registerType('wxwork-app-buildChatMsg', WxworkAppBuildChatMsg, {});
};
