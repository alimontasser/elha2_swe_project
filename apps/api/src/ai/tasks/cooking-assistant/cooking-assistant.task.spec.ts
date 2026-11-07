import { FakeProvider } from '../../providers/fake.provider';
import { AiTaskRunner } from '../../task-runner';
import { MemoryAiStore } from '../../testing';
import { answerLanguage, type CookingAssistantInput, CookingAssistantTask } from './cooking-assistant.task';
import { TEXT } from './safety';

const pantry: CookingAssistantInput['items'] = [
  { name: 'طماطم', daysLeft: 3 },
  { name: 'رز مطبوخ', daysLeft: 1, cooked: true },
  { name: 'فراخ', daysLeft: 2 },
  { name: 'لبن', daysLeft: 6 },
];

function ask(question: string, items = pantry): CookingAssistantInput {
  return { question, language: 'ar', items };
}

function answer(body: Record<string, unknown>) {
  return { text: JSON.stringify({ onTopic: true, reheatingNote: '', usedItems: [], ...body }) };
}

async function run(steps: ConstructorParameters<typeof FakeProvider>[1], input: CookingAssistantInput, dailyLimit = 40) {
  const store = new MemoryAiStore();
  const provider = new FakeProvider('gemini', steps);
  const runner = new AiTaskRunner([provider], store, { timeoutMs: 1000, cacheDays: 30 });
  const outcome = await runner.run(new CookingAssistantTask(), input, { userId: 'u1', dailyLimit });
  return { outcome, provider, store };
}

describe('cooking assistant (US-4.02)', () => {
  it('answers from the pantry, soonest expiry first, and keeps only real pantry items', async () => {
    const { outcome, provider } = await run(
      [answer({ answer: 'اعمل رز بالفراخ والطماطم.', usedItems: ['رز مطبوخ', 'فراخ', 'سلمون'], reheatingNote: 'سخّنه مرة واحدة.' })],
      ask('أطبخ إيه بالرز والفراخ اللي فاضلين؟'),
    );
    expect(outcome.fallbackUsed).toBe(false);
    expect(outcome.result.usedItems).toEqual(['رز مطبوخ', 'فراخ']);
    const prompt = provider.calls[0].user.split('Pantry, soonest expiry first:')[1];
    expect(prompt.indexOf('رز مطبوخ')).toBeLessThan(prompt.indexOf('فراخ'));
    expect(prompt.indexOf('فراخ')).toBeLessThan(prompt.indexOf('طماطم'));
    expect(prompt).toContain('(cooked leftovers)');
  });

  it('adds a reheating note for leftovers when the model leaves it out', async () => {
    const { outcome } = await run([answer({ answer: 'Make fried rice with the chicken.' })], {
      question: 'What can I cook with leftover rice and chicken?',
      language: 'ar',
      items: pantry,
    });
    expect(outcome.input.language).toBe('en');
    expect(outcome.result.reheatingNote).toBe(TEXT.en.reheating);
  });

  it('declines non-food questions with the fixed text, whatever the model wrote', async () => {
    const { outcome } = await run([answer({ onTopic: false, answer: 'The match is at 9.' })], ask('مين هيكسب الماتش النهارده؟'));
    expect(outcome.result).toEqual({ onTopic: false, answer: TEXT.ar.decline, reheatingNote: '', usedItems: [] });
  });

  it('NFR-07: replaces medical advice and unsafe handling', async () => {
    const medical = await run([answer({ answer: 'Bitter melon lowers blood sugar, eat it daily.' })], ask('Is this good for diabetes?'));
    expect(medical.outcome.result.onTopic).toBe(false);

    const unsafe = await run(
      [answer({ answer: 'Leave the cooked rice out on the counter overnight, then reheat it twice.' })],
      ask('How do I keep cooked rice?'),
    );
    expect(unsafe.outcome.result.answer).toBe(TEXT.en.unsafe);
    expect(unsafe.outcome.result.reheatingNote).toBe(TEXT.en.reheating);

    const unsafeAr = await run([answer({ answer: 'سيب الرز برة التلاجة طول الليل عادي.' })], ask('أحفظ الرز إزاي؟'));
    expect(unsafeAr.outcome.result.answer).toBe(TEXT.ar.unsafe);
  });

  it('masks personal data in the question before the model sees it (US-14.03)', async () => {
    const { outcome, provider } = await run([answer({ answer: 'تمام.' })], ask('اسمي: أحمد علي ورقمي 01012345678، أطبخ إيه؟'));
    expect(provider.calls[0].user).not.toContain('01012345678');
    expect(outcome.input.question).toContain('[phone]');
  });

  it('falls back without AI, pointing at the items closest to expiry (NFR-22)', async () => {
    const { outcome, store } = await run([{ error: 'unavailable' }, { error: 'unavailable' }], ask('أطبخ إيه؟'));
    expect(outcome.fallbackUsed).toBe(true);
    expect(outcome.result.usedItems).toEqual(['رز مطبوخ', 'فراخ', 'طماطم']);
    expect(outcome.result.answer).toContain('رز مطبوخ');
    expect(outcome.result.reheatingNote).toBe(TEXT.ar.reheating);
    expect(store.logs.at(-1)?.provider).toBe('fallback');
  });

  it('stops calling the model after the daily limit', async () => {
    const { outcome, provider } = await run([answer({ answer: 'x' })], ask('أطبخ إيه؟'), 0);
    expect(provider.calls).toHaveLength(0);
    expect(outcome.fallbackUsed).toBe(true);
  });

  it('removes stray letters from other scripts that small models slip into Arabic', async () => {
    const { outcome } = await run([answer({ answer: 'اعمل فتة بالرز والفر\u0E48اخ (2 كوباية) 🍗.' })], ask('أطبخ إيه؟'));
    expect(outcome.result.answer).toBe('اعمل فتة بالرز والفراخ (2 كوباية) 🍗.');
  });

  it('applies the safety checks to cached answers too', async () => {
    const store = new MemoryAiStore();
    const task = new CookingAssistantTask();
    const runner = new AiTaskRunner([new FakeProvider('gemini', [answer({ answer: 'ok' })])], store, { timeoutMs: 1000, cacheDays: 30 });
    await runner.run(task, ask('How do I keep cooked rice?'), { userId: 'u1', dailyLimit: 40 });
    // An answer cached before a safety rule existed.
    const [key] = [...store.cache.keys()];
    store.cache.set(key, {
      response: { onTopic: true, answer: 'Leave it out on the counter overnight.', reheatingNote: '', usedItems: [] },
      provider: 'gemini',
      model: null,
    });
    const again = await runner.run(task, ask('How do I keep cooked rice?'), { userId: 'u1', dailyLimit: 40 });
    expect(again.fromCache).toBe(true);
    expect(again.result.answer).toBe(TEXT.en.unsafe);
  });

  it('answers in the language of the question', () => {
    expect(answerLanguage('what can I cook?', 'ar')).toBe('en');
    expect(answerLanguage('أطبخ إيه؟', 'en')).toBe('ar');
    expect(answerLanguage('???', 'en')).toBe('en');
  });
});
