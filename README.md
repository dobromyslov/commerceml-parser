# commerceml-parser

Status: Work In Progress

## Description

Parser for CommerceML 2.10 standard developed by 1c.ru.

Standard description: https://v8.1c.ru/tekhnologii/obmen-dannymi-i-integratsiya/standarty-i-formaty/standarty-commerceml/commerceml-2/

## Features

* Types description in English
* SAX XML parser suitable for large files
* NodeJS
* TypeScript
* [xojs/xo](https://github.com/xojs/xo) with plugins for TypeScript - linting in CLI
* [ESLint](https://github.com/eslint/eslint) - linting in the WebStorm with [ESLint plugin](https://plugins.jetbrains.com/plugin/7494-eslint)
* [jasmine](https://github.com/jasmine/jasmine) - Testing
* [nyc](https://github.com/istanbuljs/nyc) - Code Coverage

## Installation

```
npm install --save commerceml-parser
```

## Usage

Have a look at usage examples in tests `/spec/example.spec.ts`.

Run example: `npm run example`

Here is a common usage example:

```typescript
import {CommerceMlImportParser} from 'commerceml-parser/import-parser';
import {createReadStream} from "fs";

// Create parser stream for CommerceML catalog import file
const parserStream = new CommerceMlImportParser().createStream();

// Define handler for classifier XML block
parserStream.on('classifier', data => {
  console.log('classifier:', JSON.stringify(data));
});

// Define handler for classifier group XML blocks
parserStream.on('classifierGroup', data => {
  console.log('classifierGroup:', JSON.stringify(data));
});

// Define handler for parser error
parserStream.on('error', error => {
  console.log('error', error);
});

// Define handler for file end
parserStream.on('end', _ => {
  console.log('Done.');    
});

// Read CommerceML file and feed it to the parser stream
createReadStream('./data/import0_1_with_nested_groups.xml').pipe(parserStream);
``` 

## Tanks to

@kirill-zhirnov for his commerceml-js parser written in CoffeScript.

## License

MIT (c) 2020 Viacheslav Dobromyslov <<viacheslav@dobromyslov.ru>>
