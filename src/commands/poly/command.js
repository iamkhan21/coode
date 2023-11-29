import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { command } from "cleye";
import { run as jscodeshift } from "jscodeshift/src/Runner.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function fetchTextsFromJSXElements({
	scanDir = "src",
	moduleName = "translations",
	importName = "translations",
	tempTranslationsDir,
} = {}) {
	const TRANSFORM_PATH = path.join(__dirname, "./task.cjs");
	const FILE_PATH = [path.resolve(process.cwd(), scanDir)];

	const options = {
		extensions: "tsx",
		parser: "tsx",
		meta: {
			moduleName,
			importName,
			tempTranslationsDir,
		},
	};

	return jscodeshift(TRANSFORM_PATH, FILE_PATH, options);
}

function uniteTranslationsIntoOneFile({
	translationFilePath = "translations/en.json",
	tempTranslationsDir,
} = {}) {
	const finalTranslationFilePath = path.resolve(
		process.cwd(),
		translationFilePath,
	);

	// Read existing final translations
	let finalTranslations = {};
	if (fs.existsSync(finalTranslationFilePath)) {
		finalTranslations = JSON.parse(
			fs.readFileSync(finalTranslationFilePath, "utf8"),
		);
	}

	const files = fs.readdirSync(tempTranslationsDir);

	for (const file of files) {
		const filePath = path.join(tempTranslationsDir, file);
		const fileTranslations = JSON.parse(fs.readFileSync(filePath, "utf8"));

		for (const pageNameAbbr of Object.keys(fileTranslations)) {
			finalTranslations[pageNameAbbr] = {
				...finalTranslations[pageNameAbbr],
				...fileTranslations[pageNameAbbr],
			};
		}
	}

	// Delete the temp dir after all merges
	fs.rmSync(tempTranslationsDir, { recursive: true });

	// Write the merged translations to the final file
	fs.writeFileSync(
		finalTranslationFilePath,
		JSON.stringify(finalTranslations, null, 2),
	);
}

async function poly(argv) {
	const tempTranslationsDir = path.resolve(process.cwd(), randomUUID());

	await fetchTextsFromJSXElements({ tempTranslationsDir });
	uniteTranslationsIntoOneFile({ tempTranslationsDir });
}

const polyCommand = command(
	{
		name: "poly",
		alias: "p",
		parameters: [],
		help: {
			description: "Fetch texts and insert translation keys instead of them",
		},
	},
	poly,
);

export default polyCommand;
