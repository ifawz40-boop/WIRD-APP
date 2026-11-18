import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const picomatch = require('picomatch');
const unsafe = ["+(a*b)","*(a*|b)","+(ab|abab)","+(a|aa)","+(+(a))","*(!(foo))"];
const advisoryPatterns = ["+(*)","+(*a)","+(a*)","*(*a)"];
for (const pattern of advisoryPatterns) {
  const regex = picomatch.makeRe(pattern);
  assert.doesNotMatch(regex.source, /\)\+/,
    `single-branch repeated wildcard must be reduced to one linear wildcard: ${pattern}`);
}
for (const pattern of unsafe) {
  for (const options of [{}, { maxExtglobRecursion: false }, { maxExtglobRecursion: 100 }]) {
    let matcher;
    try {
      matcher = picomatch(pattern, options);
    } catch (error) {
      assert(error instanceof SyntaxError, `unexpected error for ${pattern}: ${error}`);
      continue;
    }
    // The parser may safely literalize known-risk patterns instead of throwing.
    assert.equal(matcher(pattern), true, `unproven pattern must be literalized or rejected: ${pattern}`);
  }
}
assert.throws(() => picomatch.makeRe('+(a*b)'), /Unsafe repeated extglob/);
for (const pattern of ['(+(a))+b', '(+(a))*b', 'x(+(a))+b']) {
  assert.throws(() => picomatch.makeRe(pattern, { regex: true }), /Unsafe repeated extglob/);
}
const safeCases = [
  ['foobar', '+(foo|bar)', true], ['jsjsx', '+(js|jsx)', true],
  ['some-file', '+(*)', true], ['ba', '+(*a)', true], ['aaa', '+(a*)', true],
  ['ba', '*(*a)', true],
  ['foofoo', '*(foo|bar)', true], ['src/components/App.tsx', '**/*.{ts,tsx}', true],
  ['src/main.js', '**/*.js', true], ['file.jsx', '*.+(js|jsx)', true]
];
for (const [input, pattern, expected] of safeCases) {
  assert.equal(picomatch.isMatch(input, pattern), expected, `${pattern} => ${input}`);
}
const worker = `const pm=require('picomatch');const cases=[['+(*)','a',100000,'!'],['+(*a)','a',100000,'!'],['+(a*)','a',100000,'!'],['*(*a)','a',100000,'!'],['+(a*b)','a',100000,'!'],['*(a*|b)','a',100000,'!'],['+(ab|abab)','ab',50000,'c'],['+(a|aa)','a',100000,'!'],['+(+(a))','a',100000,'!'],['*(!(foo))','f',100000,'!']];for(const [p,ch,n,suffix] of cases){const input=ch.repeat(n)+suffix;for(const options of [{},{maxExtglobRecursion:false},{maxExtglobRecursion:100}]){try{pm(p,options)(input)}catch(e){if(!(e instanceof SyntaxError))throw e}}}`;
const result = spawnSync(process.execPath, ['-e', worker], { encoding: 'utf8', timeout: 3000 });
assert.ifError(result.error);
assert.equal(result.status, 0, result.stderr || 'isolated ReDoS regression worker failed or exceeded its deadline');
console.log(`picomatch security regression: ${unsafe.length} risky patterns rejected or literalized; ${safeCases.length} safe patterns preserved; bounded worker completed.`);
