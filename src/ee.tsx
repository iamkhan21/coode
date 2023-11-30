import React from "react";
import translations from "translations";

type Props = {
	switchToEdit: () => void;
};

const Empty1: React.FC<Props> = ({ switchToEdit }) => {
	return (
		<>
			<TextField
				autoComplete={"off"}
				label={translations.ee.phone}
				type="tel"
				inputMode="tel"
				fullWidth
				variant="standard"
				margin="dense"
			/>
			<p>{translations.ee.phone}</p>
		</>
	);
};

const EmptyCoverage: React.FC<Props> = ({ switchToEdit }) => {
	return (
		<>
			<TextField
				autoComplete={"off"}
				label={translations.ee.phone}
				title={translations.ee.asdfasdf}
				type="tel"
				inputMode="tel"
				fullWidth
				variant="standard"
				margin="dense"
			/>
			<p>{translations.ee.phone}</p>
		</>
	);
};

export default EmptyCoverage;
