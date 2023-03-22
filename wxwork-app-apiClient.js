const API_MAP = {
  sendAppMessage: 'requestSendAppMessage',
};

module.exports = function (RED) {
  function WxworkAppInvokeApiClient(n) {
    RED.nodes.createNode(this, n);

    // load from wxworkAppNode
    const wxworkApp = RED.nodes.getNode(n.app);
    const node = this;
    this.on('input', async (msg, send, done) => {
      try {
        const data = RED.util.getMessageProperty(msg, n.property);
        msg.payload = await wxworkApp.apiCleint[API_MAP[n.func]](data);
        send(msg);
        done();
      } catch (err) {
        done(err);
      }
    });
  }

  RED.nodes.registerType('wxwork-app-apiClient', WxworkAppInvokeApiClient, {});
};
