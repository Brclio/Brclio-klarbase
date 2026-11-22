import assert from 'node:assert/strict';
import { test } from 'node:test';
import { regionName, wildName } from '../src/i18n/atlas.js';

test('first visit uses Chinese and later visits use the last explicit choice', async () => {
  const values = new Map([['klarbase.v2.settings', '{"sound":true}']]);
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const mock = { getItem:key => values.get(key) ?? null, setItem:(key, value) => values.set(key, value) };
  Object.defineProperty(globalThis, 'localStorage', { configurable:true, value:mock });
  try {
    const first = await import('../src/i18n.js?first-visit');
    assert.equal(first.t('Play', '开始游戏'), '开始游戏');
    const changes = [];
    const unsubscribe = first.onLanguageChange(locale => changes.push(locale));
    first.setLanguage('en');
    first.setLanguage('en');
    assert.deepEqual(changes, ['en']);
    assert.equal(first.t('Play', '开始游戏'), 'Play');
    const reopened = await import('../src/i18n.js?reopened');
    assert.equal(reopened.getLanguage(), 'en');
    reopened.setLanguage('zh-CN');
    assert.equal((await import('../src/i18n.js?return-to-chinese')).getLanguage(), 'zh-CN');
    assert.equal(values.get('klarbase.v2.settings'), '{"sound":true}');
    unsubscribe();
    first.setLanguage('zh-CN');
    assert.deepEqual(changes, ['en']);

    mock.getItem = mock.setItem = () => { throw new Error('Storage is unavailable'); };
    const privateVisit = await import('../src/i18n.js?storage-unavailable');
    assert.equal(privateVisit.getLanguage(), 'zh-CN');
    privateVisit.setLanguage('en');
    assert.equal(privateVisit.getLanguage(), 'en');
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});

test('atlas display names keep their original English identities', async () => {
  const { setLanguage } = await import('../src/i18n.js');
  setLanguage('zh-CN');
  assert.equal(regionName('Canopy Rise'), '树冠高地');
  assert.equal(wildName('Moonlit Meadow'), '月光草甸');
  setLanguage('en');
  assert.equal(regionName('Canopy Rise'), 'Canopy Rise');
  assert.equal(wildName('Moonlit Meadow'), 'Moonlit Meadow');
});
