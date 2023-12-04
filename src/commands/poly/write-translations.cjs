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
		if (source[key] && typeof source[key] === "object") {
			target[key] = target[key] || {};
			deepMerge(target[key], source[key]);
		} else {
			target[key] = source[key];
		}
	}
	return target;
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
			// Convert existing AST properties to an object
			const existingProperties =
				path.node.init.properties?.reduce((acc, prop) => {
					const key = prop.key.name;
					acc[key] = prop.value.properties?.reduce((innerAcc, innerProp) => {
						innerAcc[innerProp.key.name] = innerProp.value.value;
						return innerAcc;
					}, {});
					return acc;
				}, {}) || {};

			// Deep merge existing and new translations
			const mergedTranslations = deepMerge(existingProperties, newTranslations);

			// Convert merged translations back to AST properties
			const properties = Object.entries(mergedTranslations).map(
				([key, value]) =>
					j.property(
						"init",
						j.identifier(key),
						j.objectExpression(
							Object.entries(value).map(([innerKey, innerValue]) =>
								j.property(
									"init",
									j.identifier(innerKey),
									j.literal(innerValue),
								),
							),
						),
					),
			);

			path.node.init = j.objectExpression(properties);
		});

	return root.toSource();
};
