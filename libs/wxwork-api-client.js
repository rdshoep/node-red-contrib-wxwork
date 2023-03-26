const { HttpProxyAgent, HttpsProxyAgent } = require('hpagent');
const { URL } = require('url');
const Axios = require('axios');

/**
 * wechat app api client option
 * @typedef {{ corpId: string, agentId: string, agentSecret: string, proxy: object|null|undefined }} WxworkApiOption
 */

class WxworkApiClient {
  /**
   * @param {WxworkApiOption} options
   */
  accessToken = undefined;

  accessTokenExpireIn = 0;

  constructor(options) {
    const axiosConfig = {
      baseURL: 'https://qyapi.weixin.qq.com/cgi-bin/',
      timeout: 10000,
    };
    this.setupProxyInfo(axiosConfig, options);
    this.axios = Axios.create(axiosConfig);
    this.options = options;
  }

  // same to the node-red http-request node
  // https://github.com/node-red/node-red/blob/master/packages/node_modules/%40node-red/nodes/core/network/21-httprequest.js#L520
  setupProxyInfo(axiosConfig, options) {
    let proxyUrl = process.env.http_proxy || process.env.HTTP_PROXY;
    let noproxy = (process.env.no_proxy || process.env.NO_PROXY || '').split(',');
    const proxyConfig = options.proxy;
    if (proxyConfig) {
      proxyUrl = proxyConfig.url;
      noproxy = proxyConfig.noproxy;
    }

    const enable = proxyUrl && noproxy.every(url => axiosConfig.baseURL.indexOf(url) <= 0);
    if (enable) {
      const proxyURL = new URL(proxyUrl);
      const proxyOptions = {
        proxy: {
          protocol: proxyURL.protocol,
          hostname: proxyURL.hostname,
          port: proxyURL.port,
          username: null,
          password: null,
        },
        maxFreeSockets: 256,
        maxSockets: 256,
        keepAlive: true,
      };
      if (proxyConfig && proxyConfig.credentials) {
        const proxyUsername = proxyConfig.credentials.username || '';
        const proxyPassword = proxyConfig.credentials.password || '';
        if (proxyUsername || proxyPassword) {
          proxyOptions.proxy.username = proxyUsername;
          proxyOptions.proxy.password = proxyPassword;
        }
      } else if (proxyURL.username || proxyURL.password) {
        proxyOptions.proxy.username = proxyURL.username;
        proxyOptions.proxy.password = proxyURL.password;
      }
      axiosConfig.httpAgent = new HttpProxyAgent(proxyOptions);
      axiosConfig.httpsAgent = new HttpsProxyAgent(proxyOptions);
    }
    return axiosConfig;
  }

  //  获取token
  async getAccessToken() {
    if (this.accessToken && this.accessTokenExpireIn > Date.now())
      return this.accessToken;

    try {
      if (!this.requestTokenPromise) {
        this.requestTokenPromise = this.requestAccessToken();
      }
      const data = await this.requestTokenPromise;
      this.accessToken = data.access_token;
      this.accessTokenExpireIn = data.expires_in * 1000 + Date.now();
    } catch (err) {
      throw err;
    } finally {
      this.requestTokenPromise = null;
    }

    return this.accessToken;
  }

  async requestAccessToken() {
    const { corpId, agentSecret } = this.options;
    const { data } = await this.axios.get(
      `gettoken?corpid=${corpId}&corpsecret=${agentSecret}`,
    );
    return data;
  }

  async requestSendAppMessage(message) {
    const assess_token = await this.getAccessToken();
    return this.axios
      .post(`message/send?access_token=${assess_token}`, {
        ...message,
        agentid: this.options.agentId,
      })
      .then((res) => res.data);
  }
}

module.exports = WxworkApiClient;
