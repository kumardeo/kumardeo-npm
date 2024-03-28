#!/usr/bin/env node

/* eslint-disable no-console */

import process from "node:process";
import fs from "node:fs";
import meow from "meow";
import prettyBytes, { type Options as PrettyBytesOptions } from "pretty-bytes";
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
	  $ file-size <path>
	  $ cat <file> | file-size

	Options
	  --level, -l                Compression level [0-9] (Default: -1)
	  --gzip, -g                 Print gzip size
	  --raw, -r                  Display value in bytes
	  --original, -o             Include original size (Only available with --gzip)
	  --si, -s                   Format size using the SI Prefix instead of the Binary Prefix.
	  --bits, -b                 Format size as bits instead of bytes
	  --max-frac-digits, -m      Maximum Fraction Digits (Default: 3)
	  --include, -i              Regex to match for files to include
	  --exclude, -e              Regex to match for files to exclude

	Examples
	  $ file-size unicorn.png
	  192 KiB
	  $ file-size unicorn.png --raw
	  192256
	  $ file-size unicorn.png --gzip --original
	  392 KiB → 192 KiB
	  $ file-size my-dir --gzip --include ".(js|ts)$" --max-frac-digits 2
	  60.67 KiB
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
			original: {
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
			},
			si: {
				shortFlag: "s",
				type: "boolean",
				default: false,
				isRequired: false
			},
			bits: {
				shortFlag: "b",
				type: "boolean",
				default: false,
				isRequired: false
			},
			maxDigits: {
				shortFlag: "m",
				type: "number",
				default: 3,
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
const prettyBytesOptions: PrettyBytesOptions = {
	binary: !cli.flags.si,
	maximumFractionDigits: cli.flags.maxDigits,
	bits: cli.flags.bits
};

let output;

if (cli.flags.gzip) {
	output = cli.flags.raw ? gzip : prettyBytes(gzip, prettyBytesOptions);

	if (cli.flags.original) {
		output =
			(cli.flags.raw ? size : prettyBytes(size, prettyBytesOptions)) +
			chalk.dim(" → ") +
			output;
	}
} else {
	output = cli.flags.raw ? size : prettyBytes(size, prettyBytesOptions);
}

console.log(output);
