import * as assert from 'assert';
import { ParseResult } from '../parser';
import { ensureLogId } from '../util';
import { getMagicItem, MagicItem } from '../magic';
import jsTests from './javascript.test';

const tests = [
  [
    'let myName: string = "Alice";',
    'console.log(\'myName:\', myName);',
  ],
  [
    'let myName: Name = "Alice";',
    'console.log(\'myName:\', myName);',
  ],
  [
    'const x = "hello" as number;',
    'console.log(\'x:\', x);',
  ],
  [
    'const x = "hello" as Foo;',
    'console.log(\'x:\', x);',
  ],
  [
    'function greet(person: Person, date: Date): Greeting {',
    'console.log(\'greet\', \'person:\', person, \'date:\', date);',
  ],
  [
    'function move(animal: Fish | Bird | Human) {',
    'console.log(\'move\', \'animal:\', animal);',
  ],
  [
    'function move(x: number, y?: number) {',
    'console.log(\'move\', \'x:\', x, \'y:\', y);',
  ],
  [
    'function move(x?: number | null, y?: number | null) {',
    'console.log(\'move\', \'x:\', x, \'y:\', y);',
  ],
  [
    'function move(pt: { x: number; y: Foo, z: Foo[] }) {',
    'console.log(\'move\', \'pt:\', pt);',
  ],
  [
    'function doSomething(pair: readonly [string, number]) {',
    'console.log(\'doSomething\', \'pair:\', pair);',
  ],
  [
    'function printName(obj: { first: string; last?: string }) {',
    'console.log(\'printName\', \'obj:\', obj);',
  ],
  [
    'function withCallback(fn: (a: string) => void) {',
    'console.log(\'withCallback\', \'fn:\', fn);',
  ],
  [
    'function withCallback(fn: (a: Foo) => Bar) {',
    'console.log(\'withCallback\', \'fn:\', fn);',
  ],
  [
    'function firstElement<Type>(arr: Type[]): Type | undefined {',
    'console.log(\'firstElement\', \'arr:\', arr);',
  ],
  [
    'function firstElement<Type, Type2>(arr: Type[]): Type | undefined {',
    'console.log(\'firstElement\', \'arr:\', arr);',
  ],
  [
    'const firstElement = <Type>(arr: Type[]): Type | undefined => {',
    'console.log(\'firstElement\', \'arr:\', arr);',
  ],
  [
    'function longest<Type extends OtherType>(a: Type, b: Type) {',
    'console.log(\'longest\', \'a:\', a, \'b:\', b);',
  ],
  [
    'function longest<Type extends { length: number }>(a: Type, b: Type) {',
    'console.log(\'longest\', \'a:\', a, \'b:\', b);',
  ],
  [
    'let box: Box<string> = { contents: "hello" };',
    'console.log(\'box:\', box);',
  ],
  [
    'let box: Box = getBox<Box>();',
    'console.log(\'box:\', box);',
  ],
  [
    'function create<Type>(c: { new (): Type }): Type {',
    'console.log(\'create\', \'c:\', c);',
  ],
  [
    'const foo: Type = bar() ? foo1 : foo2;',
    'console.log(\'foo:\', foo, \'foo1:\', foo1, \'foo2:\', foo2);',
  ],
  [
    'const foo: Type = bar(check ? foo1 : foo2);',
    'console.log(\'foo:\', foo, \'check:\', check, \'foo1:\', foo1, \'foo2:\', foo2);',
  ],
];

function mockedEnsureLogId(result: ParseResult) {
  return ensureLogId(result, 122, 1);
}

describe('Typescript Logger (Javascript Syntax)', () => {
  let magic: MagicItem;

  function createLogStatement(input: string) {
    return magic.log(mockedEnsureLogId(magic.parse(magic.tokenize(input))));
  }

  before(async () => {
    magic = await getMagicItem('typescript');
  });

  for (let i = 0; i < jsTests.length; i++) {
    const t = jsTests[i];
    it(t[0], () => { assert.strictEqual(createLogStatement(t[0]), t[1]); });
  }
});

describe('Typescript Logger (Typescript Syntax)', () => {
  let magic: MagicItem;

  function createLogStatement(input: string) {
    return magic.log(mockedEnsureLogId(magic.parse(magic.tokenize(input))));
  }

  before(async () => {
    magic = await getMagicItem('typescript');
  });

  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];
    it(t[0], () => { assert.strictEqual(createLogStatement(t[0]), t[1]); });
  }
});
