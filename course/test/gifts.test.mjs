import test from 'node:test';
import assert from 'node:assert/strict';
import { enqueueGift, FORMAL_VOICE_MESSAGE_POINTS, VOICE_MESSAGE_POINTS } from '../gifts.mjs';

test('larger gifts jump ahead while equal gifts keep arrival order', () => {
  const queue = [{ id: 'small', amount: 1 }, { id: 'first-ten', amount: 10 }];
  assert.deepEqual(enqueueGift(queue, { id: 'large', amount: 100 }).map((gift) => gift.id), ['large', 'first-ten', 'small']);
  assert.deepEqual(enqueueGift(queue, { id: 'second-ten', amount: 10 }).map((gift) => gift.id), ['first-ten', 'second-ten', 'small']);
  assert.equal(FORMAL_VOICE_MESSAGE_POINTS, 25);
});
