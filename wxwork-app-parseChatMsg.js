module.exports = function (RED) {
  function WxworkAppParseChatMsg(n) {
    RED.nodes.createNode(this, n);

    const { decrypt } = require('./libs/crypto');
    const { parseString } = require('xml2js');
    const _ = require('lodash');
    const util = require('util');

    function convertChatXmlJsonToJsStyle(xmlJson) {
      return _.fromPairs(
        _.toPairs(xmlJson).map(([key, value]) => [
          _.camelCase(key),
          _.isArray(value) ? value[0] : value,
        ]),
      );
    }

    // load from wxworkAppNode
    const wxworkApp = RED.nodes.getNode(n.app);
    const isAuthMode = n.mode === 'auth';
    const node = this;
    this.on('input', async (msg, send, done) => {
      if (isAuthMode) {
        try {
          node.debug('[chat msg]enter auth mode');
          const echostr = _.get(msg, 'req.query.echostr');
          msg.payload = decrypt(wxworkApp.cryptoConfig, echostr);
          send(msg);
          done();
        } catch (err) {
          done(err);
        }
        return;
      }

      try {
        const parseXmlPromise = util.promisify(parseString);
        let requestContent = msg.payload;
        if (_.isString(requestContent)) {
          requestContent = await parseXmlPromise(msg.payload, { trim: true });
        }
        const encryptContent = _.get(requestContent, 'xml.Encrypt[0]');
        const content = decrypt(wxworkApp.cryptoConfig, encryptContent);
        node.debug(`[chat msg]enter parser mode, receive msg: ${content}`);
        const xml = await parseXmlPromise(content, { trim: true });
        msg.chatMsg = convertChatXmlJsonToJsStyle(_.get(xml, 'xml'));
        // 用于自动回复消息，暂时都需要单独发请求回复消息
        send(msg);
        done();
      } catch (err) {
        done(err);
      }
    });
  }

  RED.nodes.registerType('wxwork-app-parseChatMsg', WxworkAppParseChatMsg, {});
};
