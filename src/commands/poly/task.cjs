const fs = require("node:fs");
const path = require("node:path");

/**
 * Converts a given string to snake case.
 *
 * @param {string} str - The string to be converted.
 * @returns {string} - The converted string in snake case.
 */
function convertToSnakeCase(str) {
	return (
		str
			// Insert an underscore before each uppercase letter and convert the letter to lowercase
			.replace(/([A-Z])/g, "_$1")
			// Replace spaces, hyphens, and other non-alphanumeric characters (excluding underscores) with underscores
			.replace(/[\s\W-]+/g, "_")
			// Convert to lowercase
			.toLowerCase()
			// Remove leading or trailing underscores
			.replace(/^_+|_+$/g, "")
			// Replace multiple consecutive underscores with a single one
			.replace(/_+/g, "_")
	);
}

/**
 * Returns the abbreviated name of a page based on the given file path.
 *
 * @param {string} filePath - The path of the file.
 * @returns {string} The abbreviated page name.
 */
function getPageNameAbbr(filePath) {
	const relativePath = path.relative(process.cwd(), filePath);
	const dirs = relativePath.split(path.sep);
	const relevantDirs = dirs.slice(1, -1);
	const fileName = path.basename(filePath, path.extname(filePath));
	return [...relevantDirs, fileName].map(convertToSnakeCase).join("__");
}

/**
 * Returns the abbreviated form of a given text.
 *
 * @param {string} text - The text to be abbreviated.
 * @returns {string} - The abbreviated form of the given text.
 */
function getTextAbbr(text) {
	return convertToSnakeCase(text.split(".")[0].trim().toLowerCase());
}

const attributeNames = [
	"alt",
	"description",
	"helper",
	"helperText",
	"label",
	"placeholder",
	"title",
];

module.exports = (fileInfo, api, options) => {
	// Define the module and the import name
	const { moduleName, tempTranslationsDir, importName } = options.meta;

	if (fileInfo.path.includes("test")) {
		console.log(`Skipping test file: ${fileInfo.path}`);
		return fileInfo.source; // Return original source without changes
	}

	const j = api.jscodeshift;
	const root = j(fileInfo.source);

	if (!fs.existsSync(tempTranslationsDir)) {
		fs.mkdirSync(tempTranslationsDir, { recursive: true });
	}

	const pageNameAbbr = getPageNameAbbr(fileInfo.path);

	const translations = {};

	const JSXElement = root.find(j.JSXElement);

	// biome-ignore lint: forEach is inbuilt method to iterate nodes
	JSXElement.find(j.JSXText).forEach((path) => {
		const text = path.node.value?.trim();

		if (text) {
			const textAbbr = getTextAbbr(text);

			// check if text abbreviation is empty string, if so, skip
			if (!textAbbr) {
				return;
			}

			if (!translations[textAbbr]) {
				translations[textAbbr] = text;
			}

			// Replace text in original file
			j(path).replaceWith(
				j.jsxExpressionContainer(
					j.memberExpression(
						j.memberExpression(
							j.identifier(importName),
							j.stringLiteral(pageNameAbbr),
							true,
						),
						j.stringLiteral(textAbbr),
						true,
					),
				),
			);
		}
	});

	// biome-ignore lint: forEach is inbuilt method to iterate nodes
	JSXElement.find(j.JSXAttribute).forEach((path) => {
		const node = path.node;
		const attributeName = node.name.name;
		const value = node.value;

		if (attributeNames.includes(attributeName)) {
			if ([value?.type, value?.expression?.type].includes("StringLiteral")) {
				const text = (value.value || value.expression.value)?.trim();

				if (text) {
					const textAbbr = getTextAbbr(text);

					if (!textAbbr) {
						return;
					}

					if (!translations[textAbbr]) {
						translations[textAbbr] = text;
					}

					// Replace text in original file
					j(path).replaceWith(
						j.jsxAttribute(
							j.jsxIdentifier(attributeName),
							j.jsxExpressionContainer(
								j.memberExpression(
									j.memberExpression(
										j.identifier(importName),
										j.stringLiteral(pageNameAbbr),
										true,
									),
									j.stringLiteral(textAbbr),
									true,
								),
							),
						),
					);
				}
			}
		}
	});

	if (!Object.keys(translations).length) {
		return root.source;
	}

	// Check if the import already exists
	const alreadyImported =
		root
			.find(j.ImportDeclaration, {
				source: {
					type: "StringLiteral",
					value: moduleName,
				},
			})
			.filter((path) => {
				return path.node.specifiers.some(
					(specifier) =>
						specifier.type === "ImportDefaultSpecifier" &&
						specifier.local.name === importName,
				);
			})
			.size() > 0;

	if (!alreadyImported) {
		// Define the new import statement
		const newImport = j.importDeclaration(
			[j.importDefaultSpecifier(j.identifier(importName))],
			j.literal(moduleName),
		);

		// Find the first import declaration in the file
		const firstImport = root.find(j.ImportDeclaration).at(0);

		if (firstImport.size() !== 0) {
			// If there's at least one import, insert the new import before the first one
			firstImport.insertBefore(newImport);
		} else {
			// If there are no import statements, insert the new import at the top of the file
			root.get().node.program.body.unshift(newImport);
		}
	}

	// Write translations for this file to a temporary file
	const tempTranslationFilePath = path.join(
		tempTranslationsDir,
		`${path.basename(fileInfo.path)}.json`,
	);

	fs.writeFileSync(
		tempTranslationFilePath,
		JSON.stringify({ [getPageNameAbbr(fileInfo.path)]: translations }, null, 2),
	);

	return root.toSource();
};
