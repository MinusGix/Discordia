function getNested(value = {}, nested = []) {
	for (let i = 0; i < nested.length; i++) {
		value = value[nested[i]];
	}
	return value;
}

function parse(text = '', shouldFlatten = true) {
	let result = {
		type: 'root',
		children: []
	}; // the result
	let currentNest = []; // the nest array

	let pointer = 0; // the current position

	// the current character, or a custom one
	let current = point => typeof (point) === 'number' ? text[point] : text[pointer];

	let char = _ => {
		let parentType = getNested(result, currentNest).type;
		if ((current() === '"' || current() === "'" || current() === '(') && parentType !== 'quote') {
			let quoteMatch = current();
			
			if (quoteMatch === '(') {
				quoteMatch = ')';
			} else {
				pointer++; // get past that quote mark
			}

			getNested(result, currentNest).children.push({
				type: 'quote',
				attribute: quoteMatch, // the one it is
				children: []
			});
			currentNest.push('children', getNested(result, currentNest).children.length - 1);
			while (true) {

				if (current() === quoteMatch || pointer >= text.length) {
					if (quoteMatch === ')') {
						char();
					}
					pointer++;
					break; // end the while loop
				}

				char();
			}
			currentNest.pop();
			currentNest.pop();
		/*} else if (current() === '(' && parentType !== 'quote') {
			let containerMatch = current();

			if (containerMatch === '(') containerMatch = ')';
			else if (containerMatch === '{') containerMatch = '}';
			else if (containerMatch === '[') containerMatch = ']';
			else return;

			pointer++; // get past that paren mark

			getNested(result, currentNest).children.push({
				type: 'container',
				children: []
			});
			currentNest.push('children', getNested(result, currentNest).children.length - 1);
			while (true) {

				if (current() === containerMatch || pointer >= text.length) {
					pointer++;
					break; // end the while loop
				}

				char();
			}
			currentNest.pop();
			currentNest.pop();*/
		} else {
			let nest = getNested(result, currentNest);
			if (current() === ' ') {
				nest.children.push('');
			} else if (typeof (nest.children[nest.children.length - 1]) === 'string') {
				nest.children[nest.children.length - 1] += current();
			} else {
				nest.children.push(current());
			}
			pointer++;
		}
	}

	while (pointer < text.length) {
		char();
	}

	if (shouldFlatten) {
		let flatten = token => {
			let ret = [];
			for (let i = 0; i < token.children.length; i++) {
				let tok = token.children[i];

				if (typeof (tok) === 'string') {
					if (tok === '' || tok === ' ') {
						continue;
					}
					ret.push(tok);
				} else if (typeof (tok) === 'object') {
					if (tok.type === 'quote') {
						ret.push(tok.children.join(' '));
					} else if (tok.type === 'container') {
						ret.push(flatten(tok));
					}
				}
			}
			return ret;
		}

		result = flatten(result);
	}
	return result;
}

module.exports = {parse,getNested};