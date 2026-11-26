import { DeterministicAdvisorEngine } from '../services/deterministicAdvisor';
import { buildBoundedChatPayload } from '../services/advisorService';
import fs from 'fs';
import path from 'path';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`✅ PASS: ${msg}`);
}

export function runGeminiSecurityTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      passed++;
    } catch (e: any) {
      failed++;
    }
  }

  // 1. Client bundle leakage check
  test('No GEMINI_API_KEY or process.env in src/ client files', () => {
    function scanDir(dir: string): string[] {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          results = results.concat(scanDir(fullPath));
        } else if ((file.endsWith('.ts') || file.endsWith('.tsx')) && !file.includes('.test.') && !file.includes('.spec.')) {
          results.push(fullPath);
        }
      });
      return results;
    }

    const srcFiles = scanDir(path.resolve('./src'));
    let foundKey = false;
    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes('process.env.GEMINI_API_KEY') || content.includes('VITE_GEMINI_API_KEY')) {
        foundKey = true;
        console.error(`Leaked in: ${file}`);
        break;
      }
    }
    assert(!foundKey, 'No Gemini API key reference may exist in client src directory');
  });

  // 2. Strict Current-Generation Model identifier (no deprecated gemini-2.5-* / gemini-1.5-*)
  test('Serverless handler uses gemini-4-hydrogen with gemini-3.5-flash-lite fallback', () => {
    const apiAdvisorContent = fs.readFileSync(path.resolve('./api/advisor.ts'), 'utf8');
    assert(apiAdvisorContent.includes("'gemini-4-hydrogen'"), 'Must specify gemini-4-hydrogen primary model identifier');
    assert(apiAdvisorContent.includes("'gemini-3.5-flash-lite'"), 'Must specify gemini-3.5-flash-lite fallback model identifier');
    assert(!apiAdvisorContent.includes('gemini-2.5-flash') && !apiAdvisorContent.includes('gemini-1.5-pro'), 'Must not reference deprecated models');
  });

  // 3. Fallback operates with 0 dependencies
  test('Deterministic Advisor works 100% offline without API key', () => {
    const answer = DeterministicAdvisorEngine.answerQuestion('كيف أثبت سورة الملك؟');
    assert(typeof answer === 'string' && answer.length > 50, 'Deterministic advisor must answer offline questions');
  });

  // 4. Rate Limiting logic exists in serverless handler
  test('api/advisor.ts has rate limiting and input size controls', () => {
    const handlerContent = fs.readFileSync(path.resolve('./api/advisor.ts'), 'utf8');
    assert(handlerContent.includes('checkRateLimit'), 'api/advisor.ts must enforce rate limiting');
    assert(handlerContent.includes('4096'), 'api/advisor.ts must enforce 4KB body limit');
    assert(handlerContent.includes('500'), 'api/advisor.ts must enforce 500 char prompt limit');
  });

  // 5. CORS and memory-bounded rate limiting
  test('Public wildcard CORS does not enable credentialed cross-origin requests', () => {
    const handlerContent = fs.readFileSync(path.resolve('./api/advisor.ts'), 'utf8');
    assert(handlerContent.includes("Access-Control-Allow-Origin', '*'"), 'Advisor endpoint must declare its public origin policy');
    assert(!handlerContent.includes('Access-Control-Allow-Credentials'), 'Wildcard CORS must not be combined with credential credentials');
  });

  test('In-memory rate-limit maps prune expired IP records when they grow', () => {
    const handlerContent = fs.readFileSync(path.resolve('./api/advisor.ts'), 'utf8');
    const serverContent = fs.readFileSync(path.resolve('./server.ts'), 'utf8');
    assert(handlerContent.includes('rateLimitMap.size > 1000') && handlerContent.includes('rateLimitMap.entries()'), 'Serverless advisor limiter must prune expired records');
    assert(serverContent.includes('rateLimitMap.size > 1000') && serverContent.includes('rateLimitMap.entries()'), 'Express advisor limiter must prune expired records');
  });

  test('Client chat payload helper bounds long multi-turn histories under the 4096-byte server limit', () => {
    const longHistory = Array.from({ length: 25 }, (_, i) => ({
      sender: (i % 2 === 0 ? 'user' : 'advisor') as 'user' | 'advisor',
      text: `رسالة مطولة رقم ${i + 1} `.repeat(30)
    }));
    const payload = buildBoundedChatPayload('  ' + 'سؤال '.repeat(140) + '  ', longHistory);
    const wireBytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
    assert(payload.message.length <= 500, `Message must be clamped to <= 500 chars (got ${payload.message.length})`);
    assert(payload.history.length <= 6, `History must keep at most 6 recent turns (got ${payload.history.length})`);
    assert(wireBytes <= 4096, `Serialized chat payload must stay <= 4096 UTF-8 bytes (got ${wireBytes})`);
  });

  return { passed, failed };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('geminiSecurity.test')) {
  console.log('=== Running Gemini Security Tests ===');
  const res = runGeminiSecurityTests();
  console.log(`Passed: ${res.passed}, Failed: ${res.failed}`);
  if (res.failed > 0) process.exit(1);
}
