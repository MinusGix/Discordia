/* Notes
	Sadly, shouldn't modify Array.prototype to add my own quick method because it adds them in the other files too
*/
module.exports = Discord => {
	let Parser = require('./textparser.js');
	let Log = require('./log.js');

	console.table = function (...args) {
		console.log('=====================================================================');
		for (let i = 0; i < args.length; i += 2) {
			console.log(args[i], ':', args[i + 1]);
		}
		console.log('=====================================================================');
	}

	

	let Helper = {
		var: { // helpful variables
			commands: {
				set: ["set", "="],

				// math
				add: ["add", "increase", "give", "+"],
				sub: ["sub", "subtract", "decrease", "take", "-"],
				multiply: ["times", "multiply", "x", "*"],
				divideBy: ["divideby", "divide by", "divide_by", "/"],
				divide: ["divide", "a/"],

				// general
				leaderboard: ["leaderboard", "leaders", "topboard", "top"]
			},
			Error: {
				wrong: "wrong argument",
				noCommand: "wrong command",
				noUsers: "no mentions"
			},
			regex: {
				everyone: Discord.MessageMentions.EVERYONE_PATTERN,
				role: Discord.MessageMentions.ROLES_PATTERN,
				user: Discord.MessageMentions.USERS_PATTERN,

				userParen: /\((user(:|=| ).*?#\d+)\)/gi,
				roleParen: /\((role(:|=| ).*?)\)/gi,

			}
		},
		// #region functions
		parseMentions(text, client, guild) {
			let users = Helper.match(text, Helper.var.regex.user)
				.map(userMention => client.users.get(
					userMention.substring(userMention[2] === '!' ? 3 : 2, userMention.length - 1)
				))

				.concat(Helper.match(text, Helper.var.regex.userParen)
					.map(userTag => userTag.substring(6, userTag.length - 1).trim().toLowerCase())
					.map(userTag => client.users.find(
						user => user && user.tag && user.tag.toLowerCase() === userTag
					)))
				
					
				.concat(Helper.match(text, Helper.var.regex.role)
					.map(roleMention => guild.roles.get(roleMention.substring(3, roleMention.length - 1)))
					.concat(Helper.match(text, Helper.var.regex.roleParen)
						.map(roleName => { // 1 map is logically more efficient, though multiple can be easier to quickly read
							roleName = roleName.substring(6, roleName.length - 1).trim().toLowerCase();
							if (roleName === 'everyone') {
								roleName = '@everyone';
							}
							return guild.roles.find(role => role.name.toLowerCase() === roleName)
						})
					)

					.filter(role => Helper.isRole(role))
					.reduce((prev, cur) => prev.concat(cur.members.array()), []));

			let everyoneMatch = Helper.match(text, Helper.var.regex.everyone);
			if (everyoneMatch.length > 0) {
				let everyone = guild.members.array();
				for (let i = 0; i < everyoneMatch.length; i++) {
					users.concat(everyone);
				}
			}

			return users
				.filter(user => Helper.isUser(user, "discord"))
				.map(member => member.user || member);
		},

		capitalize(string, everyWord = false) {
			if (everyWord === true) {
				return string
					.split(' ')
					.map(str => Helper.capitalize(str, false)) // woo, recursiveness
					.join(' ');
			} else {
				return string[0].toUpperCase() + string.substring(1);
			}
		},
		Number(value) { // parse a string to a number, because JS Number is annoying
			if (!Helper.isNumber(value, true)) {
				if (value === '' || value === false || value === null) {
					value = NaN; // these values would normally evaluate to 0
				} else {
					value = Number(value);
				}
			}
			return value;
		},
		getUserByID(userID, guild, client) {
			if (Helper.isUser(userID, "discord")) {
				return userID;
			}

			if (Helper.isUser(userID, "custom")) {
				userID = userID.id;
			}

			if (Helper.isClient(client, "custom")) {
				client = client.client;
			}

			if (Helper.isGuild(guild, "custom")) {
				guild = client.guilds.get(guild.id);
			}

			let user = null;

			if (Helper.isGuild(guild, "discord")) {
				user = guild.members.get(userID);
			}

			if (!Helper.isUser(user, "discord") && Helper.isClient(client, "discord")) {
				user = client.users.get(userID);
			}

			if (!Helper.isUser(user, "discord")) {
				return null;
			}

			return user || null;
		},
		getUser(user, guild, client) {
			return Helper.getUserByID(user.id, guild, client);
		},
		loop(iterator, func) { // just foreach, but it returns the original value
			iterator.forEach(func);
			return iterator;
		},
		flatten(text, separator = " ") { // flattens an array of text into a string, recursively
			let flat = "";

			if (Helper.isString(text)) {
				flat = text;
			} else if (Helper.isArray(text)) {
				for (let i = 0; i < text.length; i++) {
					flat += Helper.flatten(text[i], separator);
					if (i < (text.length - 1)) {
						flat += ' '; // add spaces, except for the last
					}
				}
			} // otherwise ignore it

			return flat || "";
		},
		not(bool) {
			return !!bool;
		},
		run(func, ...args) { // run the function if it is one
			return Helper.isFunction(func) ? func(...args) : func;
		},
		breakFirst(arr, func) { // returns the first truthy value, otherwise null
			for (let i = 0; i < arr.length; i++) {
				if (func(arr[i], i, arr)) {
					return arr[i];
				}
			}
			return null;
		},
		truthy(...args) { // returns first truthy value
			return Helper.breakFirst(args, arg => !!arg);
		},
		precedence(...args) { // returns first value that isn't undefined or null
			return Helper.breakFirst(args, arg => arg !== undefined && arg !== null);
		},
		divide (arr, func, destTrue=[], destFalse=[]) { // essentially filter, but false ones get dumped into a separate array
			arr.forEach((value, index, array) => {
				if (func(value, index, array)) {
					destTrue.push(value);
				} else {
					destFalse.push(value);
				}
			})
			return [destFalse, destTrue];
		},
		hasProperty(val, propName, strict = true) {
			if (Helper.isObject(val)) {
				if (strict === true) {
					return val.hasOwnProperty(propName);
				} else {
					return Object.keys(val).indexOf(propName) !== -1;
				}
			}
			return !!val[propName]; // TODO: Do a better check
		},
		getTypeFunction(type = 'string') {
			// todo: make a quick way of doing this, wrapper function perhaps?
			if (type === 'string') {
				return Helper.isString;
			} else if (type === 'boolean' || type === 'bool') {
				return Helper.isBoolean;
			} else if (type === 'object' || type === 'obj') {
				return Helper.isObject; // TODO: let them decide if it's strict based on string
			} else if (type === 'array' || type === 'arr') {
				return Helper.isArray;
			} else if (type === 'function' || type === 'func') {
				return Helper.isFunction;
			} else if (type === 'message' || type === 'msg') {
				return Helper.isMessage;
			} else if (type === 'channel') {
				return Helper.isChannel;
			} else if (type === 'textchannel' || type === 'text-channel' || type === 'text channel') {
				return Helper.isTextChannel;
			} else if (type === 'guild' || type === 'server') {
				return Helper.isGuild; // TODO: let them decide if the type of guild
			} else if (type === 'member') {
				return Helper.isMember;
			} else if (type === 'command') {
				return Helper.isCommand;
			} else if (type === 'commandlist') {
				return Helper.isCommandList;
			} else if (type === 'client') {
				return Helper.isClient;
			} else if (type === 'regex') {
				return Helper.isRegex;
			}
			Log.warn(`getTypeFunction function ran with invalid type of: '${type}'`);
			return () => false;
		},
		is(val, type = 'or', ...types) {
			if (type === 'or') {
				return Helper.isOR(val, ...types);
			} else if (type === 'and') {
				//return Helper.isAND(val, types); // TODO: implement this
			} else {
				Log.warn(`is function ran with invalid type of: '${type}'`);
				return false;
			}
		},
		isOR(val, ...types) {
			return types.map(type => Helper.getTypeFunction(type)(val)) // turns it into an array of bools
				.reduce((prev, cur) => prev || cur); // shrinks them all into one value
		},
		// #region isType
		isRole (role) {
			return role instanceof Discord.Role;
		},
		isNumber(num, strict = true) {
			return typeof (num) === 'number' && (strict === true ? (!Number.isNaN(num) && num !== Infinity && num !== -Infinity) : true);
		},
		isString(str) {
			return typeof (str) === 'string'; // don't use instanceof, because that doesn't work with normal strings
		},
		isBoolean(bool) {
			return typeof (bool) === 'boolean'; // TODO: make this work on the strings 'true' or 'false', if a strict param is false
		},
		isObject(obj, strict = true) { // if strict, make sure it's not an Array
			return obj instanceof Object && (strict ? !Helper.isArray(obj) : true);
		},
		isArray(arr) {
			return Array.isArray(arr);
		},
		isFunction(func) {
			return func instanceof Function && typeof (func) === 'function';
		},
		isMessage(message) {
			return message instanceof Discord.Message;
		},
		isUser(user, type = "custom") {
			if (type === "discord") {
				return user instanceof Discord.User || user instanceof Discord.GuildMember;
			} else if (type === "custom") {
				return user instanceof User;
			} else {
				Log.warn(`isUser function ran with invalid type of: '${type}'`);
				return false;
			}
		},
		isChannel(channel) {
			return channel instanceof Discord.Channel;
		},
		isTextChannel(channel) {
			return channel instanceof Discord.TextChannel;
		},
		isGuild(guild, type = "custom") {
			if (type === "discord") {
				return guild instanceof Discord.Guild;
			} else if (type === "custom") {
				return guild instanceof Guild;
			} else {
				Log.warn(`isGuild function ran with invalid type of: '${type}'`);
				return false;
			}
		},
		isMember(member) {
			return member instanceof Discord.GuildMember;
		},
		isCommand(command) {
			return command instanceof Command;
		},
		isCommandList(commandList) {
			return commandList instanceof CommandList;
		},
		isClient(client, type = "custom") {
			if (type === "discord") {
				return client instanceof Discord.Client;
			} else if (type === "custom") {
				return client instanceof Client;
			} else {
				Log.warn(`isClient function ran with invalid type of: '${type}'`);
				return false;
			}
		},
		isRegex(regex) {
			return regex instanceof RegExp;
		},
		// #endregion isType
		getPrefix(client, guild) {
			if (Helper.isClient(client) && Helper.isGuild(guild)) {
				return client.defaultPrefix || guild.settings.prefix || 'k!'; // TODO: do more than just nothing if the prefix doesn't exist
			}
			return 'k!'; // default, woo
		},
		match(text, regex) { // a match that always returns an array, for my own sanity
			let result = Helper.precedence(text, '').match(regex);
			if (!Helper.isArray(result)) {
				if (Helper.isString(result)) {
					result = [result];
				} else {
					result = [];
				}
			}
			return result;
		},
		replaceKeyWords(text, args, customCommandName = '') { // TODO: split this out so it can be done without args
			if (Helper.isString(text) && Helper.isObject(args)) {
				return text.replace(/\$prefix/gi, args.prefix)
					.replace(/\$(commandname|command\-name|command\_name|command\.name)/gi, customCommandName ? customCommandName : args.commandName);
			}
			return text; // return it if it didn't work TODO: make this error thing better
		}
		// #endregion functions
	};

	class Storage { // not for storing anything you couldn't store in json
		constructor(initValue = 0) {
			this.store = {};

			this.initValue = initValue;
		}

		static fromData(data, initValue) {
			let storage = new Storage(initValue);

			if (Helper.isObject(data)) {
				storage.store = data.store;
			}

			return storage;
		}

		getData() {
			return {
				store: this.store,
				initValue: this.initValue
			};
		}

		create(key = null, strict = true) {
			if (key) {
				if (strict === true && this.store.hasOwnProperty(key)) {
					return false;
				}
				this.store[key] = this.initValue;
				return true;
			}
			return false;
		}

		set(key = null, val = null) {
			if (key) {
				this.store[key] = val;
				return true;
			}
			return false;
		}

		get(key) {
			if (!this.store.hasOwnProperty(key)) {
				this.create(key);
			}
			return this.store[key];
		}
	}


	class User {
		constructor(id = null) {
			this.id = id; // the id of the user
			this.permissions = {}; // the permissions that the user is allowed to use
			this.storage = new Storage(0);
		}

		static fromData(data, id) {
			let user = new User(id);

			if (Helper.isObject(data)) {
				user.permissions = data.permissions;
				user.storage = Storage.fromData(data.storage, 0);
			}

			return user;
		}

		getData() {
			let user = {};
			user.id = this.id;
			user.permissions = this.permissions;
			user.storage = this.storage.getData();

			return user;
		}
	}
	class Command {
		constructor(name = "", onRun = null, other = null) {
			// the name(s) of the command
			if (!Helper.isArray(name)) {
				name = [name]; // turn it into an array, simplest this way;
			}
			this.name = name // TODO: do more than ignoring they aren't strings
				.filter(commandName => Helper.isString(commandName)) // filter out those that aren't strings
				.map(commandName => commandName.toLowerCase()); // turn all the strings to lowercase

			// ran when the command is run
			if (!Helper.isFunction(onRun)) {
				onRun = args => true;
			}

			this.onRun = onRun;

			// store other functions to be used
			// - allowed <boolean|args{}=>boolean> whether or not to let the command run (though telling them *why* would have to be in the cmd)
			if (!Helper.isObject(other)) {
				other = {};
			}
			this.other = other || {};
		}

		run(args) { // could shorten this too: return this.isAllowed(args) && this.run.call(this, args)
			if (this.isAllowed(args)) { // but that's barely readable
				this.onRun.call(this, args);
				return true;
			}
			return false;
		}

		matchesName(name = '', getIndex = false) { // TODO: Implement a getIndex parameter
			if (Helper.isString(name)) {
				name = name.toLowerCase();

				for (let i = 0; i < this.name.length; i++) {
					if (this.name[i] === name) {
						if (getIndex === true) {
							return i; // returns the index that it's found at
						}
						return true;
					}
				}
			}
			return false;
		}

		isAllowed(args) {
			return Helper.precedence(Helper.run(Helper.precedence(this.other, {}).allowed), true);
		}

		getDescription(args, useText = true) {
			if (Helper.is(this.other.description, 'or', 'function', 'string')) {
				if (useText) {
					return Helper.run(this.other.description, args) + '\n';
				}
				return true;
			}

			if (useText) {
				return 'There is no description for this command.\n';
			}
			return false;
		}

		getUsageInfo(args, useText = true) {
			if (Helper.is(this.other.usage, 'or', 'function', 'string')) {
				if (useText) {
					return Helper.run(this.other.usage, args) + '\n';
				}
				return true;
			}
			if (useText) {
				return 'There is no usage information for this command.\n';
			}
			return false;
		}

		getHelpText(args) {
			let text = '';

			text += this.getDescription(args, true);
			text += this.getUsageInfo(args, true);

			return text;
		}
	}
	class CommandList {
		constructor() {
			this.list = [];
		}
		// #region add command
		// TODO: Shorten addSetterCommand and addStatCommand so they repeat less
		// A function to quickly create commands to store guild specific info. Like Gryffindor's points, etc
		addSetterCommand(name, valueName, type = "string", other = {}) {
			if (!Helper.isObject(other)) {
				other = {};
			}
			if (!Helper.isFunction(other.onModifiedValue)) {
				other.onModifiedValue = (value, args) => args.reply("Value was set too: " + value);
			}
			if (!Helper.isFunction(other.onError)) {
				other.onError = (error, value, args) => {
					if (error === "wrong argument") {
						args.reply("Value was invalid.");
					} else if (error === "wrong command") {
						args.reply("Action was invalid.");
					} else {
						args.reply("Unknown Error.");
					}
				};
			}
			if (!Helper.isFunction(other.onValueRetrieved)) {
				other.onValueRetrieved = (value, args) => args.reply('The value is: ' + value);
			}


			other = Object.assign({ // merge the objects
				valueName,
				type
			}, other);

			let run = function (args) {
				let cmd = Helper.flatten(args.content[1]).toLowerCase();
				let argument = Helper.flatten(args.content[2]).toLowerCase();

				let type = this.other.type;
				let valueName = this.other.valueName;

				let storage = args.customGuild.storage;

				if (!storage.store.hasOwnProperty(valueName)) {
					let value = null;
					if (type === "string") {
						value = "";
					} else if (type === "number") {
						value = 0;
					}
					storage.set(valueName, value);
				}

				if (cmd === "" || !Helper.isString(cmd) || cmd === "get" || cmd === "check") {
					return this.other.onValueRetrieved(storage.get(valueName), args);
				}


				if (type === "string") {
					if (Helper.var.commands.set.includes(cmd)) {
						if (argument === "" || !Helper.isString(argument)) {
							return this.other.onError(Helper.var.Error.wrong, argument, args);
						}
						storage.set(valueName, argument);
					} else {
						return this.other.onError(Helper.var.Error.noCommand, argument, args);
					}
				} else if (type === "number") {
					argument = Helper.Number(argument);

					if (!Helper.isNumber(argument, true)) {
						return this.other.onError(Helper.var.Error.wrong, argument, args);
					}

					let storageValue = storage.get(valueName);

					if (Helper.var.commands.set.includes(cmd)) { // set
						storageValue = argument;
					} else if (Helper.var.commands.add.includes(cmd)) { // addition
						storageValue += argument;
					} else if (Helper.var.commands.sub.includes(cmd)) { // subtract
						storageValue -= argument;
					} else if (Helper.var.commands.multiply.includes(cmd)) { // multiple
						storageValue *= argument;
					} else if (Helper.var.commands.divideBy.includes(cmd)) { // divide by
						storageValue /= argument;
					} else if (Helper.var.commands.divide.includes(cmd)) { // divide
						storageValue = argument / storageValue;
					} else {
						return this.other.onError(Helper.var.Error.noCommand, argument, args);
					}

					storage.set(valueName, storageValue);
					return this.other.onModifiedValue(storageValue, args);
				} else {
					// this is more of an internal problem TODO: make this better
					return this.other.onError(Helper.var.Error.noCommand, argument, args);
				}
			}

			let command = new Command(name, run, other);

			this.addCommand(command);

			return command;
		}
		/* 
			A function to quickly create commands that are like:
			!commandname set x @user1 @role1 @user2 @all
			TODO: add better specification on type like:
			number.integer.positive means that it must be a number, an integer, and non-negative
			string#lowercase#reverse means that before storing it will be lowercased, then reversed
			string.length>=5#lowercase means the length must be greater than or equal to 5, then it will be lowercased
		*/
		addStatCommand(name, valueName, type = "string", other = {}) {
			if (!Helper.isArray(name)) {
				name = [name];
			}

			if (!Helper.isString(valueName)) {
				Log.warn(`valueName in the ${name[0]} command is not a string.`);
			}

			// #region other
			if (!Helper.isObject(other)) {
				other = {};
			}
			if (!Helper.isFunction(other.onModifiedValue)) {
				other.onModifiedValue = (value, users, args) => null;
			}
			if (!Helper.isFunction(other.onError)) {
				other.onError = (error, value, users, args) => {
					if (error === "wrong argument") {
						args.reply("Value was invalid.");
					} else if (error === "wrong command") {
						args.reply("Action was invalid.");
					} else if (error === "no mentions") {
						args.reply("No users were mentioned.");
					} else {
						Log.warn(`Stat command with the valueName: '${valueName}' gave an unknown error of: '${error}'`);
						args.reply("Unknown Error.");
					}
				};
			}
			if (!Helper.isFunction(other.onValueRetrieved)) {
				other.onValueRetrieved = (users, args) => args.reply('Values:\n' + users.map(user => Helper.getUser(user, args.guild, args.Client).displayName + ' : ' + user.storage.get(valueName)).join('\n'));
			}

			// leaderboard
			if (!Helper.isObject(other.leaderboard)) {
				other.leaderboard = {};
			}
			if (!Helper.isBoolean(other.leaderboard.allowed)) {
				other.leaderboard.allowed = true; // whether there should be a leaderboard
			}
			if (!Helper.isNumber(other.leaderboard.entries)) {
				other.leaderboard.entries = 10; // the amount of entries to show
			}
			if (!Helper.isBoolean(other.leaderboard.displayNonMembers)) {
				Helper.displayNonMembers = false; // whether or not to display users who've left
			}

			// Help/Description
			if (!Helper.isFunction(other.description) && !Helper.isString(other.description)) {
				other.description = 'Stores a stat for each user in the form of a ' + type + '.';
			}

			if (!Helper.isFunction(other.usage) && !Helper.isString(other.usage)) {
				let pre = '`$prefix$commandName'
				other.usage = pre + "` - Acquires the value stored.\n";
				other.usage += pre + " [mention]+` - Gets mentioned user's values.\n";
				other.usage += pre + " set [value] [mention]+` - Sets value of each mentioned user.\n";
				
				if (type === 'number') {
					other.usage += pre + " add [value] [mention]+` - Adds value to each mentioned user. (user+value)\n";
					other.usage += pre + " sub [value] [mention]+` - Subtracts value from each mentioned user. (user-value)\n";
					other.usage += pre + " multiply [value] [mention]+` - Multiply each mentioned user by value. (user*value)\n";
					other.usage += pre + " divideby [value] [mention]+` - Divides each mentioned user by value. (user/value)\n";
					other.usage += pre + " divide [value] [mention]+` - Divides value by each mentioned user, and sets it. (value/user).\n";
					
					if (other.leaderboard.allowed) {
						other.usage += pre + " leaderboard` - Generates a top " + other.leaderboard.entries + " leaderboard.";
					}
				}
			}

			other = Object.assign({ // merge the objects
				valueName,
				type
			}, other);
			// #endregion other

			let run = function (args) {
				let cmd = Helper.flatten(args.content[1]).toLowerCase();
				let argument = Helper.flatten(args.content[2]).toLowerCase();

				let mentions = Helper.parseMentions(args.message.content, args.Client.client, args.guild)
					.map(user => args.customGuild.getUserByID(user.id));

				let type = this.other.type;
				let valueName = this.other.valueName;
				
				let cmdMentions = Helper.parseMentions(cmd, args.Client.client, args.guild);
				if (!Helper.isString(cmd) || cmd === "" || cmd === "get" || cmd === "check" || cmdMentions.length > 0) {
					if (mentions.length === 0) {
						mentions = [args.User];
					}

					return this.other.onValueRetrieved(mentions, args);
				}

				// TODO make this not depend on repeated code
				if (mentions.length === 0 && !(Helper.var.commands.leaderboard.includes(cmd) && this.other.leaderboard.allowed === true)) { // TODO: make so it complains about the argument before users
					return this.other.onError(Helper.var.Error.noUsers, argument, mentions, args);
				}

				if (type === "string") {
					if (Helper.var.commands.set.includes(cmd)) {
						if (argument === "" || !Helper.isString()) {
							return this.other.onError(Helper.var.Error.wrong, argument, mentions, args);
						}

						mentions.forEach(user => user.storage.set(valueName, argument));
					} else {
						return this.other.onError(Helper.var.Error.noCommand, argument, mentions, args);
					}
				} else if (type === "number") {
					argument = Helper.Number(argument);
					// TODO make this not depend on repeated code
					if (!Helper.isNumber(argument, true) && !(Helper.var.commands.leaderboard.includes(cmd) && this.other.leaderboard.allowed === true)) {
						return this.other.onError(Helper.var.Error.wrong, argument, mentions, args);
					}

					if (Helper.var.commands.set.includes(cmd)) {
						mentions.forEach(user => user.storage.set(valueName, argument));
					} else if (Helper.var.commands.add.includes(cmd)) {
						mentions.forEach(user => user.storage.set(valueName, argument + user.storage.get(valueName)));
					} else if (Helper.var.commands.sub.includes(cmd)) {
						mentions.forEach(user => user.storage.set(valueName, user.storage.get(valueName) - argument));
					} else if (Helper.var.commands.multiply.includes(cmd)) {
						mentions.forEach(user => user.storage.set(valueName, argument * user.storage.get(valueName)));
					} else if (Helper.var.commands.divideBy.includes(cmd)) {
						mentions.forEach(user => user.storage.set(valueName, user.storage.get(valueName) / argument));
					} else if (Helper.var.commands.divide.includes(cmd)) {
						mentions.forEach(user => user.storage.set(valueName, argument / user.storage.get(valueName)));
					} else if (Helper.var.commands.leaderboard.includes(cmd) && this.other.leaderboard.allowed === true) { // leaderboard
						let results = Object.values(args.customGuild.Users)
							.map(customUser => [args.guild.members.get(customUser.id) || null, customUser.storage.get(valueName)])
							.filter(infoUser => Helper.isUser(infoUser[0], "discord")) // filter out null users
							.filter(infoUser => this.other.leaderboard.displayNonMembers || Helper.isMember(infoUser[0]))
							.slice(0, this.other.leaderboard.entries); // limit it
													
						results.sort((numA, numB) => numB[1] - numA[1]); // sort it greatest to least
	
						return args.send(results 
							.reduce((prev, cur) => `${prev}\n*${cur[0].displayName || cur[0].username}* : ${cur[1]}`,
								'**Leaderboard:**'
							));
					} else {
						return this.other.onError(Helper.var.Error.noCommand, argument, mentions, args);
					}
				} else {
					// This is more of an internal problem, since the type is wrong TODO: make this better
					return this.other.onError(Helper.var.Error.noCommand, argument, mentions, args);
				}

				return this.other.onModifiedValue(argument, mentions, args);
			}

			let command = new Command(name, run, other);

			this.addCommand(command);

			return command;
		}
		addCommand(...args) {
			if (Helper.isCommand(args[0])) {
				this.list.push(args[0]);
			} else {
				this.list.push(new Command(...args));
			}
			return true;
		}
		// #endregion add command
		// #region run command
		runCommandByName(name, args) {
			return this.runCommand(this.findCommand(name, false), args);
		}
		runCommand(command, args) {
			return command.run(args);
		}
		// #endregion run command
		// #region find command
		findCommand(value = null) {
			if (Helper.isCommand(value)) { // they want to find the index, since they have the command
				return this.findCommandByName(value.name, true);
			} else { // assumes it's a string TODO: don't do this+
				return this.findCommandByName(value, false);
			}
		}
		findCommandByName(name = "", getIndex = false) {
			this.list.filter(command => Helper.isCommand(command))
			for (let i = 0; i < this.list.length; i++) {
				if (Helper.isCommand(this.list[i])) {
					if (this.list[i].matchesName(name, false)) {
						if (getIndex) {
							return i; // returns the index that the command is in the list
						}
						return this.list[i];
					}
				}
			}
			return null;
		}
		// #endregion find command
		// #region remove command
		removeCommandByName(name = "") {
			let index = this.findCommand(name, true);
			return this.removeCommandByIndex(index);
		}
		removeCommandByIndex(index = -1) {
			if (index >= 0) {
				this.list.splice(index, 1);
				return true;
			}
			return false;
		}
		// #endregion remove command
	}
	class Guild {
		constructor(id = null) {
			this.id = id;
			this.settings = {};
			this.storage = new Storage(0);

			this.Users = {};

			this.Commands = new CommandList();
		}

		static fromData(data, id) {
			let guild = new Guild(id);

			if (Helper.isObject(data) && data.isValid === true) {
				guild.settings = data.settings;
				guild.storage = Storage.fromData(data.storage, 0);

				for (let i in data.Users) {
					guild.Users[i] = User.fromData(data.Users[i], data.Users[i].id);
				}
			}

			return guild;
		}

		getData() {
			let guild = {
				isValid: true,

				settings: {},
				storage: {},
				Users: {}
			};
			// REMINDER: Once you implement custom commands, make sure to save them
			guild.id = this.id; // not exactly needed
			guild.settings = this.settings || {}; // just directly copy it // TODO: do something better than this
			guild.storage = this.storage.getData();

			for (let i in this.Users) {
				guild.Users[i] = this.Users[i].getData();
			}

			return guild;
		}
		// #region user
		userExists(userID = null) {
			return this.isUser(this.Users[userID], "custom");
		}

		isUser(user = null, type = "custom") {
			return Helper.isUser(user, type);
		}

		createUser(userID = null, strict = true) {
			if (strict === true) {
				if (this.userExists(userID)) {
					return this.Users[userID];
				}
			}
			this.Users[userID] = new User(userID, this);
			return this.Users[userID];
		}

		getUserByID(userID = null) {
			return this.createUser(userID, true); // creates it if it doesn't exist, otherwise gets the user
		}

		getUser(user = null) {
			if (this.isUser(user, "discord")) {
				return this.getUserByID(user.id);
			} else if (this.isUser(user, "custom")) {
				return user; // it's already a user
			}
			return null;
		}
		// #endregion user
	}

	class Client {
		constructor(token = null) {
			this.client = new Discord.Client();
			this.token = token;

			this.Guilds = {};

			this.Commands = new CommandList();

			this.defaultPrefix = "k!";

			// all of them should have a help command
			this.Commands.addCommand(["help", "h", "commands", "cmds"], args => {
				let firstParameter = Helper.flatten(args.content[1]);
				if (Helper.isString(firstParameter) && firstParameter) {
					let command = args.Client.findCommand(firstParameter, args.customGuild);

					if (Helper.isCommand(command) && command.isAllowed(args)) {
						args.reply(Helper.replaceKeyWords(command.getHelpText(args), args, firstParameter));
					} else {
						args.reply('Sorry, but that command was not found.');
					}
				} else {
					let prefix = args.prefix;
					let commands = Helper.divide(
						args.Client.Commands.list.concat(args.customGuild.Commands.list),
						(command) => Helper.isCommand(command))
					
					if (commands[0].length > 0) { // if there's non-commands
						Log.warn(`There was ${commands[0].length} items inside the command list for the Client and/or the guild with the id: '${args.customGuild.id}'\nthat are not valid commands.`);
					}

					args.reply('**Commands**:\n' + commands[1]
						.filter(command => command.isAllowed(args))
						.map(command => prefix + command.name[0])
						.join(', ') + '.');
				}
			}, {
				allowed: true,
				description: "Gets the list of commands, or acquires the description of a command.",
				usage: "`$prefix$commandname` acquires the list of commands\n`$prefix$commandname [command]` gets the help information for [command]`"
			});

			this.client.on('ready', _ => Log.info('Logged in'));

			this.client.on('message', message => {
				let {
					member,
					content,
					guild,
					channel
				} = message;

				// messages from self will show up as "ignoring message"
				if (!(
						Helper.isMessage(message) && // makes sure this is a message
						Helper.isChannel(channel) && // makes sure this is a channel
						Helper.isTextChannel(channel) && // make sure this is a textchannel, not a DM/Voice/etc
						Helper.isGuild(guild, 'discord') && // make sure this is an actual guild, just in case
						guild.available === true && // make sure the guild isn't having an outage
						Helper.isString(content) && // make sure there's actual text
						Helper.isMember(member) && // make sure it's an actual member; leaving guild won't break it (hopefully)
						member.id !== this.client.user.id // ignore itself
					)) {
					return Log.info('ignoring message');
				}


				let customGuild = this.getGuild(guild);

				if (!Helper.isGuild(customGuild, "custom")) {
					// shouldn't send anything in a chat that there is an error, since it might not be a command
					return Log.warn("There was a problem with getting a custom guild from a guild. :(");
				}

				let prefix = Helper.getPrefix(this, customGuild);

				if (!(
						Helper.isString(prefix) && // make sure the prefix exists
						content.startsWith(prefix) // make sure the text starts with the prefix, otherwise it isn't a command
					)) {
					return Log.info('ignoring non-command');
				}

				content = Parser.parse(content, true); // parses it in to an array, useful

				if (!Helper.isString(content[0])) { // make sure the first is a string
					return Log.warn(`Possible issue with Parser, as content[0] is not a string. It's value is: '${content[0]}'`);
				}

				let commandName = content[0].substring(prefix.length).toLowerCase(); //gets the text after the prefix & make it lowercase
				let command = this.findCommand(commandName, customGuild);

				// DEBUG information
				console.table('content', content, 'prefix', prefix, 'commandName', commandName, 'command', command);

				if (!Helper.isCommand(command)) { // should work
					let allowedToTell = Helper.precedence(customGuild.settings.canTellNonCommand, "Sorry, but that is not a command.");

					if (allowedToTell === false) return;

					return message.reply(allowedToTell);
				}

				let User = customGuild.getUser(message.member);

				customGuild.Commands.runCommand(command, {
					Client: this,

					commandName, // stores the name, especially as it's the one it was called with

					message, // <Message> the message
					get prefix() {
						return Helper.getPrefix(this, customGuild); // so even if it updates while it's doing something it will update here
					},

					mentions: message.mentions,
					mentionsMembers: message.mentions.members.array(), // fine to keep it here since we ignore outside of textchannels

					User,

					member, // <Discord.GuildMember> the author of the message
					memberID: member.id, // <ID> the id of the author of the message
					memberName: member.displayName, // <String> the name of the author of the message

					customGuild, // <Guild>

					guild, // <Discord.Guild>
					guildID: guild.id, // <ID>
					guildIcon: guild.iconURL, // <String>
					guildChannels: guild.channels, // <Collection{<ID>:<Discord.GuildChannel>}>
					guildEmotes: guild.emojis, // <Collection{<ID>:<Discord.Emoji>}>
					guildMembers: guild.members, // <Collection{<ID>:<Discord.GuildMember>}>
					guildName: guild.name, // <String> name of the guild
					guildOwnerMember: guild.owner, // <Discord.GuildMember> Owner of the guild
					guildRoles: guild.roles, // <Collection{<ID>:<Discord.Role>}>
					guildBan: guild.ban.bind(guild), // bans a user from the guild (needs-perms)

					channel, // <Discord.Channel> The channel the message was sent in
					channelID: message.channel.id, // <ID> The ID of the channel the message was sent in

					content, // <[String+|Self*]>
					Helper,
					command, // <Command>
					prefix, // <String>
					// functions
					isAvailable() {
						return guild.available;
					},
					reply: message.reply.bind(message), // replies with an @ to the member at the start (needs-perms)
					send: message.channel.send.bind(message.channel), // sends a message to the same channel (needs-perms)
					clearReactions: message.clearReactions.bind(message), // clears all the reactions (needs-perms)
					createReactionCollector: message.createReactionCollector.bind(message), // collects any reactions that are added
					delete: message.delete.bind(message), // deletes the message (needs-perms)
					isMemberMentioned: message.isMemberMentioned.bind(message), // tells you if a member was mentioned, @role/@everyone/@member/@user
					isMentioned: message.isMentioned.bind(message), // checks if a #channel/@User/@Role/id was mentioned
					pin: message.pin.bind(message), // pins the messages (needs-perms)
					unpin: message.unpin.bind(message), // unpins the message (needs-perms)
					react: message.react.bind(message), // reacts with an emoji (string|Emoji|ReactionEmoji) (needs-perms)

				});
			});
		}

		static fromData(data, token) {
			let client = new Client(token);

			if (Helper.isObject(data) && data.isValid === true) { // data.isValid is to make sure that it's not just an empty object
				client.prefix = data.prefix;

				for (let i in data.Guilds) {
					client.Guilds[i] = Guild.fromData(data.Guilds[i], data.Guilds[i].id);
				}
			}

			return client;
		}

		getData() { // function to get Data that should be stored
			let client = {
				isValid: true,

				prefix: this.defaultPrefix,

				Guilds: {}
			};
			for (let i in this.Guilds) {
				client.Guilds[i] = this.Guilds[i].getData();
			}
			return client;
		}

		login() {
			this.client.login(this.token).catch(reason => {
				throw new Error('Error on login: ' + reason);
			});
		}

		findCommand(thing, guild) {
			let command = this.Commands.findCommand(thing);

			if (!(
					Helper.isCommand(command) &&
					Helper.isGuild(guild)
				)) {
				command = guild.Commands.findCommand(thing);
			}

			return command || null;
		}


		// #region guild
		guildExists(guildID) {
			return this.isGuild(this.Guilds[guildID], "custom");
		}

		isGuild(guild, type = "custom") {
			return Helper.isGuild(guild, type);
		}

		createGuild(guildID, strict = true) { // does *not* care whether it already exists, it *will* overwrite the old
			if (strict === true) {
				if (this.guildExists(guildID)) {
					return this.Guilds[guildID];
				}
			}
			this.Guilds[guildID] = new Guild(guildID);
			return this.Guilds[guildID];
		}

		getGuildByID(guildID) {
			return this.createGuild(guildID, true);
		}

		getGuild(guild) {
			if (this.isGuild(guild, "discord")) {
				return this.getGuildByID(guild.id);
			} else if (this.isGuild(guild, "custom")) {
				return guild; // it's already a user
			}
			return null;
		}
		// #endregion guild
	}

	return {
		Discord,
		Client,
		Guild,
		User,
		Command,
		CommandList,
		Storage,
		Helper,
		Log
	};
}