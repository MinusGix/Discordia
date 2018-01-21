module.exports = {
	level: 1, 
	/*
		1 normal & warnings & errors
		2 warnings & errors
		3 errors
		4 no logging
	*/
	log (text, args) {
		console.log('[' + text.toUpperCase() + ']:', ...args);
	},
	info (...args) {
		return this.text(...args);
	},
	text (...args) {
		if (1 >= this.level) {
			this.log('info', args);
		}
	},
	warn (...args) {
		if (2 >= this.level) {
			this.log('warning', args);
		}
	},
	error (...args) {
		if (3 >= this.level) {
			this.log('error', args);
		}
	}
};