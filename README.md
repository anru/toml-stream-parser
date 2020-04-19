# toml-stream-parser

[![Build Status](https://travis-ci.com/anru/toml-stream-parser.svg?branch=master)](https://travis-ci.com/anru/toml-stream-parser)
[![npm version](https://img.shields.io/npm/v/toml-stream-parser.svg)](https://www.npmjs.com/package/toml-stream-parser)

Streaming parser for TOML format. Requires Node v10.0.0 or above.

## Usage

```javascript
import { parseToml } from 'toml-stream-parser'
```

The parser takes AsyncIterable<string> (or ReadbleStream such as it also [implements](https://nodejs.org/api/stream.html#stream_readable_symbol_asynciterator) this interface) as input and returns, also asyncIterable consisting of TOML chunks separated by inline tables or an array of inline tables:

```toml
[person]
name = 'John'
age = 32

[place]
city = 'Novosibirsk'
district = 'Academgorodok'
```

Each inline table will be emitted separately:

```javascript
for await (const chunk of parseToml(toml)) {
  // first chunk will be person
  // second chunk will be place
}
```

## Parsing array of tables

If you have some big array of data represented as array of toml tables you can emit direct values of each inline table:

```toml
[[people]]
name = 'Andrew'
age = 32

[[people]]
name = 'Alisa'
age = 2

[[people]]
name = 'Ekaterina'
age = 8
```

Parsing code:

```javascript
for await (const person of parseToml(toml, { pullOutKey: 'people' })) {
  console.log(person.name)
}
// -> Andrew
// -> Alisa
// -> Ekaterina
```

