import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAboutSections } from '../src/about.ts';

test('el contenido anterior conserva título, párrafos e imagen como una sección editable', () => {
  const previous = {
    title: 'Nuestra historia',
    text: 'Primer párrafo.\n\nSegundo párrafo.',
    image: 'https://example.com/story.jpg',
  };
  assert.deepEqual(getAboutSections(previous), [{ id: 'legacy-about', ...previous }]);
});

test('las secciones nuevas conservan su orden y una lista vacía no restaura el texto predeterminado', () => {
  const sections = [
    { id: 'first', title: 'Historia', text: 'Primero' },
    { id: 'second', title: 'Misión', text: 'Segundo', image: 'https://example.com/mission.jpg' },
  ];
  assert.deepEqual(getAboutSections({ sections }), sections);
  assert.deepEqual(getAboutSections({ sections: [] }), []);
});

test('la historia predeterminada se ofrece como secciones completas y editables', () => {
  const sections = getAboutSections();
  assert.equal(sections.length, 5);
  assert.equal(new Set(sections.map((section) => section.id)).size, sections.length);
  assert.ok(sections.every((section) => section.title && section.text));
  assert.ok(sections[0].text.includes('\n\n'));
  assert.ok(sections.every((section) => !/pantalones/i.test(section.text)));
});
