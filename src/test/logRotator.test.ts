import * as assert from 'assert';
import { getMagicItem, MagicItem } from '../magic';

describe('Log Rotator', () => {
  let magic: MagicItem;

  function rotateStatement(input: string, direction: -1 | 1 = 1): string | null {
    return magic.rotateLog(magic.tokenize(input), direction);
  }

  before(async () => {
    magic = await getMagicItem('javascript');
  });

  it('rotates log statements forwards', () => {
    let line: string | null = 'console.log(123);';
    line = rotateStatement(line);
    assert.strictEqual(line, 'console.info(123);');
    line = rotateStatement(line);
    assert.strictEqual(line, 'console.warn(123);');
    line = rotateStatement(line);
    assert.strictEqual(line, 'console.error(123);');
    line = rotateStatement(line);
    assert.strictEqual(line, 'console.log(123);');
  });

  it('rotates log statements backwards', () => {
    let line: string | null = 'console.log(123);';
    line = rotateStatement(line, -1);
    assert.strictEqual(line, 'console.error(123);');
    line = rotateStatement(line, -1);
    assert.strictEqual(line, 'console.warn(123);');
    line = rotateStatement(line, -1);
    assert.strictEqual(line, 'console.info(123);');
    line = rotateStatement(line, -1);
    assert.strictEqual(line, 'console.log(123);');
  });

  it('returns null when trying to rotate non-log line', () => {
    let line: string | null = 'somethingElse(123);';
    line = rotateStatement(line, -1);
    assert.strictEqual(line, null);
  });

  it('generates item keys when needed without duplicating', () => {
    let line: string | null = 'console.log(123, foo, \'bar:\', bar);';
    line = rotateStatement(line);
    assert.strictEqual(line, 'console.info(123, \'foo:\', foo, \'bar:\', bar);');
  });

  it('handles any kind of log line', () => {
    let line: string | null = 'console.log(12, "foo", fn(1, 2), ({a: 2, b: "foo"})[a]);';
    line = rotateStatement(line);
    assert.strictEqual(line, 'console.info(12, \'foo\', \'fn(1, 2):\', fn(1, 2), \'({a: 2, ..oo\\\'})[a]:\', ({a: 2, b: \'foo\'})[a]);');
    line = rotateStatement(line);
    assert.strictEqual(line, 'console.warn(12, \'foo\', \'fn(1, 2):\', fn(1, 2), \'({a: 2, ..oo\\\'})[a]:\', ({a: 2, b: \'foo\'})[a]);');
  });
});
