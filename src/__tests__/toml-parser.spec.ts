import { parseToml } from '../toml-parser'

interface Person {
  name: string,
  age: number,
}

function * strToIterableChunk(s: string, highWaterMark = 15): Iterable<string> {
  let rest = s

  while (rest.length !== 0) {
    yield rest.substr(0, highWaterMark)
    rest = rest.substr(highWaterMark)
  }
}


async function * readableStreamFrom(tomlStr: string, highWaterMark: number = 15): AsyncIterable<string> {
  yield * strToIterableChunk(tomlStr, highWaterMark)
}

async function drainItems<T>(asyncIterator: AsyncIterable<T>): Promise<Array<T>> {
  const items = []

  for await (const item of asyncIterator) {
    items.push(item)
  }

  return items
}

export default drainItems

describe('TOMLParser', () => {
  it('should parse toml object', async () => {
    const toml = `
[person]
name = 'John'
age = 32

[city]
name = 'Novosibirsk'
`
    const expectedChunks = [
      {
        person: {
          name: 'John',
          age: 32,
        },
      },
      {
        city: {
          name: 'Novosibirsk',
        },
      },
    ]

    const chunks: any[] = await drainItems(parseToml(readableStreamFrom(toml)))

    expect(chunks).toEqual(expectedChunks)
  })

  it('should able parse arrays of tables', async () => {
    const toml = `
[[people]]
name = 'Andrey'
age = 32

[[people]]
name = 'Alisa'
age = 2

[[people]]
name = 'Ekaterina'
age = 8
`
    const expectedPeople = [
      {
        name: 'Andrey',
        age: 32,
      },
      {
        name: 'Alisa',
        age: 2,
      },
      {
        name: 'Ekaterina',
        age: 8,
      },
    ]

    const chunks: Person[] = await drainItems(parseToml<Person>(readableStreamFrom(toml), { extractArray: 'people' }))
    expect(chunks).toEqual(expectedPeople)
  })

  it('arrays of tables with nested objects', async () => {
    const toml = `
[[people]]
name = 'John'
  [people.params]
  account = 546_456
  abc = "Hello"
  
[[people]]
name = 'Key'
  [people.params]
  account = 1234
`
    const expectedPeople = [
      {
        name: 'John',
        params: {
          account: 546456,
          abc: 'Hello',
        },
      },
      {
        name: 'Key',
        params: {
          account: 1234,
        },
      },
    ]

    const chunks = await drainItems(parseToml(readableStreamFrom(toml), {extractArray: 'people'}))
    expect(chunks).toEqual(expectedPeople)
  })

  it('arrays of tables with multiline strings with brackets', async () => {
    const toml = `
[[people]]
name = """
[test]"""
[people.params]
account = 546_456

[[people]]
name = 'Man'
`
    const expectedPeople = [
      {
        name: '[test]',
        params: {
          account: 546456
        }
      },
      {
        name: 'Man',
      },
    ]

    const chunks = await drainItems(parseToml(readableStreamFrom(toml), {extractArray: 'people'}))
    expect(chunks).toEqual(expectedPeople)
  })

  it('skip empty lines and comments', async () => {
    const toml = `
# Top comment
[[people]]
name = """
[test]"""
[people.params]
account = 546_456

[[people]]
name = 'Man'
`
    const expectedPeople = [
      {
        name: '[test]',
        params: {
          account: 546456
        }
      },
      {
        name: 'Man',
      },
    ]

    const chunks = await drainItems(parseToml(readableStreamFrom(toml), {extractArray: 'people'}))
    expect(chunks).toEqual(expectedPeople)
  })
})
