import * as TOML from '@iarna/toml'
import { inspect } from 'util'

const EOL = /\r?\n/g
const MULTILINE_START = /=\s*"""/g
const MULTILINE_END = /"""\s*$/g

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

  let topLevelItemStartSequence: string
  let inMultilineString = false

  function* process(line: string | null): Iterable<R> {
    const isEof = line === null
    const trimmedLine = line?.trimLeft()

    if (!isEof) {
      if (!inMultilineString && MULTILINE_START.test(trimmedLine!)) {
        inMultilineString = true
      } else if (inMultilineString && MULTILINE_END.test(trimmedLine!)) {
        inMultilineString = false
      }

      if (!topLevelItemStartSequence) {
        if (trimmedLine!.startsWith('[[')) {
          topLevelItemStartSequence = '[['
        } else if (trimmedLine!.startsWith('[')) {
          topLevelItemStartSequence = '['
        }
      }
    }


    if (isEof || (!inMultilineString && topLevelItemStartSequence && trimmedLine!.startsWith(topLevelItemStartSequence))) {
      if (current) {
        let chunk
        try {
          chunk = TOML.parse(current) as R
        } catch (e) {
          throw new Error(`TOML parser error (chunk offset line is ${currentLine}):\n${e.toString()}`)
        }

        current = ''
        // empty text or text with comment is valid TOML
        if (Object.keys(chunk).length > 0) {
          yield* emit(chunk)
        }
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
