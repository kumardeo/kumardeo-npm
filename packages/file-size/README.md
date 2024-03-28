# @kumardeo/file-size

An utility for calculating file or directory size.

## Installation

Install it by running the following command:

```shell
npm install @kumardeo/file-size
```

## CLI

```shell
npx @kumardeo/file-size build --gzip --include ".(js|ts)$"
```

## API

```ts
import { fileSizeSync } from "@kumardeo/file-size";

const result = fileSizeSync(new URL("./build", import.meta.url), {
  include: [/\.(js|ts)$/]
});

console.log(result);

```
