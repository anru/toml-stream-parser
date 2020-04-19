import * as TOML from '@iarna/toml'
import { inspect } from 'util'

const EOL = /\r?\n/g

async function* toLines(chunkIterable: AsyncIterable<string>): AsyncIterable<string> {
  let remaining: string = ''
  for await (const chunk of chunkIterable) {
      const lines = (remaining + chunk).split(EOL)
      const last = lines.pop()
      remaining = last ? last : ''
      yield * lines
  }
  yield remaining
}

type AnyRecord = Record<string, any>

interface TOMLParserOptions {
  extractArray?: string,
}

// you can directly pass readable stream here, see https://nodejs.org/api/stream.html#stream_readable_symbol_asynciterator
async function* parseToml<R extends AnyRecord = AnyRecord>(tomlTextStream: AsyncIterable<string>, opts: TOMLParserOptions = {}): AsyncIterable<R> {
  let current = ''
  let currentLine = 0

  const { extractArray } = opts

  const emit = (chunk: R): R[] => {
    let result = []

    if (extractArray) {
      if (chunk && Array.isArray(chunk[extractArray])) {
        const values = chunk[extractArray]
        for (const value of values) {
          result.push(value)
        }
      } else {
        if (typeof chunk === 'object' && chunk) {
          throw new Error(
            `Values for keys ${extractArray} should be arrays, instead got ${inspect(chunk[extractArray], false, 3)}`
          )
        } else {
          throw new Error(`Each chunk should be object, instead got ${inspect(chunk, false, 2)}`)
        }
      }
    } else {
      result.push(chunk)
    }
    return result
  }
  
  function* process(line: string | null): Iterable<R> {
    const isEof = line === null
    // In exceptional cases it may lead to errors, but we will consider it not our case.
    if (isEof || line!.startsWith('[')) {
      if (current) {
        let chunk
        try {
          chunk = TOML.parse(current) as R
        } catch (e) {
          throw new Error(`TOML parser error (chunk offset line is ${currentLine}):\n${e.toString()}`)
        }
        current = ''
        yield * emit(chunk)
      }
    }
    if (!isEof) {
      current += (current ? '\n' + line : line!.trimLeft())
      currentLine += 1
    }
  }

  for await (const line of toLines(tomlTextStream)) {
    yield * process(line)
  }
  yield * process(null)
}

export {
  parseToml,
}