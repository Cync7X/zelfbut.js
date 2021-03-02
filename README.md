# 😎 Zelfbut.js

Modified Discord.js V11 with updated intents, user agents, and compatibility.

## 🛹 Installation

Use the package manager [yarn](https://yarnpkg.com/) to install `Zelfbut.js`.

```bash
yarn add Cync7X/zelfbut.js
```

_You can use [NPM](https://www.npmjs.com/) as well._

## 💻 Usage

```javascript
const Discord = require("discord.js"); // Installs as discord.js
const client = new Discord.Client(); // Initialize a new Client

client.on("ready", () => {
  console.log(`Logged in as ${client.user.username}!`);
});

client.on("message", (message) => {
  if (message.content === "?!!hello") {
    message.delete();
    message.channel.send("Hello, How are you?");
  }
});

client.login(token);
```

## ⚙ Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate.

## © License

**Original Repo:** [discord.js](https://github.com/discordjs) **//**
**Documentation:** [discord.js.org](https://discord.js.org/#/docs/main/11.4.2/general/welcome) **//**
**License:** [Apache](https://github.com/discordjs/discord.js/blob/master/LICENSE)
