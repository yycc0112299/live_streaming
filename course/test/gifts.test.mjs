import test from 'node:test';
import assert from 'node:assert/strict';
import { enqueueGift, FORMAL_VOICE_MESSAGE_POINTS, VOICE_MESSAGE_POINTS } from '../gifts.mjs';

test('larger gifts jump ahead while equal gifts keep arrival order', () => {
  const queue = [{ id: 'small', amount: 1 }, { id: 'first-ten', amount: 10 }];
  assert.deepEqual(enqueueGift(queue, { id: 'large', amount: 100 }).map((gift) => gift.id), ['large', 'first-ten', 'small']);
  assert.deepEqual(enqueueGift(queue, { id: 'second-ten', amount: 10 }).map((gift) => gift.id), ['first-ten', 'second-ten', 'small']);
  assert.equal(FORMAL_VOICE_MESSAGE_POINTS, 25);
});

test('repeated identical gifts from one sender merge into a combo instead of queueing', () => {
  let queue = [];
  for (let i = 0; i < 5; i++) queue = enqueueGift(queue, { id: `h${i}`, amount: 1, nickname: 'Amy' });
  assert.equal(queue.length, 1); assert.equal(queue[0].count, 5); assert.equal(queue[0].id, 'h0', 'the playing animation keeps its id');
  queue = enqueueGift(queue, { id: 'b1', amount: 1, nickname: 'Bo' });
  queue = enqueueGift(queue, { id: 'a-rose', amount: 5, nickname: 'Amy' });
  assert.deepEqual(queue.map((g) => [g.id, g.count || 1]), [['a-rose', 1], ['h0', 5], ['b1', 1]]);
  queue = enqueueGift(queue, { id: 'voice', amount: 25, nickname: 'Amy', message: 'hi' });
  queue = enqueueGift(queue, { id: 'voice2', amount: 25, nickname: 'Amy', message: 'hi again' });
  assert.equal(queue.filter((g) => g.amount === 25).length, 2, 'voice messages are never merged');
});
