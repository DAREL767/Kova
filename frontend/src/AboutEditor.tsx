import { useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api, send } from './api';
import { ImageUpload } from './ImageUpload';
import { ErrorMessage } from './components';
import { useStore } from './store';
import type { AboutSection } from './types';

export function AboutEditor({
  initial,
  onSaved,
}: {
  initial: AboutSection[];
  onSaved: (sections: AboutSection[]) => void;
}) {
  const [sections, setSections] = useState(initial);
  const [draft, setDraft] = useState<AboutSection | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const busy = saving || uploading;
  const [error, setError] = useState('');
  const { notify } = useStore();

  async function persist(next: AboutSection[]) {
    setSaving(true);
    setError('');
    try {
      await api('/content', send('PUT', { key: 'about', value: { sections: next } }));
      setSections(next);
      onSaved(next);
      notify('Secciones de Nosotros actualizadas');
      return true;
    } catch (error) {
      setError((error as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const next = sections.some((section) => section.id === draft.id)
      ? sections.map((section) => (section.id === draft.id ? draft : section))
      : [...sections, draft];
    if (await persist(next)) setDraft(null);
  }

  return (
    <section className="editor about-editor">
      <h2>NOSOTROS</h2>
      <p>
        Organiza la historia en secciones con título, contenido e imagen opcional. Usa el lápiz para
        editar una sección.
      </p>
      <div className="about-section-list">
        {sections.map((section, index) => (
          <article className="about-section-card" key={section.id}>
            {section.image && <img src={section.image} alt="" loading="lazy" />}
            <div className="about-section-summary">
              <small>SECCIÓN {index + 1}</small>
              <h3>{section.title}</h3>
              <p>{section.text}</p>
            </div>
            <div className="staff-actions">
              <button
                type="button"
                className="icon"
                disabled={busy}
                title="Editar sección"
                aria-label={`Editar ${section.title}`}
                onClick={() => {
                  setError('');
                  setDraft({ ...section });
                }}
              >
                <Pencil size={17} />
              </button>
              <button
                type="button"
                className="icon"
                disabled={busy}
                title="Eliminar sección"
                aria-label={`Eliminar ${section.title}`}
                onClick={async () => {
                  if (window.confirm(`¿Eliminar la sección «${section.title}»?`)) {
                    if (await persist(sections.filter((item) => item.id !== section.id))) {
                      if (draft?.id === section.id) setDraft(null);
                    }
                  }
                }}
              >
                <Trash2 size={17} />
              </button>
            </div>
          </article>
        ))}
      </div>
      {!sections.length && (
        <p>No hay secciones. Añade la primera para mostrar contenido en Nosotros.</p>
      )}
      <button
        type="button"
        className="text-link"
        disabled={busy || sections.length >= 30}
        onClick={() => {
          setError('');
          setDraft({ id: crypto.randomUUID(), title: '', text: '' });
        }}
      >
        <Plus size={17} /> Añadir sección
      </button>
      <ErrorMessage text={error} />
      {draft && (
        <form className="about-section-form" onSubmit={save}>
          <h3>
            {sections.some((section) => section.id === draft.id)
              ? 'Editar sección'
              : 'Nueva sección'}
          </h3>
          <fieldset disabled={busy}>
            <label>
              Título
              <input
                required
                maxLength={160}
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              />
            </label>
            <label>
              Contenido
              <textarea
                required
                rows={8}
                maxLength={20000}
                value={draft.text}
                onChange={(event) => setDraft({ ...draft, text: event.target.value })}
              />
            </label>
            <label>
              Imagen (opcional)
              <input
                value={draft.image ?? ''}
                onChange={(event) => setDraft({ ...draft, image: event.target.value || undefined })}
              />
            </label>
            <ImageUpload
              onBusyChange={setUploading}
              onUploaded={(urls) =>
                setDraft((current) =>
                  current?.id === draft.id ? { ...current, image: urls[0] } : current,
                )
              }
            />
            {draft.image && (
              <div className="banner-image-preview">
                <img src={draft.image} alt="Vista previa de la sección" />
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setDraft({ ...draft, image: undefined })}
                >
                  Quitar imagen
                </button>
              </div>
            )}
            <div className="editor-actions">
              <button type="submit" className="button">
                {busy ? 'GUARDANDO…' : 'GUARDAR SECCIÓN'}
              </button>
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  setDraft(null);
                  setError('');
                }}
              >
                Cancelar
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </section>
  );
}
