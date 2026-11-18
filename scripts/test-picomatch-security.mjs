import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const picomatch = require('picomatch');
const unsafe = ["+(a*b)","*(a*|b)","+(ab|abab)","+(a|aa)","+(+(a))","*(!(foo))"];
for (const pattern of unsafe) {
  for (const options of [{}, { maxExtglobRecursion: false }, { maxExtglobRecursion: 100 }]) {
    assert.throws(() => picomatch.makeRe(pattern, options),
      error => error instanceof SyntaxError && /Unsafe repeated extglob/.test(error.message),
      `must reject ambiguous pattern ${pattern}`);
  }
}
for (const pattern of ['(+(a))+b', '(+(a))*b', 'x(+(a))+b']) {
  assert.throws(() => picomatch.makeRe(pattern, { regex: true }), /Unsafe repeated extglob/);
}
const safeCases = [
  ['foobar', '+(foo|bar)', true], ['jsjsx', '+(js|jsx)', true],
  ['some/path', '+(*)', true], ['ba', '+(*a)', true], ['aaa', '+(a*)', true],
  ['ba', '*(*a)', true],
  ['foofoo', '*(foo|bar)', true], ['src/components/App.tsx', '**/*.{ts,tsx}', true],
  ['src/main.js', '**/*.js', true], ['file.jsx', '*.+(js|jsx)', true]
];
for (const [input, pattern, expected] of safeCases) {
  assert.equal(picomatch.isMatch(input, pattern), expected, `${pattern} => ${input}`);
}
const worker = `const pm=require('picomatch');const patterns=${JSON.stringify(unsafe)};for(const p of patterns){try{pm.makeRe(p);process.exitCode=2}catch(e){if(!(e instanceof SyntaxError))throw e}}`;
const result = spawnSync(process.execPath, ['-e', worker], { encoding: 'utf8', timeout: 3000 });
assert.ifError(result.error);
assert.equal(result.status, 0, result.stderr || 'isolated ReDoS regression worker failed');
console.log(`picomatch security regression: ${unsafe.length} unsafe patterns rejected; ${safeCases.length} safe patterns preserved; bounded worker completed.`);
