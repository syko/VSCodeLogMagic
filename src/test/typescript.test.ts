import * as assert from 'assert';
import { ParseResult } from '../parser';
import { ensureLogId } from '../util';
import { getMagicItem, MagicItem } from '../magic';
import jsTests from './javascript.test';

const tests = [
  [
    'var foo = 1',
    'console.log(\'foo:\', foo);',
  ],
];

function mockedEnsureLogId(result: ParseResult) {
  return ensureLogId(result, 122, 1);
}

describe('Typescript Logger', () => {
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

  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];
    it(t[0], () => { assert.strictEqual(createLogStatement(t[0]), t[1]); });
  }
});
