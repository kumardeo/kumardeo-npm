#!/usr/bin/env node

/* eslint-disable no-console */

import process from "node:process";
import fs from "node:fs";
import meow from "meow";
import prettyBytes from "pretty-bytes";
import chalk from "chalk";
import getStdin from "get-stdin";
import {
	fileSizeSync,
	fileSizeFromBufferSync,
	type FileSizeOptions
} from "./index.js";

const cli = meow(
	`
  Usage
	  $ file-size <file>
	  $ cat <file> | file-size

	Options
	  --level             Compression level [0-9] (Default: -1)
	  --raw               Display value in bytes
	  --include-original  Include original size
	  --include           Regex to match for files to include
	  --exclude           Regex to match for files to exclude

	Examples
	  $ file-size unicorn.png
	  192 kB
	  $ file-size unicorn.png --raw
	  192256
	  $ file-size unicorn.png --include-original
	  392 kB → 192 kB
`,
	{
		importMeta: import.meta,
		flags: {
			level: {
				shortFlag: "l",
				type: "number",
				isRequired: false
			},
			gzip: {
				shortFlag: "g",
				type: "boolean",
				default: false
			},
			raw: {
				shortFlag: "r",
				type: "boolean",
				isRequired: false
			},
			includeOriginal: {
				shortFlag: "o",
				type: "boolean",
				isRequired: false
			},
			include: {
				shortFlag: "i",
				type: "string",
				isMultiple: true,
				isRequired: false
			},
			exclude: {
				shortFlag: "e",
				type: "string",
				isMultiple: true,
				isRequired: false
			}
		}
	}
);

const [input] = cli.input;

if (!input && process.stdin.isTTY) {
	console.error("Specify a path");
	process.exit(1);
}

const gzipOptions: FileSizeOptions = {
	level: cli.flags.level
};

const fileOptions = {
	include:
		cli.flags.include?.length !== 0
			? cli.flags.include?.map((e) => new RegExp(e))
			: undefined,
	exclude:
		cli.flags.exclude?.length !== 0
			? cli.flags.exclude?.map((e) => new RegExp(e))
			: undefined
};

let result;

if (input) {
	if (fs.existsSync(input)) {
		result = fileSizeSync(input, { ...gzipOptions, ...fileOptions });
	} else {
		console.error(`Specify a valid path, ${input} does not exist!`);
		process.exit(1);
	}
} else {
	result = fileSizeFromBufferSync(await getStdin.buffer(), gzipOptions);
}

const { size, gzip } = result;

let output;

if (cli.flags.gzip) {
	output = cli.flags.raw
		? gzip
		: prettyBytes(gzip, { binary: true, maximumFractionDigits: 3 });

	if (cli.flags.includeOriginal) {
		output =
			(cli.flags.raw ? size : prettyBytes(size, { maximumFractionDigits: 3 })) +
			chalk.dim(" → ") +
			output;
	}
} else {
	output = cli.flags.raw
		? size
		: prettyBytes(size, { maximumFractionDigits: 3 });
}

console.log(output);
