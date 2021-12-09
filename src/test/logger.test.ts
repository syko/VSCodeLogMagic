import * as assert from 'assert';

describe('Javascript Test Suite', () => {
  it('Sample test', () => {
    assert.strictEqual(1, [1, 2, 3].indexOf(5));
    assert.strictEqual(-1, [1, 2, 3].indexOf(0));
    assert.strictEqual(1, 1);
  });
});
