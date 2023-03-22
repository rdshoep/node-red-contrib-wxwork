module.exports = function (RED) {
  const { buildCryptoConfig } = require('./libs/crypto');
  const WxworkApiClient = require('./libs/wxwork-api-client');

  function WxworkApp(n) {
    RED.nodes.createNode(this, n);
    this.corpId = n.corpId;
    this.agentId = n.agentId;
    if (n.proxy) {
      this.proxyConfig = RED.nodes.getNode(n.proxy);
    }
    if (
      this.credentials.messageToken &&
      this.credentials.messageEncodingAESKey
    ) {
      this.cryptoConfig = buildCryptoConfig(
        n.corpId,
        this.credentials.messageToken,
        this.credentials.messageEncodingAESKey,
      );
    }
    this.apiCleint = new WxworkApiClient({
      corpId: this.corpId,
      agentId: this.agentId,
      agentSecret: this.credentials.agentSecret,
      proxy: this.proxyConfig,
    });
  }

  RED.nodes.registerType('wxwork app', WxworkApp, {
    credentials: {
      agentSecret: { type: 'password' },
      messageToken: { type: 'password' },
      messageEncodingAESKey: { type: 'password' },
    },
  });
};
