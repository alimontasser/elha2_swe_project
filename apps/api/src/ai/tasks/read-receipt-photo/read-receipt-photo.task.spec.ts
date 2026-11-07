import { FakeProvider } from '../../providers/fake.provider';
import { OpenAiCompatibleProvider } from '../../providers/openai-compatible.provider';
import { AiTaskRunner } from '../../task-runner';
import { MemoryAiStore } from '../../testing';
import { ReadReceiptPhotoTask } from './read-receipt-photo.task';

const photo = { mimeType: 'image/jpeg', base64: Buffer.from('fake jpeg bytes').toString('base64') };
const lines = (l: string[]) => ({ text: JSON.stringify({ lines: l }) });

function runner(providers: ConstructorParameters<typeof AiTaskRunner>[0], store = new MemoryAiStore()) {
  return {
    store,
    run: () =>
      new AiTaskRunner(providers, store, { timeoutMs: 1000, cacheDays: 30 }).run(
        new ReadReceiptPhotoTask(),
        { photo },
        { userId: 'u1', dailyLimit: 30 },
      ),
  };
}

describe('reading a receipt photo (US-2.01)', () => {
  it('sends the photo to the model and returns its lines, cleaned', async () => {
    const gemini = new FakeProvider('gemini', [lines(['FRESH MART', '  MILK FULL CRM 1L   x2   64.00 ', '', 'بقالة الأمل'])]);
    const { run } = runner([gemini]);
    const outcome = await run();
    expect(gemini.calls[0].images).toEqual([photo]);
    expect(outcome.result.lines).toEqual(['FRESH MART', 'MILK FULL CRM 1L x2 64.00', 'بقالة الأمل']);
    expect(outcome.fallbackUsed).toBe(false);
  });

  it('US-14.03: masks names, phones and cards before anything is cached, and never keeps the photo', async () => {
    const gemini = new FakeProvider('gemini', [
      lines(['Member: Sara Mostafa', 'Tel +20 112 345 6789', 'VISA 4111 1111 1111 1111', 'EGGS 10PC 55.00']),
    ]);
    const { run, store } = runner([gemini]);
    const outcome = await run();
    expect(outcome.result.lines.join(' ')).not.toMatch(/Sara|112 345|4111/);
    expect(outcome.result.lines).toContain('EGGS 10PC 55.00');
    const cached = JSON.stringify([...store.cache.values()]);
    expect(cached).not.toMatch(/Sara|112 345|4111/);
    expect(cached).not.toContain(photo.base64);
    expect(JSON.stringify(store.logs)).not.toContain(photo.base64);
  });

  it('skips a backup provider that cannot read images, then uses the next one', async () => {
    const groqTextOnly = new OpenAiCompatibleProvider('groq', 'http://unused.invalid', 'key', 'text-model');
    const gemini = new FakeProvider('gemini', [lines(['EGGS 10PC 55.00'])]);
    const { run, store } = runner([groqTextOnly, gemini]);
    const outcome = await run();
    expect(outcome.provider).toBe('gemini');
    expect(store.logs[0].errorCodes).toEqual(['groq:bad_request']);
  });

  it('without any model that can read it, returns no lines so the app offers entry by hand (NFR-22)', async () => {
    const { run } = runner([new FakeProvider('gemini', [{ error: 'unavailable' }, { error: 'unavailable' }])]);
    const outcome = await run();
    expect(outcome.fallbackUsed).toBe(true);
    expect(outcome.result.lines).toEqual([]);
  });
});
