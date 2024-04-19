const path = require("path");

/** @type {import("eslint-define-config").ESLintConfig} */
const eslintConfig = {
	extends: [path.resolve(__dirname, "../../.eslintrc.cjs")],
	root: true,
	settings: {
		"import/resolver": {
			typescript: {
				project: path.resolve(__dirname, "tsconfig.json")
			}
		}
	},
	rules: {
		"import/no-extraneous-dependencies": [
			"error",
			{
				devDependencies: [],
				includeInternal: false,
				includeTypes: false,
				packageDir: [__dirname, path.resolve(__dirname, "../..")]
			}
		]
	},
	overrides: [
		{
			files: ["**/*.ts", "**/*.tsx"],
			parserOptions: {
				project: [path.resolve(__dirname, "tsconfig.json")]
			}
		}
	]
};

module.exports = eslintConfig;
