import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Phone,
  Clock,
  Instagram,
} from 'lucide-react';
import { api } from '../api';
import { ProductCard, Empty, ErrorMessage, Loading } from '../components';
import { useStore } from '../store';
import {
  money,
  type Product,
  type Content,
  type Slide,
  type About,
  type Banner,
  type ProductPageResult,
} from '../types';
import { defaultHomeBanner, defaultContactBanner } from '../brand';
import { BrandIcon } from '../BrandIcon';
import sourceText from '../brand-content.json';
const brandText = sourceText.map((text) => text.trim());

export function Home() {
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [homeBanner, setHomeBanner] = useState<Banner>(defaultHomeBanner);
  const [shoes, setShoes] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [moreBusy, setMoreBusy] = useState(false);
  const seed = useRef(Math.random());
  const [slide, setSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const search = params.get('q')?.trim() ?? '';
  const rail = useRef<HTMLDivElement>(null);
  const category = params.get('category') === 'tenis' ? 'calzado' : params.get('category');
  const gender = params.get('gender');
  const query = new URLSearchParams({ limit: '24', seed: String(seed.current) });
  if (category) query.set('category', category);
  else if (!search) query.set('collection', 'ropa');
  if (gender) query.set('gender', gender);
  if (search) query.set('q', search);
  const queryKey = query.toString();
  const latestQuery = useRef(queryKey);
  latestQuery.current = queryKey;
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setMoreBusy(false);
    setProducts([]);
    const timer = setTimeout(
      () =>
        api<ProductPageResult>(`/products/browse?${queryKey}&page=1`)
          .then((data) => {
            if (active) {
              setProducts(data.items);
              setTotal(data.total);
              setPage(1);
              setPages(data.pages);
            }
          })
          .catch((e) => {
            if (active) setError(e.message);
          })
          .finally(() => {
            if (active) setLoading(false);
          }),
      250,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [queryKey]);
  useEffect(() => {
    let active = true;
    api<Content[]>('/content')
      .then((data) => {
        if (active) {
          setSlides((data.find((c) => c.key === 'carousel')?.value as Slide[]) ?? []);
          setHomeBanner(
            (data.find((c) => c.key === 'homeBanner')?.value as Banner) ?? defaultHomeBanner,
          );
        }
      })
      .catch(() => {});
    api<Product[]>('/products?collection=calzado&limit=12')
      .then((data) => {
        if (active) setShoes(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  async function loadMore() {
    setMoreBusy(true);
    setError('');
    const key = queryKey;
    try {
      const data = await api<ProductPageResult>(`/products/browse?${key}&page=${page + 1}`);
      if (latestQuery.current === key) {
        setProducts((previous) => [
          ...previous,
          ...data.items.filter((p) => !previous.some((i) => i._id === p._id)),
        ]);
        setPage(data.page);
        setTotal(data.total);
        setPages(data.pages);
      }
    } catch (e) {
      if (latestQuery.current === key) setError((e as Error).message);
    } finally {
      if (latestQuery.current === key) setMoreBusy(false);
    }
  }
  useEffect(() => {
    if (slides.length < 2) return;
    const timer = setInterval(() => setSlide((n) => (n + 1) % slides.length), 6500);
    return () => clearInterval(timer);
  }, [slides.length]);
  const clothes = products;
  const current = slides[slide];
  return (
    <>
      <div className="announcement">TU ESTILO. TU RITMO. TU PRÓXIMO MOVIMIENTO.</div>
      {!category && !gender && (
        <section
          className={`hero ${current || homeBanner.image ? 'photo-hero' : ''}`}
          aria-label="Promociones"
          style={
            current || homeBanner.image
              ? {
                  backgroundImage: `linear-gradient(90deg,rgba(0,0,0,.65),rgba(0,0,0,.05)),url(${JSON.stringify(current?.image || homeBanner.image)})`,
                }
              : undefined
          }
        >
          <div className="hero-copy">
            <div className="eyebrow">
              <span /> KOVA · COLOMBIA
            </div>
            <h1 className="preserve">{current?.title || homeBanner.title}</h1>
            {!current && <p className="preserve">{homeBanner.subtitle}</p>}
            <a
              className="button light"
              href={
                current?.href ||
                (homeBanner.href && homeBanner.href !== '/' ? homeBanner.href : '#coleccion')
              }
            >
              {homeBanner.ctaLabel || 'EXPLORAR COLECCIÓN'} <ArrowRight size={18} />
            </a>
          </div>
          {!current && !homeBanner.image && (
            <div className="hero-art" aria-hidden="true">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <span className="art-index">EST. 2024 / IBAGUÉ</span>
              <img src="/logo.png" alt="" />
              <span className="art-bottom">ACTIVE SPIRIT. EVERYDAY STYLE.</span>
            </div>
          )}
          <div className="hero-bottom">
            <span>01 / TU PRÓXIMA VERSIÓN</span>
            {slides.length > 1 ? (
              <div className="slide-dots">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    aria-label={`Ver promoción ${i + 1}`}
                    aria-pressed={i === slide}
                    onClick={() => setSlide(i)}
                    className={i === slide ? 'active' : ''}
                  />
                ))}
              </div>
            ) : (
              <a href="#coleccion" aria-label="Ver colección">
                <ArrowDown size={18} />
              </a>
            )}
          </div>
        </section>
      )}
      <section className="collection section" id="coleccion">
        <div className="section-heading">
          <div>
            <span className="eyebrow">ELIGE LO QUE VA CONTIGO</span>
            <h2>
              {category ? category.toUpperCase() : 'TU DÍA. TU ESTILO.'}
              {gender && <small> / {gender.toUpperCase()}</small>}
            </h2>
          </div>
          <span className="count">
            {total} {total === 1 ? 'producto' : 'productos'}
          </span>
        </div>
        <div className="collection-toolbar">
          <div className="filter-pills">
            <button className={!category && !gender ? 'active' : ''} onClick={() => setParams({})}>
              Toda la ropa
            </button>
            <button
              className={category === 'camisetas' ? 'active' : ''}
              onClick={() => setParams({ category: 'camisetas', gender: 'hombre' })}
            >
              Camisetas
            </button>
            <button
              className={category === 'pantalones' ? 'active' : ''}
              onClick={() => setParams({ category: 'pantalones', gender: 'hombre' })}
            >
              Pantalones
            </button>
            <button
              className={category === 'buzos' ? 'active' : ''}
              onClick={() => setParams({ category: 'buzos', gender: 'hombre' })}
            >
              Buzos
            </button>
          </div>
        </div>
        <ErrorMessage text={error} />
        {loading ? (
          <Loading />
        ) : clothes.length ? (
          <>
            <div className="product-grid">
              {clothes.map((p) => (
                <ProductCard product={p} key={p._id} />
              ))}
            </div>
            {page < pages && (
              <div className="load-more">
                <button className="button secondary" disabled={moreBusy} onClick={loadMore}>
                  {moreBusy ? 'CARGANDO…' : 'VER MÁS PRODUCTOS'}
                </button>
              </div>
            )}
          </>
        ) : (
          !error && (
            <Empty
              title={
                category || search
                  ? 'Aún no hay prendas en esta selección'
                  : 'La próxima colección empieza aquí'
              }
              text={
                category || search
                  ? 'Prueba otra categoría o vuelve a ver toda la colección.'
                  : 'Las prendas aparecerán aquí cuando nuestro equipo las registre.'
              }
            />
          )
        )}
      </section>
      {!category && !search && (
        <section className="footwear section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">DEL PRIMER PASO AL ÚLTIMO</span>
              <h2>DA EL SIGUIENTE PASO.</h2>
            </div>
            <div className="rail-actions">
              <Link to="/?category=calzado">
                Ver calzado <ArrowRight size={15} />
              </Link>
              <button
                className="circle"
                aria-label="Calzado anterior"
                onClick={() => rail.current?.scrollBy({ left: -380, behavior: 'smooth' })}
              >
                <ChevronLeft />
              </button>
              <button
                className="circle dark"
                aria-label="Calzado siguiente"
                onClick={() => rail.current?.scrollBy({ left: 380, behavior: 'smooth' })}
              >
                <ChevronRight />
              </button>
            </div>
          </div>
          {shoes.length ? (
            <div className="product-rail" ref={rail}>
              {shoes.map((p) => (
                <ProductCard product={p} key={p._id} />
              ))}
            </div>
          ) : (
            <Empty
              title="Un buen movimiento comienza por los pies"
              text="Descubre aquí el calzado disponible en cuanto llegue al catálogo."
            />
          )}
        </section>
      )}
      <section className="brand-strip">
        <span>KOVA ES MOVIMIENTO.</span>
        <p>
          Una empresa familiar. Un espíritu activo.
          <br />
          Conoce la historia que nos mueve.
        </p>
        <Link to="/nosotros" className="text-link">
          SOBRE NOSOTROS <ArrowRight size={20} />
        </Link>
      </section>
    </>
  );
}

export function ProductPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, cart, setCart, notify } = useStore();
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [size, setSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setProduct(null);
    setError('');
    setSize('');
    setQuantity(1);
    let active = true;
    api<Product>(`/products/${id}`)
      .then((p) => {
        if (active) setProduct(p);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    api<Product[]>(`/products/${id}/suggestions`)
      .then((p) => {
        if (active) setRelated(p);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [id]);
  if (!product)
    return <div className="page">{error ? <ErrorMessage text={error} /> : <Loading />}</div>;
  const variant =
    product.variants.find((v) => v.key === params.get('color')) ?? product.variants[0];
  const stock = variant.sizes.find((s) => s.size === size)?.stock ?? 0;
  async function add() {
    if (!user) {
      navigate(`/acceso?next=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    if (!size) {
      setError('Selecciona una talla para continuar.');
      return;
    }
    setBusy(true);
    setError('');
    const existing = cart.find(
      (i) => i.productId === product!._id && i.variantKey === variant.key && i.size === size,
    );
    const items = existing
      ? cart.map((i) => (i === existing ? { ...i, quantity: i.quantity + quantity } : i))
      : [...cart, { productId: product!._id, variantKey: variant.key, size, quantity }];
    try {
      await setCart(items);
      notify('Prenda añadida a tu carrito');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page">
      <Link className="back-link" to="/">
        <ArrowLeft size={16} /> Volver a la colección
      </Link>
      <div className="product-detail">
        <div className="detail-gallery">
          {variant.images.map((image, i) => (
            <img
              src={image}
              key={`${variant.key}-${i}`}
              alt={`${product.name} en ${variant.color}, vista ${i + 1}`}
            />
          ))}
        </div>
        <div className="detail-info">
          <span className="eyebrow">KOVA / {product.category.toUpperCase()}</span>
          <h1>{product.name}</h1>
          <p className="detail-price">{money(product.price)}</p>
          <hr />
          <p>
            Color: <b>{variant.color}</b>
          </p>
          <div className="swatches large">
            {product.variants.map((v) => (
              <button
                key={v.key}
                aria-label={v.color}
                aria-pressed={v.key === variant.key}
                className={`swatch ${v.key === variant.key ? 'selected' : ''}`}
                style={{ '--swatch': v.hex } as React.CSSProperties}
                onClick={() => {
                  setParams({ color: v.key }, { replace: true });
                  setSize('');
                  setQuantity(1);
                }}
              />
            ))}
          </div>
          <div className="label-line">
            <b>Selecciona tu talla</b>
            <span>{size ? `${stock} disponibles` : 'Encuentra tu ajuste'}</span>
          </div>
          <div className="sizes">
            {variant.sizes.map((s) => (
              <button
                key={s.size}
                disabled={!s.stock}
                className={size === s.size ? 'selected' : ''}
                aria-pressed={size === s.size}
                onClick={() => {
                  setSize(s.size);
                  setQuantity(1);
                }}
              >
                {s.size}
              </button>
            ))}
          </div>
          <label className="quantity-label">
            Cantidad
            <input
              type="number"
              min={1}
              max={Math.min(stock || 1, 99)}
              value={quantity}
              onChange={(e) =>
                setQuantity(Math.max(1, Math.min(stock || 1, 99, Number(e.target.value) || 1)))
              }
            />
          </label>
          <ErrorMessage text={error} />
          <button
            className="button full"
            disabled={busy || !variant.sizes.some((s) => s.stock > 0)}
            onClick={add}
          >
            {busy ? 'AÑADIENDO…' : 'AÑADIR AL CARRITO'} <ArrowRight size={18} />
          </button>
          <details className="description" open>
            <summary>DETALLES DE LA PRENDA</summary>
            <p>{product.description}</p>
          </details>
        </div>
      </div>
      {related.length > 0 && (
        <section className="section">
          <div className="section-heading">
            <h2>TAMBIÉN VA CONTIGO.</h2>
          </div>
          <div className="product-rail">
            {related.map((p) => (
              <ProductCard product={p} key={p._id} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function AboutPage() {
  const [custom, setCustom] = useState<About | null>(null);
  useEffect(() => {
    api<Content[]>('/content')
      .then((c) => setCustom((c.find((i) => i.key === 'about')?.value as About) ?? null))
      .catch(() => {});
  }, []);
  const headings = ['Historia', '¿A que nos dedicamos?', 'Mision', 'Vision', 'Valores'];
  const labels: Record<string, string> = {
    Historia: 'Nuestra historia',
    '¿A que nos dedicamos?': 'Lo que hacemos',
    Mision: 'Nuestra misión',
    Vision: 'Nuestra visión',
    Valores: 'Nuestros valores',
  };
  return (
    <>
      <section className="inner-hero">
        <span className="eyebrow">IBAGUÉ, COLOMBIA · DESDE 2024</span>
        <h1>{custom?.title || 'UNA HISTORIA EN MOVIMIENTO.'}</h1>
        <p>Una familia, una pasión y muchas formas de seguir adelante.</p>
      </section>
      <div className="about-body page">
        {custom ? (
          <>
            <p className="preserve">{custom.text}</p>
            {custom.image && (
              <img className="about-image" src={custom.image} alt="Nuestra historia Kova" />
            )}
          </>
        ) : (
          headings.map((heading, i) => {
            const start = brandText.indexOf(heading);
            const end =
              i + 1 < headings.length
                ? brandText.indexOf(headings[i + 1])
                : brandText.indexOf('Contactos');
            return (
              <section className="about-section" key={heading}>
                <span className="eyebrow">0{i + 1}</span>
                <h2>{labels[heading]}</h2>
                <div>
                  {brandText.slice(start + 1, end).map((p, j) => (
                    <p key={j}>{p}</p>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </>
  );
}
export function ContactPage() {
  const [banner, setBanner] = useState<Banner>(defaultContactBanner);
  useEffect(() => {
    api<Content[]>('/content')
      .then((c) =>
        setBanner(
          (c.find((i) => i.key === 'contactBanner')?.value as Banner) ?? defaultContactBanner,
        ),
      )
      .catch(() => {});
  }, []);
  return (
    <>
      <section
        className={`inner-hero ${banner.image ? 'image-banner' : ''}`}
        style={
          banner.image
            ? {
                backgroundImage: `linear-gradient(90deg,#000a,#0003),url(${JSON.stringify(banner.image)})`,
              }
            : undefined
        }
      >
        <span className="eyebrow">CERCA DE TI</span>
        <h1 className="preserve">{banner.title}</h1>
        <p className="preserve">{banner.subtitle}</p>
        {banner.ctaLabel && banner.href && (
          <Link className="button light" to={banner.href}>
            {banner.ctaLabel}
            <ArrowRight size={16} />
          </Link>
        )}
      </section>
      <div className="contact-grid page">
        <div>
          <BrandIcon name="location" />
          <h2>VISÍTANOS</h2>
          <p>
            Manzana M, casa 22
            <br />
            Las Vegas del Yuldaima
            <br />
            Ibagué, Tolima, Colombia
          </p>
        </div>
        <div>
          <BrandIcon name="whatsapp" />
          <h2>HABLEMOS</h2>
          <a href="https://wa.me/573003115677" target="_blank" rel="noreferrer">
            WhatsApp · 300 311 5677
          </a>
          <a href="tel:+573003115677">Llamar a la tienda</a>
        </div>
        <div>
          <BrandIcon name="support" />
          <h2>ATENCIÓN</h2>
          <p>
            8:00 a. m. – 9:00 p. m.
            <br />
            Atención cercana, de persona a persona.
          </p>
        </div>
        <div>
          <BrandIcon name="instagram" />
          <h2>SÍGUENOS</h2>
          <a href="https://www.instagram.com/pollo_store25/" target="_blank" rel="noreferrer">
            @pollo_store25 <ArrowRight size={15} />
          </a>
        </div>
      </div>
    </>
  );
}
