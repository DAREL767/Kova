import { useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { api, send } from '../api';
import { useStore } from '../store';
import { ErrorMessage, Loading } from '../components';
import {
  categories,
  money,
  type Product,
  type Variant,
  type Slide,
  type Content,
  type Order,
  type About,
  type Banner,
  type User,
  type ProductPageResult,
} from '../types';
import {
  defaultHomeBanner,
  defaultContactBanner,
  defaultAccessBanner,
  defaultAboutBanner,
} from '../brand';
import { BannerEditor } from '../BannerEditor';
import { ImageUpload } from '../ImageUpload';

const blankVariant = (): Variant => ({
  key: '',
  color: '',
  hex: '#4e5549',
  images: ['', ''],
  sizes: [{ size: 'M', stock: 1 }],
});
type Draft = Omit<Product, '_id' | '__v'>;
const blank = (): Draft => ({
  name: '',
  description: '',
  category: 'camisetas',
  gender: 'hombre',
  price: 1,
  variants: [blankVariant()],
});
export function Admin() {
  const { user, ready, notify, catalogVersion } = useStore();
  const [tab, setTab] = useState('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [draft, setDraft] = useState<Draft>(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [about, setAbout] = useState<About>({ title: '', text: '' });
  const [returns, setReturns] = useState<Order[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [staff, setStaff] = useState<User[]>([]);
  const [homeBanner, setHomeBanner] = useState<Banner | null>(null);
  const [contactBanner, setContactBanner] = useState<Banner | null>(null);
  const [accessBanner, setAccessBanner] = useState<Banner | null>(null);
  const [aboutBanner, setAboutBanner] = useState<Banner | null>(null);
  const [adminPage, setAdminPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  async function load() {
    const [p, c, r, people] = await Promise.all([
      api<ProductPageResult>(`/products/manage?limit=24&page=${adminPage}`),
      api<Content[]>('/content'),
      api<Order[]>('/shop/admin/returns'),
      user?.role === 'admin' ? api<User[]>('/auth/staff') : Promise.resolve([]),
    ]);
    setProducts(p.items);
    setTotal(p.total);
    setPages(p.pages);
    setSlides((c.find((i) => i.key === 'carousel')?.value as Slide[]) ?? []);
    setAbout((c.find((i) => i.key === 'about')?.value as About) ?? { title: '', text: '' });
    setHomeBanner((c.find((i) => i.key === 'homeBanner')?.value as Banner) ?? defaultHomeBanner);
    setContactBanner(
      (c.find((i) => i.key === 'contactBanner')?.value as Banner) ?? defaultContactBanner,
    );
    setReturns(r);
    setAccessBanner(
      (c.find((i) => i.key === 'accessBanner')?.value as Banner) ?? defaultAccessBanner,
    );
    setAboutBanner((c.find((i) => i.key === 'aboutBanner')?.value as Banner) ?? defaultAboutBanner);
    setStaff(people);
  }
  useEffect(() => {
    if (user && user.role !== 'customer') load().catch((e) => setError(e.message));
  }, [user, adminPage]);
  useEffect(() => {
    if (
      !catalogVersion ||
      !user ||
      user.role === 'customer' ||
      tab !== 'products' ||
      formOpen ||
      busy
    )
      return;
    let active = true;
    api<ProductPageResult>(`/products/manage?limit=24&page=${adminPage}`)
      .then((data) => {
        if (!active) return;
        setProducts(data.items);
        setTotal(data.total);
        setPages(data.pages);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [catalogVersion, user, tab, formOpen, busy, adminPage]);
  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/acceso?next=/personal" replace />;
  if (user.role === 'customer') return <Navigate to="/cuenta" replace />;
  function updateVariant(index: number, data: Partial<Variant>) {
    setDraft((d) => ({
      ...d,
      variants: d.variants.map((v, i) => (i === index ? { ...v, ...data } : v)),
    }));
  }
  async function run(task: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError('');
    try {
      await task();
      notify(message);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function saveProduct(e: FormEvent) {
    e.preventDefault();
    if (
      draft.variants.some((variant) => {
        const images = variant.images.map((image) => image.trim()).filter(Boolean);
        return images.length < 2 || images.length > 12 || new Set(images).size !== images.length;
      })
    ) {
      setError('Cada color debe tener entre 2 y 12 imágenes diferentes.');
      return;
    }
    const payload = {
      ...draft,
      variants: draft.variants.map((variant) => ({
        ...variant,
        images: variant.images.map((image) => image.trim()).filter(Boolean),
      })),
    };
    if (
      await run(
        () =>
          api(
            `/products${editing ? `/${editing}` : ''}`,
            send(editing ? 'PUT' : 'POST', editing ? { ...payload, revision } : payload),
          ),
        'Prenda guardada',
      )
    ) {
      setFormOpen(false);
      setEditing(null);
      setDraft(blank());
      await load().catch((e) => setError(e.message));
    }
  }
  function edit(p: Product) {
    setEditing(p._id);
    setRevision(p.__v ?? 0);
    setDraft({
      name: p.name,
      description: p.description,
      category: p.category,
      gender: p.gender,
      price: p.price,
      variants: p.variants.map((v) => ({
        key: v.key,
        color: v.color,
        hex: v.hex,
        images: [...v.images],
        sizes: v.sizes.map((s) => ({ size: s.size, stock: s.stock })),
      })),
    });
    setFormOpen(true);
  }
  async function createStaff(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    if (await run(() => api('/auth/staff', send('POST', data)), 'Cuenta de personal creada')) {
      form.reset();
      await load().catch((e) => setError(e.message));
    }
  }
  return (
    <div className="page admin-page">
      <span className="eyebrow">ESPACIO DEL PERSONAL / {user.name}</span>
      <h1>DETRÁS DE KOVA.</h1>
      <div className="account-tabs">
        {[
          ['products', 'Prendas'],
          ['content', 'Contenido'],
          ['returns', 'Devoluciones'],
          ...(user.role === 'admin' ? [['staff', 'Personal']] : []),
        ].map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? 'active' : ''}
            onClick={() => {
              setTab(key);
              setError('');
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <ErrorMessage text={error} />
      {tab === 'products' && (
        <>
          <div className="section-heading">
            <h2>CATÁLOGO ({total})</h2>
            <button
              className="button"
              onClick={() => {
                setFormOpen(true);
                setEditing(null);
                setDraft(blank());
              }}
            >
              <Plus size={16} /> NUEVA PRENDA
            </button>
          </div>
          {formOpen && (
            <form className="editor" onSubmit={saveProduct}>
              <div className="section-heading">
                <h2>{editing ? 'EDITAR PRENDA' : 'NUEVA PRENDA'}</h2>
                <button
                  className="icon"
                  type="button"
                  aria-label="Cerrar formulario"
                  onClick={() => setFormOpen(false)}
                >
                  <X />
                </button>
              </div>
              <div className="form-grid">
                <label>
                  Nombre
                  <input
                    required
                    minLength={2}
                    maxLength={160}
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </label>
                <label>
                  Precio (COP)
                  <input
                    type="number"
                    min={1}
                    max={100000000}
                    required
                    value={draft.price}
                    onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
                  />
                </label>
                <label>
                  Categoría
                  <select
                    value={draft.category}
                    onChange={(e) =>
                      setDraft({ ...draft, category: e.target.value as Draft['category'] })
                    }
                  >
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Público
                  <select
                    value={draft.gender}
                    onChange={(e) => setDraft({ ...draft, gender: e.target.value })}
                  >
                    <option value="hombre">Hombre</option>
                    <option value="mujer">Mujer</option>
                    <option value="unisex">Unisex</option>
                  </select>
                </label>
              </div>
              <label>
                Descripción
                <textarea
                  required
                  maxLength={5000}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </label>
              {draft.variants.map((v, i) => (
                <fieldset key={i}>
                  <legend>COLOR / VARIANTE {i + 1}</legend>
                  <div className="form-grid">
                    <label>
                      Identificador (ej. negro)
                      <input
                        required
                        pattern="[a-z0-9-]{1,60}"
                        value={v.key}
                        onChange={(e) => updateVariant(i, { key: e.target.value })}
                      />
                    </label>
                    <label>
                      Nombre del color
                      <input
                        required
                        value={v.color}
                        onChange={(e) => updateVariant(i, { color: e.target.value })}
                      />
                    </label>
                    <label>
                      Muestra de color
                      <input
                        type="color"
                        value={v.hex}
                        onChange={(e) => updateVariant(i, { hex: e.target.value })}
                      />
                    </label>
                  </div>
                  <label>
                    Imágenes, una URL por línea (mínimo 2)
                    <textarea
                      required
                      value={v.images.join('\n')}
                      onChange={(e) => updateVariant(i, { images: e.target.value.split('\n') })}
                    />
                    <small>
                      La primera será la portada; la segunda aparecerá al pasar el cursor.
                    </small>
                  </label>
                  <ImageUpload
                    multiple
                    onUploaded={(urls) =>
                      updateVariant(i, {
                        images: [...v.images.filter(Boolean), ...urls].slice(0, 12),
                      })
                    }
                  />
                  <div className="image-previews">
                    {v.images
                      .filter((url) => /^https?:\/\//.test(url) || url.startsWith('/api/media/'))
                      .map((url, n) => (
                        <img key={n} src={url} alt={`Referencia ${n + 1}`} />
                      ))}
                  </div>
                  <p>Tallas y existencias</p>
                  {v.sizes.map((s, j) => (
                    <div className="size-editor" key={j}>
                      <label>
                        Talla
                        <input
                          required
                          value={s.size}
                          onChange={(e) =>
                            updateVariant(i, {
                              sizes: v.sizes.map((entry, n) =>
                                n === j ? { ...entry, size: e.target.value } : entry,
                              ),
                            })
                          }
                        />
                      </label>
                      <label>
                        Stock
                        <input
                          type="number"
                          min={0}
                          max={100000}
                          required
                          value={s.stock}
                          onChange={(e) =>
                            updateVariant(i, {
                              sizes: v.sizes.map((entry, n) =>
                                n === j ? { ...entry, stock: Number(e.target.value) } : entry,
                              ),
                            })
                          }
                        />
                      </label>
                      <button
                        className="icon"
                        type="button"
                        disabled={v.sizes.length === 1}
                        aria-label="Eliminar talla"
                        onClick={() =>
                          updateVariant(i, { sizes: v.sizes.filter((_, n) => n !== j) })
                        }
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  ))}
                  <div className="editor-actions">
                    <button
                      type="button"
                      className="text-link"
                      onClick={() =>
                        updateVariant(i, { sizes: [...v.sizes, { size: '', stock: 1 }] })
                      }
                    >
                      + Añadir talla
                    </button>
                    {draft.variants.length > 1 && (
                      <button
                        type="button"
                        className="text-link"
                        onClick={() =>
                          setDraft({ ...draft, variants: draft.variants.filter((_, n) => n !== i) })
                        }
                      >
                        Eliminar color
                      </button>
                    )}
                  </div>
                </fieldset>
              ))}
              <div className="editor-actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() =>
                    setDraft({ ...draft, variants: [...draft.variants, blankVariant()] })
                  }
                >
                  + AÑADIR COLOR
                </button>
                <button className="button" disabled={busy}>
                  {busy ? 'GUARDANDO…' : 'GUARDAR PRENDA'}
                </button>
              </div>
            </form>
          )}
          <div className="admin-products">
            {products.map((p) => (
              <article key={p._id}>
                <img src={p.variants[0]?.images[0]} alt={p.name} />
                <div>
                  <b>{p.name}</b>
                  <p>
                    {p.category} · {money(p.price)}
                  </p>
                  <small>{p.variants.length} colores</small>
                </div>
                <button className="icon" aria-label={`Editar ${p.name}`} onClick={() => edit(p)}>
                  <Pencil size={17} />
                </button>
                <button
                  className="icon"
                  disabled={busy}
                  aria-label={`Eliminar ${p.name}`}
                  onClick={async () => {
                    if (window.confirm(`¿Eliminar ${p.name} del catálogo?`)) {
                      if (
                        await run(
                          () => api(`/products/${p._id}`, { method: 'DELETE' }),
                          'Prenda eliminada',
                        )
                      )
                        await load().catch((e) => setError(e.message));
                    }
                  }}
                >
                  <Trash2 size={17} />
                </button>
              </article>
            ))}
          </div>
          {pages > 1 && (
            <div className="pagination">
              <button
                className="button secondary"
                disabled={adminPage === 1 || busy}
                onClick={() => setAdminPage((n) => n - 1)}
              >
                ANTERIOR
              </button>
              <span>
                {adminPage} / {pages}
              </span>
              <button
                className="button secondary"
                disabled={adminPage >= pages || busy}
                onClick={() => setAdminPage((n) => n + 1)}
              >
                SIGUIENTE
              </button>
            </div>
          )}
        </>
      )}
      {tab === 'content' && (
        <div className="content-editor">
          {accessBanner && (
            <BannerEditor
              contentKey="accessBanner"
              initial={accessBanner}
              label="BANNER DE ACCESO"
              simple
            />
          )}
          {aboutBanner && (
            <BannerEditor
              contentKey="aboutBanner"
              initial={aboutBanner}
              label="BANNER DE NOSOTROS"
              simple
            />
          )}
          {homeBanner && (
            <BannerEditor contentKey="homeBanner" initial={homeBanner} label="BANNER DE INICIO" />
          )}
          {contactBanner && (
            <BannerEditor
              contentKey="contactBanner"
              initial={contactBanner}
              label="BANNER DE CONTACTO"
            />
          )}
          <form
            className="editor"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () => api('/content', send('PUT', { key: 'carousel', value: slides })),
                'Carrusel actualizado',
              );
            }}
          >
            <h2>CARRUSEL PROMOCIONAL</h2>
            <p>
              Las promociones activas sustituyen el banner base de inicio. Sin promociones se
              muestra el banner de inicio que hayas guardado.
            </p>
            {slides.map((s, i) => (
              <fieldset key={i}>
                <legend>Promoción {i + 1}</legend>
                <label>
                  Título
                  <input
                    required
                    maxLength={120}
                    value={s.title}
                    onChange={(e) =>
                      setSlides(
                        slides.map((v, j) => (j === i ? { ...v, title: e.target.value } : v)),
                      )
                    }
                  />
                </label>
                <label>
                  Imagen
                  <input
                    required
                    value={s.image}
                    onChange={(e) =>
                      setSlides(
                        slides.map((v, j) => (j === i ? { ...v, image: e.target.value } : v)),
                      )
                    }
                  />
                </label>
                <ImageUpload
                  onUploaded={(urls) =>
                    setSlides(slides.map((v, j) => (j === i ? { ...v, image: urls[0] } : v)))
                  }
                />
                <label>
                  Enlace interno (ej. /?category=calzado)
                  <input
                    value={s.href ?? ''}
                    onChange={(e) =>
                      setSlides(
                        slides.map((v, j) =>
                          j === i ? { ...v, href: e.target.value || undefined } : v,
                        ),
                      )
                    }
                  />
                </label>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setSlides(slides.filter((_, j) => j !== i))}
                >
                  Eliminar promoción
                </button>
              </fieldset>
            ))}
            <div className="editor-actions">
              <button
                type="button"
                className="text-link"
                disabled={slides.length >= 12}
                onClick={() => setSlides([...slides, { title: '', image: '' }])}
              >
                + Añadir promoción
              </button>
              <button className="button" disabled={busy}>
                GUARDAR CARRUSEL
              </button>
            </div>
          </form>
          <form
            className="editor"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () => api('/content', send('PUT', { key: 'about', value: about })),
                'Nosotros actualizado',
              );
            }}
          >
            <h2>NOSOTROS</h2>
            <label>
              Imagen de la historia (opcional)
              <input
                value={about.image ?? ''}
                onChange={(event) => setAbout({ ...about, image: event.target.value || undefined })}
              />
            </label>
            <ImageUpload onUploaded={(urls) => setAbout({ ...about, image: urls[0] })} />
            {about.image && (
              <div className="banner-image-preview">
                <img src={about.image} alt="Vista previa de la historia" />
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setAbout({ ...about, image: undefined })}
                >
                  Quitar imagen
                </button>
              </div>
            )}
            <p>
              La web muestra el texto de marca original hasta que guardes un contenido
              personalizado.
            </p>
            <label>
              Título
              <input
                required
                maxLength={160}
                value={about.title}
                onChange={(e) => setAbout({ ...about, title: e.target.value })}
              />
            </label>
            <label>
              Contenido
              <textarea
                required
                rows={12}
                maxLength={20000}
                value={about.text}
                onChange={(e) => setAbout({ ...about, text: e.target.value })}
              />
            </label>
            <button className="button" disabled={busy}>
              GUARDAR NOSOTROS
            </button>
          </form>
        </div>
      )}
      {tab === 'staff' && user.role === 'admin' && (
        <form className="editor narrow" onSubmit={createStaff}>
          <h2>PERSONAL ({staff.length} / 2)</h2>
          <p>Tu cuenta de administrador conserva el control de estas dos cuentas internas.</p>
          {staff.map((person) => (
            <div className="staff-person" key={person.id}>
              <div>
                <b>{person.name}</b>
                <p>{person.email}</p>
              </div>
              <button
                type="button"
                className="icon"
                aria-label={`Desactivar ${person.name}`}
                disabled={busy}
                onClick={async () => {
                  if (window.confirm(`¿Desactivar el acceso de ${person.name}?`)) {
                    if (
                      await run(
                        () => api(`/auth/staff/${person.id}`, { method: 'DELETE' }),
                        'Cuenta desactivada',
                      )
                    )
                      await load().catch((e) => setError(e.message));
                  }
                }}
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
          <h3>Nueva cuenta</h3>
          <p>Puedes crear hasta dos cuentas de personal.</p>
          <label>
            Nombre
            <input name="name" required minLength={2} maxLength={100} />
          </label>
          <label>
            Correo
            <input name="email" type="email" required />
          </label>
          <label>
            Contraseña
            <input
              name="password"
              type="password"
              minLength={12}
              maxLength={72}
              required
              autoComplete="new-password"
            />
          </label>
          <button className="button" disabled={busy || staff.length >= 2}>
            CREAR CUENTA
          </button>
        </form>
      )}
      {tab === 'returns' && (
        <>
          <h2>DEVOLUCIONES PENDIENTES</h2>
          {!returns.length && <p>No hay solicitudes pendientes.</p>}
          {returns.map((order) => (
            <article className="order" key={order._id}>
              <b>Pedido #{order._id.slice(-8).toUpperCase()}</b>
              <p>{(order as Order & { returnReason: string }).returnReason}</p>
              <p>{order.items.map((i) => `${i.name} (${i.quantity})`).join(', ')}</p>
              <button
                className="button"
                disabled={busy}
                onClick={async () => {
                  if (
                    await run(
                      () => api(`/shop/admin/returns/${order._id}/accept`, { method: 'POST' }),
                      'Devolución aceptada',
                    )
                  )
                    setReturns((list) => list.filter((o) => o._id !== order._id));
                }}
              >
                ACEPTAR Y REPONER STOCK
              </button>
            </article>
          ))}
        </>
      )}
    </div>
  );
}
