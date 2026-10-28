import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Header, Footer } from './components';
import { Home, ProductPage, AboutPage, ContactPage } from './pages/Shop';
import { Access, Account, CartPage, Checkout } from './pages/Account';
import { Admin } from './pages/Admin';
import { useStore } from './store';
export function App() {
  const { notice } = useStore();
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    if (location.pathname === '/') window.scrollTo(0, 0);
  }, [location.search, location.pathname]);
  return (
    <>
      <a className="skip-link" href="#main">
        Saltar al contenido
      </a>
      <Header />
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/prenda/:id" element={<ProductPage />} />
          <Route path="/nosotros" element={<AboutPage />} />
          <Route path="/contacto" element={<ContactPage />} />
          <Route path="/acceso" element={<Access />} />
          <Route path="/cuenta" element={<Account />} />
          <Route path="/carrito" element={<CartPage />} />
          <Route path="/pago" element={<Checkout />} />
          <Route path="/personal" element={<Admin />} />
          <Route
            path="*"
            element={
              <div className="page">
                <h1>Página no encontrada</h1>
                <a href="/">Volver a la tienda</a>
              </div>
            }
          />
        </Routes>
      </main>
      <Footer />
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </>
  );
}
