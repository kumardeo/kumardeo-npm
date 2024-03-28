import PATH from "node:path";
import FS, { type PathLike } from "node:fs";
import STREAM from "node:stream";
import UTIL from "node:util";
import ZLIB, { type InputType, type ZlibOptions } from "node:zlib";
import DUPLEXER from "duplexer3";

export type GzipOptions = {
	[K in keyof ZlibOptions]: ZlibOptions[K];
};

export type FileSizeOptions = GzipOptions & {
	include?: RegExp | RegExp[];
	exclude?: RegExp | RegExp[];
};

export { type PathLike };

const gzipAsync = UTIL.promisify(ZLIB.gzip);

const getGzipOptions = <T extends NonNullable<object>>(
	options: T = {} as T
): GzipOptions & T => ({
	level: ZLIB.constants.Z_DEFAULT_LEVEL,
	...options
});

const shouldIncludeFile = (
	file: string,
	include?: RegExp | RegExp[],
	exclude?: RegExp | RegExp[]
) => {
	let included = true;
	let excluded = false;

	if (Array.isArray(include)) {
		included = include.some(
			(regex) => regex instanceof RegExp && regex.test(file)
		);
	}
	if (include instanceof RegExp) {
		included = include.test(file);
	}

	if (Array.isArray(exclude)) {
		excluded = exclude.some(
			(regex) => regex instanceof RegExp && regex.test(file)
		);
	} else if (exclude instanceof RegExp) {
		excluded = exclude.test(file);
	}

	return !excluded && included;
};

const getAllFiles = async (directory: PathLike, absolute: boolean = false) => {
	const getAbsolutePaths = async (dir: PathLike, fileList: string[] = []) => {
		const absoluteDirectory = await FS.promises.realpath(dir);
		const files = await FS.promises.readdir(absoluteDirectory);

		await Promise.all(
			files.map(async (file) => {
				const filePath = PATH.join(absoluteDirectory, file);
				const pathStat = await FS.promises.stat(filePath);

				if (pathStat.isDirectory()) {
					await getAbsolutePaths(filePath, fileList);
				} else {
					fileList.push(filePath);
				}
			})
		);

		return fileList;
	};

	const realPath = await FS.promises.realpath(directory);
	const files = await getAbsolutePaths(directory);

	if (!absolute) {
		return files.map((file) => PATH.relative(realPath, file));
	}

	return files;
};

const getAllFilesSync = (directory: PathLike, absolute: boolean = false) => {
	const getAbsolutePaths = (dir: PathLike, fileList: string[] = []) => {
		const absoluteDirectory = FS.realpathSync(dir);
		const files = FS.readdirSync(absoluteDirectory);

		files.forEach((file) => {
			const filePath = PATH.join(absoluteDirectory, file);
			const pathStat = FS.statSync(filePath);

			if (pathStat.isDirectory()) {
				getAbsolutePaths(filePath, fileList);
			} else {
				fileList.push(filePath);
			}
		});

		return fileList;
	};

	const realPath = FS.realpathSync(directory);
	const files = getAbsolutePaths(directory);

	if (!absolute) {
		return files.map((file) => PATH.relative(realPath, file));
	}

	return files;
};

export const fileSizeFromBuffer = async <T extends InputType>(
	buffer: T,
	options?: GzipOptions
) => {
	if (!buffer) {
		throw new TypeError("Argument 1 must be a BufferSource");
	}

	const gzipped = await gzipAsync(buffer, getGzipOptions(options));

	return {
		size: Buffer.byteLength(buffer),
		gzip: gzipped.byteLength,
		originalBuffer: buffer,
		gzippedBuffer: gzipped
	};
};

export const fileSizeFromBufferSync = <T extends InputType>(
	buffer: T,
	options?: GzipOptions
) => {
	if (!buffer) {
		throw new TypeError("Argument 1 must be a BufferSource");
	}

	const gzipped = ZLIB.gzipSync(buffer, getGzipOptions(options));

	return {
		size: Buffer.byteLength(buffer),
		gzip: gzipped.byteLength,
		originalBuffer: buffer,
		gzippedBuffer: gzipped
	};
};

export const fileSizeStream = (options?: GzipOptions) => {
	// TODO: Use `stream.pipeline` here.

	const input = new STREAM.PassThrough();
	const output = new STREAM.PassThrough();
	const wrapper = DUPLEXER(input, output);

	let gzipSize = 0;

	input.pipe(
		ZLIB.createGzip(getGzipOptions(options))
			.on("data", (buffer: InputType) => {
				gzipSize += Buffer.byteLength(buffer);
			})
			.on("error", () => {
				(wrapper as unknown as { gzipSize: number }).gzipSize = 0;
			})
			.on("end", () => {
				(wrapper as unknown as { gzipSize: number }).gzipSize = gzipSize;
				wrapper.emit("gzip-size", gzipSize);
				output.end();
			})
	);
	input.pipe(output, { end: false });

	return wrapper;
};

export const fileSizeFromFile = async (
	path: PathLike,
	options?: GzipOptions
) => {
	const file = await FS.promises.realpath(path);
	return {
		...(await fileSizeFromBuffer(await FS.promises.readFile(file), options)),
		file
	};
};
/*
new Promise<number>((resolve, reject) => {
	const stream = createReadStream(path);
	stream.on("error", reject);

	const gzipStream = stream.pipe(gzipSizeStream(options));
	gzipStream.on("error", reject);
	gzipStream.on("gzip-size", (size: number) => resolve(size));
});
*/

export const fileSizeFromFileSync = (path: PathLike, options?: GzipOptions) => {
	const file = FS.realpathSync(path);
	return {
		...fileSizeFromBufferSync(FS.readFileSync(path), options),
		file
	};
};

const fileSizeFromFiles = async (paths: PathLike[], options?: GzipOptions) => {
	const files = await Promise.all(
		paths.map((path) => fileSizeFromFile(path, options))
	);

	let buffer;
	let gzipped;
	if (files.length > 1) {
		buffer = Buffer.concat(files.map((f) => f.originalBuffer));
		gzipped = await fileSizeFromBuffer(buffer, options);
	} else if (files.length === 1) {
		buffer = files[0].originalBuffer;
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { file, ...others } = files[0];
		gzipped = others;
	}

	return {
		size: 0,
		gzip: 0,
		...gzipped,
		files
	};
};

const fileSizeFromFilesSync = (paths: PathLike[], options?: GzipOptions) => {
	const files = paths.map((path) => fileSizeFromFileSync(path, options));

	let buffer;
	let gzipped;
	if (files.length > 1) {
		buffer = Buffer.concat(files.map((f) => f.originalBuffer));
		gzipped = fileSizeFromBufferSync(buffer, options);
	} else if (files.length === 1) {
		buffer = files[0].originalBuffer;
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { file, ...others } = files[0];
		gzipped = others;
	}

	return {
		size: 0,
		gzip: 0,
		...gzipped,
		files
	};
};

export const fileSizeFromDirectory = async (
	directory: PathLike,
	options?: GzipOptions & { exclude?: RegExp[] | RegExp }
) => {
	const files = await getAllFiles(directory, true);
	return fileSizeFromFiles(files, options);
};

export const fileSizeFromDirectorySync = (
	directory: PathLike,
	options?: GzipOptions
) => {
	const files = getAllFilesSync(directory, true);
	return fileSizeFromFilesSync(files, options);
};

export const fileSize = async (path: PathLike, options?: FileSizeOptions) => {
	const absolutePath = await FS.promises.realpath(path);
	const isDirectory = (await FS.promises.stat(absolutePath)).isDirectory();
	if (isDirectory) {
		const files = await getAllFiles(absolutePath, true);
		const filesToInclude = files.filter((file) =>
			shouldIncludeFile(file, options?.include, options?.exclude)
		);
		return fileSizeFromFiles(filesToInclude, options);
	}
	if (shouldIncludeFile(absolutePath, options?.include, options?.exclude)) {
		return fileSizeFromFiles([absolutePath], options);
	}
	return { size: 0, gzip: 0, files: [] };
};

export const fileSizeSync = (path: PathLike, options?: FileSizeOptions) => {
	const absolutePath = FS.realpathSync(path);
	const isDirectory = FS.statSync(absolutePath).isDirectory();
	if (isDirectory) {
		const files = getAllFilesSync(absolutePath, true);
		const filesToInclude = files.filter((file) =>
			shouldIncludeFile(file, options?.include, options?.exclude)
		);
		return fileSizeFromFilesSync(filesToInclude, options);
	}
	if (shouldIncludeFile(absolutePath, options?.include, options?.exclude)) {
		return fileSizeFromFilesSync([absolutePath], options);
	}
	return { size: 0, gzip: 0, files: [] };
};
