import type { About, AboutContent, AboutSection } from './types';
import source from './brand-content.json' with { type: 'json' };

const headings = ['Historia', '¿A que nos dedicamos?', 'Mision', 'Vision', 'Valores'];
const titles = [
  'Nuestra historia',
  'Lo que hacemos',
  'Nuestra misión',
  'Nuestra visión',
  'Nuestros valores',
];
const sourceText = source.map((text) => text.trim());

export function getAboutSections(content?: About | AboutContent | null): AboutSection[] {
  if (content && 'sections' in content) return content.sections;
  if (content) return [{ id: 'legacy-about', ...content }];
  return headings.map((heading, index) => ({
    id: `brand-section-${index + 1}`,
    title: titles[index],
    text: sourceText
      .slice(
        sourceText.indexOf(heading) + 1,
        sourceText.indexOf(headings[index + 1] ?? 'Contactos'),
      )
      .join('\n\n'),
  }));
}
