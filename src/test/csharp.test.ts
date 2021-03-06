import * as assert from 'assert';
import { ParseResult } from '../parser';
import { ensureLogId } from '../util';
import { getMagicItem, MagicItem } from '../magic';

const tests = [
  [
    'var foo = 1',
    'Console.WriteLine("foo: " + foo);',
  ],
  [
    'Integer foo = 1',
    'Console.WriteLine("foo: " + foo);',
  ],
  [
    'Float foo = 1f',
    'Console.WriteLine("foo: " + foo);',
  ],
  [
    'SomeType foo = Fn<SomeType, OtherType>();',
    'Console.WriteLine("foo: " + foo);',
  ],
  [
    'SomeType[][] foo = Fn<SomeType, OtherType>();',
    'Console.WriteLine("foo: " + foo);',
  ],
  [
    'foo += getObj(1, 2)',
    'Console.WriteLine("foo: " + foo);',
  ],
  [
    'obj = getObj(1, 2)',
    'Console.WriteLine("obj: " + obj);',
  ],
  [
    'case foo:',
    'Console.WriteLine("case" + " foo: " + foo);',
  ],
  [
    'String a = someFn(b, c).someTrailingVar;',
    'Console.WriteLine("a: " + a + " b: " + b + " c: " + c);',
  ],
  [
    'String asdf = this.foo[12].foo;',
    'Console.WriteLine("asdf: " + asdf + " this.foo[12].foo: " + this.foo[12].foo);',
  ],
  [
    'String asdf = this.foo[12]["something"][23].foof;',
    'Console.WriteLine("asdf: " + asdf + " this.foo..23].foof: " + this.foo[12]["something"][23].foof);',
  ],
  [
    'return 1',
    'Console.WriteLine("return");',
  ],
  [
    'return a + b',
    'Console.WriteLine("return" + " a: " + a + " b: " + b);',
  ],
  [
    'if(a)',
    'Console.WriteLine("if" + " a: " + a);',
  ],
  [
    'if(a) {',
    'Console.WriteLine("if" + " a: " + a);',
  ],
  [
    '} else if(a) {',
    'Console.WriteLine("else if" + " a: " + a);',
  ],
  [
    'if (a + b)',
    'Console.WriteLine("if" + " a: " + a + " b: " + b);',
  ],
  [
    'fn(a, b)',
    'Console.WriteLine("fn" + " a: " + a + " b: " + b);',
  ],
  [
    'for (int dx = -neighborhoodRangeX; dx <= neighborhoodRangeX; dx++)',
    'Console.WriteLine("for" + " dx: " + dx + " neighborhoodRangeX: " + neighborhoodRangeX);',
  ],
  [
    'foreach (Resolution res in Screen.resolutions) {',
    'Console.WriteLine("res: " + res + " Screen.resolutions: " + Screen.resolutions);',
  ],
  [
    'unappliedSettings.CurrentResolution = resolutions[resolutionPicker.value];',
    'Console.WriteLine("unapplie..solution: " + unappliedSettings.CurrentResolution + " resoluti..r.value]: " + resolutions[resolutionPicker.value] + " resoluti..er.value: " + resolutionPicker.value);',
  ],
  [
    'private void fn(a, b) {',
    'Console.WriteLine("fn" + " a: " + a + " b: " + b);',
  ],
  [
    'public override Integer fn(SomeType a, OtherType b) {',
    'Console.WriteLine("fn" + " a: " + a + " b: " + b);',
  ],
  [
    'fn((a, b) => {',
    'Console.WriteLine("fn" + " a: " + a + " b: " + b);',
  ],
  [
    'fn(a, b) =>',
    'Console.WriteLine("fn" + " a: " + a + " b: " + b);',
  ],
  [
    'fn = (a, b) => { return 12 }',
    'Console.WriteLine("fn: " + fn);',
  ],
  [
    'fn(a = 5, b = 10) {',
    'Console.WriteLine("fn" + " a: " + a + " b: " + b);',
  ],
  [
    'fn(a => {',
    'Console.WriteLine("fn" + " a: " + a);',
  ],
  [
    'var foo = a ? b : c;',
    'Console.WriteLine("foo: " + foo + " a: " + a + " b: " + b + " c: " + c);',
  ],
  [
    'fn(foo, 0x123F, 12f, 1_233_333, 0b0101_0011, 2L, 2ul, 2UL)',
    'Console.WriteLine("fn" + " foo: " + foo);',
  ],
];

function mockedEnsureLogId(result: ParseResult) {
  return ensureLogId(result, 122, 1);
}

describe('C# Logger', () => {
  let magic: MagicItem;

  function createLogStatement(input: string) {
    return magic.log(mockedEnsureLogId(magic.parse(magic.tokenize(input))));
  }

  before(async () => {
    magic = await getMagicItem('csharp');
  });

  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];
    it(t[0], () => { assert.strictEqual(createLogStatement(t[0]), t[1]); });
  }
});
