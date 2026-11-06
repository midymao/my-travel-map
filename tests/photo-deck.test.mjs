import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
const source = await readFile(new URL('../src/components/photoDeckState.ts', import.meta.url), 'utf8');
const { PhotoDeckState } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`);
const photos = [
  { src: 'sydney', aspectRatio: 4 / 3, href: '/places/sydney/', title: '悉尼' },
  { src: 'melbourne', aspectRatio: 3 / 4, href: '/places/melbourne/', title: '墨尔本' },
  { src: 'reef', aspectRatio: 4 / 3, href: '/places/great-barrier-reef/', title: '大堡礁' },
];

test('random cover uses only landscape photographs, chosen once per page visit', () => {
  let calls = 0;
  const state = new PhotoDeckState(photos, () => { calls++; return .99; });
  assert.equal(state.coverIndex, 2);
  state.open(); state.select(1); state.close(); state.open(); state.close();
  assert.equal(calls, 1);
  assert.equal(state.visibleIndex, 1, 'closing retains the last selected portrait');
  assert.equal(state.coverIndex, 1, 'the selected photograph becomes the collapsed cover');
  state.open();
  assert.equal(state.visibleIndex, 1, 'reopening remembers the selected portrait');
});

test('closing retains the last photograph and stack until a fresh page chooses a new cover', () => {
  const state = new PhotoDeckState(photos, () => 0);
  state.open(); state.select(1); state.select(2); state.close();
  assert.equal(state.visibleIndex, 2);
  assert.equal(state.slots[2], -1);
  state.open(); state.select(1); state.close();
  const slots = [...state.slots];
  state.close(); state.open();
  assert.equal(state.visibleIndex, 1);
  assert.deepEqual(state.slots, slots);
  assert.equal(new PhotoDeckState(photos, () => 0).visibleIndex, 0, 'a refresh starts a new random choice');
});

test('first click opens; selected city determines the next main photograph click', () => {
  const state = new PhotoDeckState(photos, () => 0);
  assert.equal(state.activateMain(), null);
  assert.equal(state.isOpen, true);
  state.select(1);
  assert.equal(state.activateMain(), '/places/melbourne/');
  state.select(2);
  assert.equal(state.activateMain(), '/places/great-barrier-reef/');
  state.close();
  assert.equal(state.activateMain(), null, 'a closed deck always opens before navigating');
});

test('every photograph in a single-place album routes to that place', () => {
  const fiji = photos.map(photo => ({ ...photo, href: '/places/fiji/', title: '斐济' }));
  const state = new PhotoDeckState(fiji, () => .5);
  state.open();
  fiji.forEach((_, index) => { state.select(index); assert.equal(state.activateMain(), '/places/fiji/'); });
});

test('closed or invalid selections cannot change the destination', () => {
  const state = new PhotoDeckState(photos, () => 0);
  state.select(1); assert.equal(state.selectedIndex, 0);
  state.open();
  [-1, 10, 1.5, NaN].forEach(index => state.select(index));
  assert.equal(state.selectedIndex, 0);
});

test('promoting a rear photograph exchanges only its slot with the cover', () => {
  const state = new PhotoDeckState(photos, () => 0);
  state.open();
  const before = [...state.slots];
  state.select(1);
  assert.equal(state.slots[1], -1);
  assert.equal(state.slots[0], before[1]);
  assert.equal(state.slots[2], before[2], 'unrelated photograph stays in place');
  state.select(2);
  assert.deepEqual([...state.slots].sort(), [-1, 0, 1]);
  const selectedSlots = [...state.slots];
  state.close(); state.open();
  assert.deepEqual(state.slots, selectedSlots, 'reopening preserves the selected stack');
});
