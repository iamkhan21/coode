import { command } from "cleye";

function poly(argv) {
	console.log(argv);
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
