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
			// Step 1: go through the existing properties and check do they exist in the new translations object
			// biome-ignore lint: forEach is inbuilt method to iterate nodes
			path.node.init.properties.forEach((prop) => {
				// Check property, if it exists in the new translations object - go inside of it and check values of the its properties, add new properties
				if (prop.key.name in newTranslations) {
					const newTranslationsProps = newTranslations[prop.key.name];

					// Delete existing property from the new translations object
					delete newTranslations[prop.key.name];

					// Checking values of the existing property
					// biome-ignore lint: forEach is inbuilt method to iterate nodes
					prop.value.properties.forEach((innerProp) => {
						// Check if property exists in the new translations object
						if (innerProp.key.name in newTranslationsProps) {
							// Delete existing property from the new translations object
							delete newTranslationsProps[innerProp.key.name];
						}
					});

					// Add new properties to the existing property
					prop.value.properties.push(
						...Object.entries(newTranslationsProps).map(([key, value]) => {
							return j.property(
								"init",
								j.stringLiteral(key),
								j.stringLiteral(value),
							);
						}),
					);
				}
			});

			// Step 2: add new properties to the existing object
			path.node.init.properties.push(
				...Object.entries(newTranslations).map(([key, value]) => {
					return j.property(
						"init",
						j.stringLiteral(key),
						j.objectExpression(
							Object.entries(value).map(([innerKey, innerValue]) => {
								return j.property(
									"init",
									j.stringLiteral(innerKey),
									j.stringLiteral(innerValue),
								);
							}),
						),
					);
				}),
			);
		});

	return root.toSource();
};
