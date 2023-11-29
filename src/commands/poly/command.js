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
	translationFilePath,
	tempTranslationsDir,
}) {
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
	} else {
		fs.mkdirSync(path.dirname(finalTranslationFilePath), { recursive: true });
	}

	// Check if the temp dir exists
	if (!fs.existsSync(tempTranslationsDir)) {
		return;
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

	const {
		"scan-dir": scanDir,
		"module-name": moduleName,
		"import-name": importName,
		"translation-file-path": translationFilePath,
	} = argv.flags;

	await fetchTextsFromJSXElements({
		scanDir,
		moduleName,
		importName,
		tempTranslationsDir,
	});
	uniteTranslationsIntoOneFile({
		translationFilePath,
		tempTranslationsDir,
	});
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
				default: "translations/en.json",
			},
		},
		help: {
			description: "Fetch texts and insert translation keys instead of them",
		},
	},
	poly,
);

export default polyCommand;
