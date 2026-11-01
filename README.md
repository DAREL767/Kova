# Kova

Tienda de demostración con frontend y backend independientes. Los pagos son simulados; cuentas, imágenes, carritos, pedidos e inventario se guardan en MongoDB.

## Estructura

- `backend/src/`: API Express organizada en módulos de autenticación, catálogo, contenido, imágenes y compras.
- `backend/test/`: pruebas de integración con una base temporal.
- `backend/package.json`, `backend/package-lock.json`, `backend/tsconfig.json`: dependencias, comandos y compilación de la API.
- `frontend/src/`: interfaz React/Vite.
- `frontend/package.json`, `frontend/package-lock.json`: dependencias y comandos de la interfaz.
- `package.json` de la raíz: atajos opcionales; ningún servicio necesita el otro para compilar o arrancar.

## Desarrollo local

Requiere Node.js 22 o superior. MongoDB debe soportar transacciones (Atlas o replica set local) para compras y aceptación de devoluciones.

1. Ejecutar `npm ci --prefix backend` y `npm ci --prefix frontend`.
2. Copiar `backend/.env.example` a `backend/.env` y configurar MongoDB y un secreto JWT aleatorio.
3. Copiar `frontend/.env.example` a `frontend/.env`. Con `VITE_API_URL` vacío, Vite conecta `/api` al backend mediante `DEV_API_TARGET`.
4. Ejecutar `npm run seed:admin` una sola vez, con `ADMIN_NAME`, `ADMIN_EMAIL` y `ADMIN_PASSWORD` configurados en el backend.
5. En terminales separadas: `npm run dev:backend` y `npm run dev:frontend`.
6. Abrir la dirección indicada por Vite. `CLIENT_ORIGIN` debe coincidir exactamente con ella, incluidos puerto y localhost frente a 127.0.0.1.

La configuración privada local que antes estaba en la raíz se trasladó a `backend/.env`. No se debe publicar.

## Configuración independiente

### Backend

Desde `backend/`: `npm ci`, `npm run build`, `npm start`.

El compilador TypeScript y las declaraciones de tipos necesarias para compilar están en `dependencies`: el backend también se puede compilar después de `npm ci --omit=dev`, incluido cuando el alojamiento establece `NODE_ENV=production` antes de instalar. El tipado estricto se mantiene activado.

Variables:

- `MONGODB_URI`: conexión a MongoDB con transacciones.
- `JWT_SECRET`: secreto aleatorio de al menos 32 caracteres.
- `CLIENT_ORIGIN`: origen exacto del frontend, por ejemplo `https://tienda.example.com`, sin barra final.
- Para el despliegue actual: `CLIENT_ORIGIN=https://kova-ten-omega.vercel.app`. El servidor normaliza la barra final y permite este dominio explícitamente, tanto en CORS como en la validación de escrituras.
- `NODE_ENV=production`: activa cookies Secure.
- `PORT`: puerto del servicio.
- `TRUST_PROXY_HOPS`: número de proxies de confianza, según la infraestructura; por defecto `0`.
- `COOKIE_SAME_SITE`: `none` por defecto en producción y `strict` en desarrollo. Una variable explícita prevalece sobre estos valores. Para frontend y API en sitios distintos, usar `none`, que requiere HTTPS y configura Secure. Los navegadores que bloqueen cookies de terceros pueden impedir esa sesión; usar subdominios del mismo sitio evita depender de cookies de terceros, manteniendo ambos servicios independientes.

El backend solo sirve la API y `/health`. Las imágenes subidas se guardan en MongoDB GridFS y se sirven por `/api/media/:id`.

### Frontend

Desde `frontend/`: `npm ci`, `npm run build`. La salida está en `frontend/dist/`.

Configurar `VITE_API_URL` antes de compilar con el origen del backend, por ejemplo `https://api.example.com`, sin `/api`. Esta variable es pública y no debe contener secretos. Las solicitudes y las imágenes del catálogo usarán ese origen. Cambiarla requiere recompilar.

El alojamiento del frontend debe devolver `index.html` para las rutas de React, como `/cuenta`, `/personal` y `/prenda/:id`. El frontend no depende de archivos ni de variables privadas del backend.

## Cuentas y catálogo

- El registro público siempre crea clientes. No existe un selector de roles.
- El administrador crea y desactiva hasta dos cuentas activas de personal.
- Administrador y personal ingresan por defecto al panel interno. Solo el administrador gestiona cuentas de personal.
- Las tres cuentas internas tienen los mismos permisos para crear, editar y retirar prendas, subir imágenes y modificar banners, carrusel y contenido. La desactivación de cuentas de personal está reservada al administrador y revoca sus sesiones.
- El administrador puede usar un nombre de usuario interno sin correo. El registro público conserva el correo obligatorio y el mínimo de 12 caracteres para las contraseñas; las credenciales internas no se guardan en el repositorio.
- Cada variante/color exige de 2 a 12 referencias de imágenes diferentes. La primera es la portada y la segunda aparece al pasar el cursor.
- La ropa se presenta en cuadrícula; el carrusel de calzado se alimenta de las categorías de calzado. Las recomendaciones excluyen el producto abierto, priorizan su categoría y completan con otros productos activos.
- El carrusel promocional del encabezado se administra por separado.
- Las compras son simuladas, descuentan inventario y quedan en el perfil. Las solicitudes de devolución aparecen en la cuenta; el flujo existente permite al personal aceptarlas y reponer inventario.

## Verificación

Desde la raíz: `npm run check`, `npm test`, `npm run build:all`.

También se pueden ejecutar `npm run check`, `npm test` y `npm run build` dentro de `backend/`, y `npm run check` y `npm run build` dentro de `frontend/`.

Las pruebas de backend ejecutan MongoDB temporal y requieren conexiones locales. Nunca utilizan la base configurada en `.env`.

Prueba manual: crear las dos cuentas de personal; registrar ropa y calzado con dos fotos por color; verificar rechazo de un color con una foto; cambiar banners; registrarse como cliente; probar carrito, compra y devolución; comprobar aislamiento con un segundo cliente y recargar rutas directamente.
