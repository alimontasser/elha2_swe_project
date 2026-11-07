import type { CatalogueCandidate, ICatalogueMatch } from '../../../expiry/expiry.interfaces';
import { FakeProvider } from '../../providers/fake.provider';
import { AiTaskRunner } from '../../task-runner';
import { MemoryAiStore } from '../../testing';
import { ReviewProductTask } from './review-product.task';

const cheese: CatalogueCandidate = {
  id: 'roumi-cheese',
  nameAr: 'جبنة رومي',
  nameEn: 'Roumi cheese',
  category: 'dairy',
  unit: 'kg',
  defaultQuantity: 0.25,
  defaultStorage: 'fridge',
  shelfLifeDays: { fridge: 30 },
  score: 0.9,
};
const catalogue: ICatalogueMatch = { closest: () => Promise.resolve([[cheese]]), byIds: () => Promise.resolve(new Map()) };

const answer = (r: Record<string, unknown>) => ({
  text: JSON.stringify({
    decision: 'accept',
    reason: 'real product',
    nameAr: 'جبنة رومي دومتي',
    nameEn: 'Domty Roumi Cheese',
    category: 'dairy',
    catalogueId: 'roumi-cheese',
    quantity: 250,
    unit: 'g',
    confidence: 0.9,
    ...r,
  }),
});

async function review(name: string, steps: ConstructorParameters<typeof FakeProvider>[1]) {
  const provider = new FakeProvider('gemini', steps);
  const outcome = await new AiTaskRunner([provider], new MemoryAiStore(), { timeoutMs: 1000, cacheDays: 30 }).run(
    new ReviewProductTask(catalogue),
    { barcode: '6221234567890', name },
    { userId: 'u1', dailyLimit: 20 },
  );
  return { outcome, provider };
}

describe('reviewing a name for an unknown barcode (US-2.03)', () => {
  it('offers the closest catalogue items and keeps the AI’s match when it was offered', async () => {
    const { outcome, provider } = await review('جبنه رومي دومتي ٢٥٠ جم', [answer({})]);
    expect(provider.calls[0].user).toContain('roumi-cheese');
    expect(provider.calls[0].user).toContain('made in Egypt');
    expect(outcome.result).toMatchObject({ decision: 'accept', catalogueId: 'roumi-cheese', quantity: 250, unit: 'g' });
  });

  it('drops a catalogue id that was not offered', async () => {
    const { outcome } = await review('جبنه رومي', [answer({ catalogueId: 'invented-id' })]);
    expect(outcome.result.catalogueId).toBe('');
  });

  it('rejects names with personal details before trusting the model', async () => {
    const { outcome, provider } = await review('رقمي 01012345678', [answer({})]);
    expect(provider.calls[0].user).not.toContain('01012345678');
    expect(outcome.result).toMatchObject({ decision: 'reject', reason: 'contains personal details' });
  });

  it('an accepted answer without usable names becomes unsure', async () => {
    const { outcome } = await review('xx', [answer({ nameAr: '  ', nameEn: '' })]);
    expect(outcome.result.decision).toBe('unsure');
  });

  it('without a model the suggestion stays undecided (NFR-22)', async () => {
    const { outcome } = await review('بسكوت', [{ error: 'unavailable' }, { error: 'unavailable' }]);
    expect(outcome.fallbackUsed).toBe(true);
    expect(outcome.result.decision).toBe('unsure');
  });
});
