import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  CreditCard,
  Landmark,
  Wallet,
  Trash2,
  LogOut,
  Package,
  ShoppingBag,
  RotateCcw,
} from 'lucide-react';
import { api, send } from '../api';
import { useStore } from '../store';
import { Empty, ErrorMessage, Loading } from '../components';
import { money, type Order, type Product } from '../types';
import { BrandIcon } from '../BrandIcon';

export function Access() {
  const { user, login, ready } = useStore();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [register, setRegister] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const next = params.get('next');
  const requestedTarget =
    next?.startsWith('/') && !next.startsWith('//') && !next.includes('\\') ? next : null;
  const target = requestedTarget ?? (user && user.role !== 'customer' ? '/personal' : '/cuenta');
  if (!ready) return <Loading />;
  if (user) return <Navigate to={target} replace />;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    const email = String(data.get('email'));
    const password = String(data.get('password'));
    try {
      if (register)
        await api('/auth/register', send('POST', { name: data.get('name'), email, password }));
      const signedIn = await login(email, password);
      navigate(requestedTarget ?? (signedIn.role === 'customer' ? '/cuenta' : '/personal'), {
        replace: true,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="access-page">
      <div className="access-art">
        <img src="/logo.png" alt="KOVA" />
        <span>
          EL MOVIMIENTO
          <br />
          EMPIEZA CONTIGO.
        </span>
        <small>ROPA & CALZADO · IBAGUÉ, COLOMBIA</small>
      </div>
      <div className="access-form">
        <span className="eyebrow">TU ESPACIO KOVA</span>
        <h1>{register ? 'HAZLO TUYO.' : 'HOLA DE NUEVO.'}</h1>
        <p>
          {register
            ? 'Crea tu cuenta y encuentra tu próximo favorito.'
            : 'Tu carrito, tus compras y todo lo que viene.'}
        </p>
        <form onSubmit={submit}>
          {register && (
            <label>
              Nombre
              <input name="name" autoComplete="name" required minLength={2} maxLength={100} />
            </label>
          )}
          <label>
            {register ? 'Correo electrónico' : 'Correo o nombre de usuario'}
            <input
              type={register ? 'email' : 'text'}
              name="email"
              autoComplete="username"
              required
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              name="password"
              autoComplete={register ? 'new-password' : 'current-password'}
              required
              minLength={register ? 12 : 1}
              maxLength={72}
            />
            {register && <small>Mínimo 12 caracteres.</small>}
          </label>
          <ErrorMessage text={error} />
          <button className="button full" disabled={busy}>
            {busy ? 'UN MOMENTO…' : register ? 'CREAR MI CUENTA' : 'INICIAR SESIÓN'}
            <ArrowRight size={17} />
          </button>
        </form>
        <div className="or">
          <span />O<span />
        </div>
        <button className="google full" type="button" disabled>
          <b>G</b> Continuar con Google <small>No disponible</small>
        </button>
        <p className="switch-auth">
          {register ? '¿Ya tienes cuenta?' : '¿Primera vez en Kova?'}{' '}
          <button
            onClick={() => {
              setRegister(!register);
              setError('');
            }}
          >
            {register ? 'Inicia sesión' : 'Regístrate'}
          </button>
        </p>
      </div>
    </div>
  );
}

export function Account() {
  const { user, ready, logout, cart, notify } = useStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('orders');
  const [returnId, setReturnId] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (user)
      api<Order[]>('/shop/orders')
        .then(setOrders)
        .catch((e) => setError(e.message));
  }, [user]);
  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/acceso" replace />;
  async function requestReturn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const updated = await api<Order>(
        `/shop/orders/${returnId}/return`,
        send('POST', { reason: new FormData(e.currentTarget).get('reason') }),
      );
      setOrders((list) => list.map((o) => (o._id === updated._id ? updated : o)));
      setReturnId('');
      notify('Solicitud de devolución registrada');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const shown = tab === 'returns' ? orders.filter((o) => o.status !== 'paid') : orders;
  return (
    <div className="page account-page">
      <div className="section-heading">
        <div>
          <span className="eyebrow">MI CUENTA</span>
          <h1>HOLA, {user.name.toUpperCase()}.</h1>
          <p>{user.email}</p>
        </div>
        <button className="text-link" onClick={logout}>
          Cerrar sesión <LogOut size={16} />
        </button>
      </div>
      {user.role !== 'customer' && (
        <Link className="button" to="/personal">
          ABRIR PANEL DEL PERSONAL <ArrowRight size={17} />
        </Link>
      )}
      <div className="account-tabs">
        <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>
          <Package size={17} />
          Mis compras
        </button>
        <button className={tab === 'returns' ? 'active' : ''} onClick={() => setTab('returns')}>
          <RotateCcw size={17} />
          Devoluciones
        </button>
        <Link to="/carrito">
          <ShoppingBag size={17} />
          Carrito activo ({cart.length})
        </Link>
      </div>
      <ErrorMessage text={error} />
      {!shown.length ? (
        <Empty
          title={
            tab === 'returns' ? 'No tienes devoluciones' : 'Tu próxima historia está por empezar'
          }
          text={
            tab === 'returns'
              ? 'Aquí aparecerán tus solicitudes y devoluciones.'
              : 'Cuando completes una compra podrás verla aquí.'
          }
        />
      ) : (
        shown.map((order) => (
          <article className="order" key={order._id}>
            <div className="order-heading">
              <div>
                <b>Pedido #{order._id.slice(-8).toUpperCase()}</b>
                <p>{new Date(order.createdAt).toLocaleDateString('es-CO')}</p>
              </div>
              <span className="badge">
                {order.status === 'paid'
                  ? 'Pago exitoso · simulado'
                  : order.status === 'returned'
                    ? 'Devuelto'
                    : 'Devolución solicitada'}
              </span>
              <b>{money(order.total)}</b>
            </div>
            {order.items.map((item, i) => (
              <div className="order-item" key={i}>
                <img src={item.image} alt={item.name} />
                <div>
                  <b>{item.name}</b>
                  <p>
                    {item.color} · Talla {item.size} · {item.quantity} unidad(es)
                  </p>
                </div>
                <span>{money(item.unitPrice * item.quantity)}</span>
              </div>
            ))}
            {order.status === 'paid' && (
              <button
                className="text-link"
                onClick={() => setReturnId(returnId === order._id ? '' : order._id)}
              >
                Solicitar devolución <RotateCcw size={14} />
              </button>
            )}
            {returnId === order._id && (
              <form onSubmit={requestReturn}>
                <label>
                  Motivo de la devolución
                  <textarea name="reason" minLength={3} maxLength={1000} required />
                </label>
                <button className="button" disabled={busy}>
                  ENVIAR SOLICITUD
                </button>
              </form>
            )}
          </article>
        ))
      )}
    </div>
  );
}

function useCartProducts() {
  const { cart } = useStore();
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string[]>([]);
  const ids = [...new Set(cart.map((i) => i.productId))].sort().join(',');
  useEffect(() => {
    let active = true;
    setLoading(true);
    const keys = ids ? ids.split(',') : [];
    Promise.allSettled(keys.map((id) => api<Product>(`/products/${id}`))).then((results) => {
      if (!active) return;
      const map: Record<string, Product> = {};
      const failures: string[] = [];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') map[keys[i]] = r.value;
        else failures.push(keys[i]);
      });
      setProducts(map);
      setFailed(failures);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [ids]);
  return { products, loading, failed };
}
export function CartPage() {
  const { user, ready, cart, setCart } = useStore();
  const { products, loading, failed } = useCartProducts();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/acceso?next=/carrito" replace />;
  const total = cart.reduce((sum, i) => sum + (products[i.productId]?.price ?? 0) * i.quantity, 0);
  async function change(index: number, quantity: number) {
    setBusy(true);
    setError('');
    try {
      await setCart(
        quantity === 0
          ? cart.filter((_, i) => i !== index)
          : cart.map((item, i) => (i === index ? { ...item, quantity } : item)),
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page">
      <span className="eyebrow">TUS PRÓXIMOS FAVORITOS</span>
      <h1>MI CARRITO.</h1>
      <ErrorMessage text={error} />
      {loading ? (
        <Loading />
      ) : !cart.length ? (
        <>
          <Empty
            title="Hay espacio para tu próximo favorito"
            text="Explora la colección y agrega las prendas que van contigo."
          />
          <Link className="button" to="/">
            EXPLORAR COLECCIÓN <ArrowRight size={17} />
          </Link>
        </>
      ) : (
        <div className="cart-layout">
          <div>
            {cart.map((item, i) => {
              const product = products[item.productId];
              const variant = product?.variants.find((v) => v.key === item.variantKey);
              const stock = variant?.sizes.find((s) => s.size === item.size)?.stock ?? 0;
              return (
                <article
                  className="cart-item"
                  key={`${item.productId}-${item.variantKey}-${item.size}`}
                >
                  {variant && <img src={variant.images[0]} alt={product?.name} />}
                  <div>
                    <Link to={`/prenda/${item.productId}`}>
                      {product?.name ?? 'Producto no disponible'}
                    </Link>
                    <p>
                      {variant?.color ?? item.variantKey} · Talla {item.size}
                    </p>
                    <label>
                      Cantidad
                      <select
                        value={item.quantity}
                        disabled={busy || !stock}
                        onChange={(e) => change(i, Number(e.target.value))}
                      >
                        {Array.from(
                          { length: Math.max(item.quantity, Math.min(stock, 99)) },
                          (_, n) => (
                            <option key={n + 1}>{n + 1}</option>
                          ),
                        )}
                      </select>
                    </label>
                    {stock < item.quantity && <p className="error">Disponibilidad insuficiente.</p>}
                  </div>
                  <div>
                    <b>{product ? money(product.price * item.quantity) : '—'}</b>
                    <button
                      className="icon"
                      aria-label={`Eliminar ${product?.name ?? 'producto'}`}
                      disabled={busy}
                      onClick={() => change(i, 0)}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          <aside className="summary-box">
            <h2>RESUMEN</h2>
            <div>
              <span>Productos</span>
              <b>{money(total)}</b>
            </div>
            <p>Compra de prueba con pago simulado.</p>
            <div className="summary-total">
              <b>Total</b>
              <b>{money(total)}</b>
            </div>
            {failed.length > 0 ? (
              <ErrorMessage text="Retira los productos no disponibles antes de continuar." />
            ) : (
              <Link className="button full" to="/pago">
                CONTINUAR AL PAGO <ArrowRight size={16} />
              </Link>
            )}
            <Link className="text-link" to="/">
              Seguir explorando
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
export function Checkout() {
  const { user, ready, cart, refreshCart } = useStore();
  const { products, loading, failed } = useCartProducts();
  const [method, setMethod] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<Order | null>(null);
  const checkoutKey = useRef(crypto.randomUUID());
  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/acceso?next=/pago" replace />;
  if (success)
    return (
      <div className="success page">
        <div className="success-check">
          <Check size={44} />
        </div>
        <span className="eyebrow">UN NUEVO MOVIMIENTO</span>
        <h1>¡YA ES TUYO!</h1>
        <p>
          Tu pago simulado fue exitoso.
          <br />
          El pedido #{success._id.slice(-8).toUpperCase()} quedó registrado en tu cuenta.
        </p>
        <b>{money(success.total)}</b>
        <Link className="button" to="/cuenta">
          VER MIS COMPRAS <ArrowRight size={17} />
        </Link>
      </div>
    );
  if (!cart.length) return <Navigate to="/carrito" replace />;
  async function pay(e: FormEvent) {
    e.preventDefault();
    if (!method) {
      setError('Selecciona un método de pago.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const order = await api<Order>(
        '/shop/checkout',
        send('POST', { paymentMethod: method, checkoutKey: checkoutKey.current }),
      );
      setSuccess(order);
      await refreshCart();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const total = cart.reduce((s, i) => s + (products[i.productId]?.price ?? 0) * i.quantity, 0);
  return (
    <div className="page checkout-page">
      <span className="eyebrow">EL ÚLTIMO PASO</span>
      <h1>HAZLO TUYO.</h1>
      <div className="cart-layout">
        <form onSubmit={pay}>
          <h2>MÉTODO DE PAGO</h2>
          <p>Esta compra es una simulación. No se realizarán cobros.</p>
          <div className="payment-options">
            {[
              { key: 'card', title: 'Tarjeta', Icon: CreditCard, text: 'Crédito o débito' },
              { key: 'pse', title: 'PSE', Icon: Landmark, text: 'Transferencia bancaria' },
              { key: 'cash', title: 'Efectivo', Icon: Wallet, text: 'Pago en efectivo' },
            ].map(({ key, title, Icon, text }) => (
              <label key={key} className={method === key ? 'payment selected' : 'payment'}>
                <input
                  type="radio"
                  name="method"
                  value={key}
                  checked={method === key}
                  onChange={() => setMethod(key)}
                />
                <BrandIcon name="payment" />
                <span>
                  <b>{title}</b>
                  <small>{text}</small>
                </span>
                <span className="payment-radio" />
              </label>
            ))}
          </div>
          {method === 'card' && (
            <div className="mock-card" aria-hidden="true">
              <span>KOVA / DEMO</span>
              <CreditCard />
              <strong>•••• &nbsp; •••• &nbsp; •••• &nbsp; 2024</strong>
              <small>{user.name.toUpperCase()}</small>
            </div>
          )}
          <ErrorMessage text={error} />
          <button className="button full" disabled={busy || loading || failed.length > 0}>
            {busy ? 'PROCESANDO…' : 'CONFIRMAR PAGO SIMULADO'} <ArrowRight size={17} />
          </button>
        </form>
        <aside className="summary-box">
          <h2>TU PEDIDO</h2>
          {loading ? (
            <Loading />
          ) : (
            cart.map((item, i) => (
              <div key={i}>
                <span>
                  {products[item.productId]?.name ?? 'No disponible'} × {item.quantity}
                </span>
                <b>{money((products[item.productId]?.price ?? 0) * item.quantity)}</b>
              </div>
            ))
          )}
          <div className="summary-total">
            <b>Total</b>
            <b>{money(total)}</b>
          </div>
          <p>
            {user.name}
            <br />
            {user.email}
          </p>
          <Link to="/carrito">Volver al carrito</Link>
        </aside>
      </div>
    </div>
  );
}
