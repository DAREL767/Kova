import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(
  new URL('../public/experiencias/ruleta-kova-7d9a41.html', import.meta.url),
  'utf8',
);
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

test('la ruleta es una página autónoma, sin tienda, peticiones ni recursos externos', () => {
  assert.match(html, /<meta name="robots" content="noindex,nofollow,noarchive">/);
  assert.match(html, /<canvas id="wheel"/);
  assert.match(html, /aria-live="polite"/);
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=|id="root"|<nav|<header|<footer/i);
  assert.doesNotMatch(script, /fetch\(|XMLHttpRequest|\/api\/|localStorage|sessionStorage/);
});

test('cada resultado coincide con el segmento bajo la flecha y no permite giros superpuestos', () => {
  for (let winner = 0; winner < 10; winner++) {
    let frame;
    let click;
    let randomCalls = 0;
    let arcs = [];
    const canvasContext = new Proxy(
      {
        clearRect: () => {
          arcs = [];
        },
        arc: (_x, _y, radius, start, end) => {
          if (radius > 100) arcs.push({ start, end });
        },
        measureText: (text) => ({ width: text.length * 12 }),
      },
      { get: (target, key) => target[key] ?? (() => {}) },
    );
    const classes = new Set();
    const elements = {
      wheel: { getContext: () => canvasContext },
      spin: {
        disabled: false,
        addEventListener: (_type, callback) => {
          click = callback;
        },
      },
      result: {
        classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name) },
      },
      prize: { textContent: '' },
    };
    const math = Object.create(Math);
    math.random = () => {
      randomCalls++;
      return (winner + 0.5) / 10;
    };
    const context = vm.createContext({
      document: { getElementById: (id) => elements[id] },
      performance: { now: () => 0 },
      Math: math,
      requestAnimationFrame: (callback) => {
        frame = callback;
      },
    });
    vm.runInContext(script, context);
    click();
    assert.equal(elements.spin.disabled, true);
    click();
    assert.equal(randomCalls, 1);
    frame(5200);
    assert.equal(elements.spin.disabled, false);
    assert.ok(classes.has('show'));
    assert.equal(elements.prize.textContent, vm.runInContext(`prizes[${winner}]`, context));
    const turn = Math.PI * 2;
    const pointedSegment = arcs.findIndex((arc) => {
      const relative = (((-Math.PI / 2 - arc.start) % turn) + turn) % turn;
      return relative < arc.end - arc.start;
    });
    assert.equal(pointedSegment, winner);
    click();
    assert.equal(randomCalls, 2);
    assert.equal(classes.has('show'), false);
  }
});
