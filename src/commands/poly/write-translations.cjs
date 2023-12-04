const fs = require("fs");
const path = require("path");

function readJSONFilesFromDir(dirPath) {
	const translations = {};
	const files = fs.readdirSync(dirPath);

	for (const file of files) {
		const filePath = path.join(dirPath, file);
		const fileContents = fs.readFileSync(filePath, "utf8");
		Object.assign(translations, JSON.parse(fileContents));
	}

	return translations;
}

// Deep merge function
function deepMerge(target, source) {
	for (const key in source) {
		if (
			source[key] &&
			typeof source[key] === "object" &&
			!Array.isArray(source[key])
		) {
			target[key] = target[key] || {};
			deepMerge(target[key], source[key]);
		} else {
			target[key] = source[key];
		}
	}
	return target;
}

function createASTNodeFromValue(j, value) {
	if (value === null) {
		return j.literal(null);
	}
	if (typeof value === "string") {
		return j.stringLiteral(value);
	}
	if (typeof value === "number") {
		return j.numericLiteral(value);
	}
	if (typeof value === "boolean") {
		return j.booleanLiteral(value);
	}
	if (typeof value === "undefined") {
		return j.identifier("undefined");
	}
	// Handle other types as needed
	throw new Error(`Unsupported type for AST node: ${typeof value}`);
}

module.exports = (fileInfo, api, options) => {
	const j = api.jscodeshift;
	const root = j(fileInfo.source);

	const translationDir = options.meta.tempTranslationsDir;

	const newTranslations = readJSONFilesFromDir(translationDir);

	// biome-ignore lint: forEach is inbuilt method to iterate nodes
	root
		.find(j.VariableDeclarator, {
			id: { name: "translations" },
		})
		.forEach((path) => {
			const existingProperties = path.node.init.properties.reduce(
				(acc, prop) => {
					const key =
						prop.key.type === "Identifier" ? prop.key.name : prop.key.value;
					if (prop.value.type === "ObjectExpression") {
						acc[key] = prop.value.properties.reduce((innerAcc, innerProp) => {
							const innerKey =
								innerProp.key.type === "Identifier"
									? innerProp.key.name
									: innerProp.key.value;
							innerAcc[innerKey] = innerProp.value.value;
							return innerAcc;
						}, {});
					} else {
						acc[key] = prop.value.value;
					}
					return acc;
				},
				{},
			);

			const mergedTranslations = deepMerge(existingProperties, newTranslations);

			const properties = Object.entries(mergedTranslations).map(
				([key, value]) => {
					if (typeof value === "object" && !Array.isArray(value)) {
						return j.property(
							"init",
							j.literal(key),
							j.objectExpression(
								Object.entries(value).map(([innerKey, innerValue]) =>
									j.property(
										"init",
										j.literal(innerKey),
										createASTNodeFromValue(j, innerValue),
									),
								),
							),
						);
					}
					return j.property(
						"init",
						j.literal(key),
						createASTNodeFromValue(j, value),
					);
				},
			);

			path.node.init = j.objectExpression(properties);
		});

	return root.toSource();
};
