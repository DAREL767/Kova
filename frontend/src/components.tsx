import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ArrowRight, Menu, Search, ShoppingBag, UserRound, X, ChevronDown } from 'lucide-react';
import { useStore } from './store';
import { categories, money, type Product } from './types';
import { BrandIcon, type BrandIconName } from './BrandIcon';

export function Header() {
  const { user, cart } = useStore();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const close = () => setOpen(false);
  return (
    <>
      <div className="topline">
        DESDE IBAGUÉ, PARA TU PRÓXIMO MOVIMIENTO <span>ROPA & CALZADO DEPORTIVO</span>
      </div>
      <header className="header">
        <button
          className="icon mobile-menu"
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
        <Link className="brand" to="/" onClick={close} aria-label="Kova — Inicio">
          <img src="/logo.png" alt="KOVA" />
        </Link>
        <nav className={open ? 'navigation open' : 'navigation'} aria-label="Navegación principal">
          <NavLink to="/" onClick={close}>
            INICIO
          </NavLink>
          <details key={location.key}>
            <summary>
              ROPA <ChevronDown size={13} />
            </summary>
            <div className="dropdown">
              <small>COLECCIÓN HOMBRE</small>
              {categories
                .filter((c) => c !== 'calzado' && c !== 'camisas')
                .map((c) => (
                  <Link key={c} to={`/?category=${c}&gender=hombre`} onClick={close}>
                    <BrandIcon
                      name={
                        (
                          {
                            guayos: 'calzado',
                            camisetas: 'camisetas',
                            buzos: 'buzos',
                            pantalonetas: 'pantalonetas',
                            bermudas: 'pantalonetas',
                            sacos: 'buzos',
                            pantalones: 'pantalonetas',
                          } as Record<string, BrandIconName>
                        )[c]
                      }
                    />
                    {c.toUpperCase()}
                  </Link>
                ))}
            </div>
          </details>
          <details key={`shoes-${location.key}`}>
            <summary>
              CALZADO <ChevronDown size={13} />
            </summary>
            <div className="dropdown">
              <Link to="/?category=calzado&gender=hombre" onClick={close}>
                <BrandIcon name="hombre" />
                HOMBRE
              </Link>
              <Link to="/?category=calzado&gender=mujer" onClick={close}>
                <BrandIcon name="mujer" />
                MUJER
              </Link>
              <Link to="/?category=guayos" onClick={close}>
                <BrandIcon name="calzado" />
                GUAYOS
              </Link>
            </div>
          </details>
          <NavLink to="/nosotros" onClick={close}>
            NOSOTROS
          </NavLink>
          <NavLink to="/contacto" onClick={close}>
            CONTACTO
          </NavLink>
        </nav>
        <div className="header-actions">
          <Link className="icon" to="/?search=1" aria-label="Buscar prendas">
            <Search />
          </Link>
          <Link className="icon" to={user ? '/cuenta' : '/acceso'} aria-label="Mi cuenta">
            <UserRound />
          </Link>
          <Link
            className="icon bag"
            to="/carrito"
            aria-label={`Carrito, ${cart.reduce((s, i) => s + i.quantity, 0)} artículos`}
          >
            <ShoppingBag />
            {cart.length > 0 && <span>{cart.reduce((s, i) => s + i.quantity, 0)}</span>}
          </Link>
        </div>
      </header>
    </>
  );
}
export function Footer() {
  return (
    <footer>
      <div className="footer-top">
        <div>
          <Link className="brand" to="/">
            <img src="/logo.png" alt="KOVA" />
          </Link>
          <p>
            Comodidad, carácter y movimiento.
            <br />
            De Ibagué a donde quieras llegar.
          </p>
        </div>
        <div>
          <h3>EXPLORA</h3>
          <Link to="/">Toda la colección</Link>
          <Link to="/?category=calzado">Calzado</Link>
          <Link to="/nosotros">Nuestra historia</Link>
        </div>
        <div>
          <h3>ESTAMOS CERCA</h3>
          <Link to="/contacto">Encuéntranos</Link>
          <a href="tel:+573003115677">300 311 5677</a>
          <a href="https://www.instagram.com/pollo_store25/" target="_blank" rel="noreferrer">
            Instagram <ArrowRight size={13} />
          </a>
        </div>
        <div>
          <h3>TU KOVA</h3>
          <Link to="/cuenta">Mi cuenta</Link>
          <Link to="/carrito">Mi carrito</Link>
          <Link to="/acceso">Acceso del personal</Link>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} KOVA · Ibagué, Colombia</span>
        <span>HECHO PARA MOVERTE.</span>
      </div>
    </footer>
  );
}
export function ProductCard({ product }: { product: Product }) {
  const [selected, setSelected] = useState(0);
  const variant = product.variants[selected] ?? product.variants[0];
  const available = variant?.sizes.some((s) => s.stock > 0);
  if (!variant) return null;
  return (
    <article className="product-card">
      <Link className="product-image" to={`/prenda/${product._id}?color=${variant.key}`}>
        <img src={variant.images[0]} alt={`${product.name}, ${variant.color}`} loading="lazy" />
        <img className="second-image" src={variant.images[1]} alt="" loading="lazy" />
        <span className="product-tag">{available ? 'KOVA COLLECTION' : 'AGOTADO'}</span>
        <span className="product-arrow">
          <ArrowRight size={18} />
        </span>
      </Link>
      <div className="product-info">
        <div className="product-line">
          <Link to={`/prenda/${product._id}?color=${variant.key}`}>{product.name}</Link>
          <b>{money(product.price)}</b>
        </div>
        <p>
          {product.category} · {variant.color}
        </p>
        <div className="swatches" aria-label="Colores disponibles">
          {product.variants.map((v, i) => (
            <button
              key={v.key}
              type="button"
              className={selected === i ? 'swatch selected' : 'swatch'}
              style={{ '--swatch': v.hex } as React.CSSProperties}
              aria-label={`Color ${v.color}`}
              aria-pressed={selected === i}
              title={v.color}
              onClick={() => setSelected(i)}
            />
          ))}
        </div>
      </div>
    </article>
  );
}
export function ErrorMessage({ text }: { text: string }) {
  return text ? (
    <p className="error" role="alert">
      {text}
    </p>
  ) : null;
}
export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <ShoppingBag size={34} strokeWidth={1} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <span />
      Cargando KOVA…
    </div>
  );
}
