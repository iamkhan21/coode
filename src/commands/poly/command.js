import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { command } from "cleye";
import { run as jscodeshift } from "jscodeshift/src/Runner.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function fetchTextsFromJSXElements({
	scanDir,
	moduleName,
	importName,
	tempTranslationsDir,
}) {
	const TRANSFORM_PATH = path.join(__dirname, "./gather-translations.cjs");
	const FILE_PATH = [path.resolve(process.cwd(), scanDir)];

	const options = {
		extensions: "tsx",
		parser: "tsx",
		meta: {
			moduleName,
			importName,
			tempTranslationsDir,
		},
		verbose: 1,
	};

	return jscodeshift(TRANSFORM_PATH, FILE_PATH, options);
}

function uniteTranslationsIntoOneFile({
	translationFilePath,
	tempTranslationsDir,
	translationVariableName,
}) {
	const TRANSFORM_PATH = path.join(__dirname, "./write-translations.cjs");
	const FILE_PATH = [path.resolve(process.cwd(), translationFilePath)];

	const options = {
		parser: "tsx",
		meta: {
			tempTranslationsDir,
			translationVariableName,
		},
		verbose: 1,
	};

	return jscodeshift(TRANSFORM_PATH, FILE_PATH, options);
}

async function poly(argv) {
	const tempTranslationsDir = path.resolve(process.cwd(), randomUUID());

	const {
		"scan-dir": scanDir,
		"module-name": moduleName,
		"import-name": importName,
		"translation-file-path": translationFilePath,
		"translation-variable-name": translationVariableName,
	} = argv.flags;

	await fetchTextsFromJSXElements({
		scanDir,
		moduleName,
		importName,
		tempTranslationsDir,
	});

	await uniteTranslationsIntoOneFile({
		translationFilePath,
		tempTranslationsDir,
		translationVariableName,
	});

	// Remove temp translations dir
	fs.rmSync(tempTranslationsDir, { recursive: true });
}

const polyCommand = command(
	{
		name: "poly",
		alias: "p",
		parameters: [],
		flags: {
			"scan-dir": {
				type: String,
				alias: "s",
				default: "src",
			},
			"module-name": {
				type: String,
				alias: "m",
				default: "translations",
			},
			"import-name": {
				type: String,
				alias: "i",
				default: "translations",
			},
			"translation-file-path": {
				type: String,
				alias: "t",
				default: "translations/en.ts",
			},
			"translation-variable-name": {
				type: String,
				alias: "v",
				default: "translations",
			},
		},
		help: {
			description: "Fetch texts and insert translation keys instead of them",
		},
	},
	poly,
);

export default polyCommand;
