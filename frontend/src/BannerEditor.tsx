import { useState, type FormEvent } from 'react';
import { api, send } from './api';
import { ImageUpload } from './ImageUpload';
import { ErrorMessage } from './components';
import { useStore } from './store';
import type { Banner } from './types';
export function BannerEditor({
  contentKey,
  initial,
  label,
}: {
  contentKey: 'homeBanner' | 'contactBanner';
  initial: Banner;
  label: string;
}) {
  const [banner, setBanner] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { notify } = useStore();
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/content', send('PUT', { key: contentKey, value: banner }));
      notify('Banner guardado');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="editor" onSubmit={save}>
      <h2>{label}</h2>
      <label>
        Título
        <textarea
          required
          maxLength={120}
          value={banner.title}
          onChange={(e) => setBanner({ ...banner, title: e.target.value })}
        />
      </label>
      <label>
        Texto de apoyo
        <textarea
          maxLength={500}
          value={banner.subtitle}
          onChange={(e) => setBanner({ ...banner, subtitle: e.target.value })}
        />
      </label>
      <label>
        Imagen de fondo (opcional)
        <input
          value={banner.image ?? ''}
          onChange={(e) => setBanner({ ...banner, image: e.target.value || undefined })}
        />
      </label>
      <ImageUpload onUploaded={(urls) => setBanner({ ...banner, image: urls[0] })} />
      {banner.image && (
        <div className="banner-image-preview">
          <img src={banner.image} alt="Vista previa del banner" />
          <button
            className="text-link"
            type="button"
            onClick={() => setBanner({ ...banner, image: undefined })}
          >
            Quitar imagen
          </button>
        </div>
      )}
      <div className="form-grid">
        <label>
          Texto del botón (opcional)
          <input
            maxLength={50}
            value={banner.ctaLabel ?? ''}
            onChange={(e) => setBanner({ ...banner, ctaLabel: e.target.value || undefined })}
          />
        </label>
        <label>
          Destino interno del botón
          <input
            placeholder="/?category=calzado"
            value={banner.href ?? ''}
            onChange={(e) => setBanner({ ...banner, href: e.target.value || undefined })}
          />
        </label>
      </div>
      <ErrorMessage text={error} />
      <button className="button" disabled={busy}>
        {busy ? 'GUARDANDO…' : 'GUARDAR BANNER'}
      </button>
    </form>
  );
}
