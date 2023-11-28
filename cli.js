#!/usr/bin/env node

import fs from "node:fs";
import { cli } from "cleye";
import polyCommand from "./src/commands/poly";

const packageJson = JSON.parse(fs.readFileSync("./package.json", "utf8"));

cli({
	name: packageJson.name,
	version: packageJson.version,
	commands: [polyCommand],
});
