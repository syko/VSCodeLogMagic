import * as assert from 'assert';
import { ParseResult } from '../parser';
import { ensureLogId } from '../util';
import { getMagicItem, MagicItem } from '../magic';

const tests = [
  [
    'var foo = 1',
    'console.log(\'foo:\', foo);',
  ],
  [
    'let foo = 1',
    'console.log(\'foo:\', foo);',
  ],
  [
    'const foo = 1',
    'console.log(\'foo:\', foo);',
  ],
  [
    'foo = 1',
    'console.log(\'foo:\', foo);',
  ],
  [
    'var obj = {a: 1}',
    'console.log(\'obj:\', obj);',
  ],
  [
    'var obj = getObj(1, 2)',
    'console.log(\'obj:\', obj);',
  ],
  [
    'obj = getObj(1, 2)',
    'console.log(\'obj:\', obj);',
  ],
  [
    'var foo = a + b',
    'console.log(\'foo:\', foo, \'a:\', a, \'b:\', b);',
  ],
  [
    '{a, b} = getObj(1, 2)',
    'console.log(\'a:\', a, \'b:\', b);',
  ],
  [
    'const {a:c, b:d} = getObj(1, 2)',
    'console.log(\'c:\', c, \'d:\', d);',
  ],
  [
    'const [a, b] = getArr(1, 2)',
    'console.log(\'a:\', a, \'b:\', b);',
  ],
  [
    'case foo:',
    'console.log(\'case\', \'foo:\', foo);',
  ],
  [
    'const a = someFn(b, c).someTrailingVar;',
    'console.log(\'a:\', a, \'b:\', b, \'c:\', c);',
  ],
  [
    'let asdf = this.foo[12].foo;',
    'console.log(\'asdf:\', asdf, \'this.foo[12].foo:\', this.foo[12].foo);',
  ],
  [
    'let asdf = this.foo[12]["something"][23].foof;',
    'console.log(\'asdf:\', asdf, \'this.foo..23].foof:\', this.foo[12]["something"][23].foof);',
  ],
  [
    'const [a, b, ...rest] = getArr(1, 2)',
    'console.log(\'a:\', a, \'b:\', b, \'rest:\', rest);',
  ],
  [
    '[a, b, ...rest] = getArr(1, 2)',
    'console.log(\'a:\', a, \'b:\', b, \'rest:\', rest);',
  ],
  [
    'const a = getArr(b, ...rest)',
    'console.log(\'a:\', a, \'b:\', b, \'rest:\', rest);',
  ],
  [
    'let {[a]: b} = getObj()',
    'console.log(\'b:\', b);',
  ],
  [
    'return 1',
    'console.log(\'return\');',
  ],
  [
    'return {a:1, b:2}',
    'console.log(\'return\');',
  ],
  [
    'return a + b',
    'console.log(\'return\', \'a:\', a, \'b:\', b);',
  ],
  [
    'if(a)',
    'console.log(\'if\', \'a:\', a);',
  ],
  [
    'if(a) {',
    'console.log(\'if\', \'a:\', a);',
  ],
  [
    '} else if(a) {',
    'console.log(\'else if\', \'a:\', a);',
  ],
  [
    'if (a + b)',
    'console.log(\'if\', \'a:\', a, \'b:\', b);',
  ],
  [
    'for(let i = 0 ; i < foo.length ; i++) {',
    'console.log(\'for\', \'i:\', i, \'foo.length:\', foo.length);',
  ],
  [
    'fn(a, b)',
    'console.log(\'fn\', \'a:\', a, \'b:\', b);',
  ],
  [
    'fn(a, {b:d, c:f})',
    'console.log(\'fn\', \'a:\', a, \'d:\', d, \'f:\', f);',
  ],
  [
    'function fn(a, b) {',
    'console.log(\'fn\', \'a:\', a, \'b:\', b);',
  ],
  [
    'var fn = function(a, b) {',
    'console.log(\'fn\', \'a:\', a, \'b:\', b);',
  ],
  [
    'fn(a, b) {',
    'console.log(\'fn\', \'a:\', a, \'b:\', b);',
  ],
  [
    'const fn = (a, b) => {',
    'console.log(\'fn\', \'a:\', a, \'b:\', b);',
  ],
  [
    'const fn = (a, b) =>',
    'console.log(\'fn\', \'a:\', a, \'b:\', b);',
  ],
  [
    'const fn = (a, b) => { return 12 }',
    'console.log(\'fn:\', fn);',
  ],
  [
    'fn = (a, b) => {',
    'console.log(\'fn\', \'a:\', a, \'b:\', b);',
  ],
  [
    'function fn({a = 5, b = 10} = {}) {',
    'console.log(\'fn\', \'a:\', a, \'b:\', b);',
  ],
  [
    'fn({a: value1, b: value2} = {}) {',
    'console.log(\'fn\', \'value1:\', value1, \'value2:\', value2);',
  ],
  [
    'export function fn(a, b) {',
    'console.log(\'fn\', \'a:\', a, \'b:\', b);',
  ],
  [
    'export default function fn(a, b) {',
    'console.log(\'fn\', \'a:\', a, \'b:\', b);',
  ],
  [
    'fn(a, b).then(function(c) {',
    'console.log(\'fn\', \'a:\', a, \'b:\', b, \'c:\', c);',
  ],
  [
    'fn(a, b).then((c) => {',
    'console.log(\'fn\', \'a:\', a, \'b:\', b, \'c:\', c);',
  ],
  [
    'fn(a, b).then(c => { 1 })',
    'console.log(\'fn\', \'a:\', a, \'b:\', b);',
  ],
  [
    'success: function(a) {',
    'console.log(\'success\', \'a:\', a);',
  ],
  [
    'success: (a, b) => {',
    'console.log(\'success\', \'a:\', a, \'b:\', b);',
  ],
  [
    'fn(a => {',
    'console.log(\'fn\', \'a:\', a);',
  ],
  [
    'fn (a) ->',
    'console.log(\'fn\', \'a:\', a);',
  ],
  [
    'fn ({a}) ->',
    'console.log(\'fn\', \'a:\', a);',
  ],
  [
    'success: ({a = 5, b = 10}) => {',
    'console.log(\'success\', \'a:\', a, \'b:\', b);',
  ],
  [
    'function whois({displayName, fullName: {firstName: name}}) {',
    'console.log(\'whois\', \'displayName:\', displayName, \'name:\', name);',
  ],
  [
    'for (const {name: n, family: {father: f}} of people) {',
    'console.log(\'for\', \'n:\', n, \'f:\', f, \'people:\', people);',
  ],
  [
    'someCallback: function (param1) {',
    'console.log(\'someCallback\', \'param1:\', param1);',
  ],
  [
    '"someCallback": function (param1) {',
    'console.log(\'someCallback\', \'param1:\', param1);',
  ],
  [
    '(someCallback): function (param1) {',
    'console.log(\'someCallback\', \'param1:\', param1);',
  ],
  [
    'let foo = a ? b : c;',
    'console.log(\'foo:\', foo, \'a:\', a, \'b:\', b, \'c:\', c);',
  ],
  [
    'fn(foo, 0x2F, 12_233_222, 0b101, 255n);',
    'console.log(\'fn\', \'foo:\', foo);',
  ],
];

function mockedEnsureLogId(result: ParseResult) {
  return ensureLogId(result, 122, 1);
}

describe('Javascript Logger', () => {
  let magic: MagicItem;

  function createLogStatement(input: string) {
    return magic.log(mockedEnsureLogId(magic.parse(magic.tokenize(input))));
  }

  before(async () => {
    magic = await getMagicItem('javascript');
  });

  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];
    it(t[0], () => { assert.strictEqual(createLogStatement(t[0]), t[1]); });
  }
});

// Most tests were copied over from the sublime version of the same extension
// These are a WONTFIX, however:
// because no more coffeescript support (not yet at least):
// [
//   'obj = getObj 1, 2',
//   'console.log(\'obj\', obj);',
// ],
// [
//   'fn a, {b:c}',
//   'console.log(\'fn\', \'a:\', a, \'c:\', c);',
// ],
// [
//   'fn a, fn(b, c)',
//   'console.log(\'fn\', \'a:\', a, \'fn(b, c):\', fn(b, c));',
// ],
// [
//   'fn a, b',
//   'console.log(\'fn\', \'a:\', a, \'b:\', b);',
// ],
// [
//   'fn = (a, b) ->',
//   'console.log(\'fn\', \'a:\', a, \'b:\', b);',
// ],
// [
//   'success: (a, b) ->',
//   'console.log(\'success\', \'a:\', a, \'b:\', b);',
// ],
// [
//   'function fn ({a = 5, b = 10} = {}) ->',
//   'console.log(\'fn\', \'a:\', a, \'b:\', b);',
// ],

// because no function calls are no longer outputted (breaking change):
// [
//   'var foo = fn(1, 2) + b',
//   'console.log(\'foo:\', foo, \'fn(1, 2):\', fn(1, 2), \'b:\', b);',
// ],
// [
//   'foo = fn(1, 2) + b',
//   'console.log(\'foo:\', foo, \'fn(1, 2):\', fn(1, 2), \'b:\', b);',
// ],
// [
//   'return getObj(1, 2)',
//   'console.log(\'return\', \'getObj(1, 2):\', getObj(1, 2));',
// ],
// [
//   'return fn(1, 2) + b',
//   'console.log(\'return\', \'fn(1, 2):\', fn(1, 2), \'b:\', b);',
// ],
// [
//   'if(getObj(1, 2))',
//   'console.log(\'if\', \'getObj(1, 2):\', getObj(1, 2));',
// ],
// [
//   'if(fn(1, 2) + b)',
//   'console.log(\'if\', \'fn(1, 2):\', fn(1, 2), \'b:\', b);',
// ],

// because no more flowtype support (at least not yet):
// [
//   'var obj:{a:String, b:Number} = getObj(1, 2)',
//   'console.log(\'obj\', obj);',
// ],
// [
//   'var obj:{a:String, b:Number} = {a:"foo", b:1}',
//   'console.log(\'obj\', obj);',
// ],
// [
//   'fn(a, b): any {',
//   'console.log(\'fn\', \'a:\', a, \'b:\', b);',
// ],
// [
//   'fn({a, b = 25}:SomeType = {}) {',
//   'console.log(\'fn\', \'a:\', a, \'b:\', b);',
// ],
