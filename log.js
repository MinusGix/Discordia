module.exports = {
	level: 1, 
	/*
		1 normal & warnings & errors
		2 warnings & errors
		3 errors
		4 no logging
	*/
	info (...args) {
		return this.text(...args);
	},
	text (...args) {
		if (1 >= this.level) {
			console.log('[TEXT]:', ...args);
		}
	},
	warn (...args) {
		if (2 >= this.level) {
			console.log('[WARNING]:', ...args);
		}
	},
	error (...args) {
		if (3 >= this.level) {
			console.log('[ERROR]:', ...args);
		}
	}
};