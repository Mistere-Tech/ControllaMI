import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JsonStreamParser } from '../src/core/jsonStream';

test('estrae un singolo oggetto completo', () => {
  const p = new JsonStreamParser();
  assert.deepEqual(p.feed('{"rval":0,"msg_id":257,"param":5}'), [{ rval: 0, msg_id: 257, param: 5 }]);
});

test('estrae più oggetti attaccati senza separatori', () => {
  const p = new JsonStreamParser();
  const out = p.feed('{"msg_id":7,"type":"battery"}{"rval":0,"msg_id":513}');
  assert.equal(out.length, 2);
  assert.equal(out[0].msg_id, 7);
  assert.equal(out[1].msg_id, 513);
});

test('ricompone un oggetto spezzato in più pezzi', () => {
  const p = new JsonStreamParser();
  assert.deepEqual(p.feed('{"rval":0,"ms'), []);
  assert.deepEqual(p.feed('g_id":3,"param":[{"a":"b"}'), []);
  assert.deepEqual(p.feed(']}'), [{ rval: 0, msg_id: 3, param: [{ a: 'b' }] }]);
});

test('ignora graffe dentro le stringhe e gli escape', () => {
  const p = new JsonStreamParser();
  const out = p.feed('{"param":"a } b { \\" c"}');
  assert.deepEqual(out, [{ param: 'a } b { " c' }]);
});

test('salta spazi e newline tra un oggetto e l\'altro', () => {
  const p = new JsonStreamParser();
  assert.equal(p.feed(' \n{"a":1}\r\n {"b":2}').length, 2);
});

test('scarta un oggetto malformato senza bloccare i successivi', () => {
  const p = new JsonStreamParser();
  const out = p.feed('{"a":1,,}{"b":2}');
  assert.deepEqual(out, [{ b: 2 }]);
});
