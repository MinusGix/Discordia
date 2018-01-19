# Zwist

Classes, and functions, to make developing a bot easier.

## Includes

* Command system
* Storage per user/guild
* Quickly create a stat command (like a gold amount for each users)
* Quickly create a point command (like keeping track of Gryffindor's House Points in each server)
* Commands specific to a guild (Should work, haven't tested)
* Default help command
* Some other stuff

## Example

```javascript
let Discord = require('Zwist')(require('discord.js'));

let Client = new Discord.Client('token');

Client.Commands.addCommand("ping", (args) => args.reply("pong"));

Client.Commands.addStatCommand("gold", "gold", "number", {
    onModifiedValue: (value, users, args) => args.reply('Succeeded in operation.')
});

Client.Commands.addCommand(["multiple", "names"], (args) => args.reply("You used: " + args.commandName));
```
