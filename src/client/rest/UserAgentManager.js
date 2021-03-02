const Constants = require("../../util/Constants");

class UserAgentManager {
  constructor() {
    this.build(this.constructor.DEFAULT);
  }

  set({ url, version } = {}) {
    this.build();
  }

  build() {
    this.userAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/0.0.10 Chrome/88.0.4324.192 Electron/7.1.11 Safari/537.36`;
  }
}

module.exports = UserAgentManager;
