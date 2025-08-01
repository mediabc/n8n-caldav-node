module.exports = {
	root: true,
	env: {
		browser: false,
		es6: true,
		node: true,
	},
	parser: '@typescript-eslint/parser',
	parserOptions: {
		project: 'tsconfig.json',
		sourceType: 'module',
		extraFileExtensions: ['.json'],
	},
	plugins: ['@typescript-eslint'],
	extends: [
		'eslint:recommended',
		'plugin:@typescript-eslint/recommended',
		'plugin:n8n-nodes-base/nodes',
	],
	rules: {
		'n8n-nodes-base/node-dirname-against-convention': 'error',
		'n8n-nodes-base/node-class-description-inputs-wrong-regular-node': 'off',
		'n8n-nodes-base/node-class-description-outputs-wrong': 'off',
		'n8n-nodes-base/node-filename-against-convention': 'error',
	},
	overrides: [
		{
			files: ['credentials/**/*.ts'],
			rules: {
				'n8n-nodes-base/cred-class-field-authenticate-type-assertion': 'error',
				'n8n-nodes-base/cred-class-field-display-name-miscased': 'error',
				'n8n-nodes-base/cred-class-name-unsuffixed': 'error',
				'n8n-nodes-base/cred-filename-against-convention': 'error',
			},
		},
		{
			files: ['package.json'],
			parserOptions: {
				project: null,
			},
		},
	],
}; 