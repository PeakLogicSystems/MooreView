'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { formatConsoleTimestamp } = require('../src/logger/consoleTimestamp');

describe('consoleTimestamp', () => {
  it('formatConsoleTimestamp uses local wall clock', () => {
    const d = new Date(2026, 5, 14, 19, 42, 3, 7);
    assert.equal(formatConsoleTimestamp(d), '2026-06-14 19:42:03.007');
  });
});
