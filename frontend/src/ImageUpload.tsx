import { useState } from 'react';
import { Upload } from 'lucide-react';
import { ErrorMessage } from './components';
import { apiUrl } from './api';
export function ImageUpload({
  onUploaded,
  multiple = false,
}: {
  onUploaded: (urls: string[]) => void;
  multiple?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <div className="image-upload">
      <label className={`upload-button ${busy ? 'upload-busy' : ''}`}>
        <Upload size={16} />
        {busy ? 'Subiendo imágenes…' : multiple ? 'Subir imágenes' : 'Subir imagen'}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple={multiple}
          disabled={busy}
          onChange={async (e) => {
            const input = e.currentTarget;
            const files = [...(input.files ?? [])];
            if (!files.length) return;
            if (files.some((f) => f.size > 8 * 1024 * 1024)) {
              setError('Cada imagen puede ocupar hasta 8 MB.');
              input.value = '';
              return;
            }
            setBusy(true);
            setError('');
            const urls: string[] = [];
            try {
              for (const file of files) {
                const form = new FormData();
                form.append('image', file);
                const response = await fetch(apiUrl('/media'), {
                  method: 'POST',
                  body: form,
                  credentials: 'include',
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error ?? 'No se pudo subir la imagen');
                urls.push(apiUrl(`/media/${data.url.split('/').pop()}`));
              }
            } catch (err) {
              setError((err as Error).message);
            } finally {
              if (urls.length) onUploaded(urls);
              setBusy(false);
              input.value = '';
            }
          }}
        />
      </label>
      <small>PNG, JPEG o WebP · máximo 8 MB por imagen</small>
      <ErrorMessage text={error} />
    </div>
  );
}
