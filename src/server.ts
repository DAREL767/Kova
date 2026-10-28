import mongoose from 'mongoose';
import { config } from './config.js';
import { app } from './app.js';
try {
  await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
} catch (error) {
  console.error(
    'No se pudo conectar con MongoDB. Revisa el acceso de red y la configuración del clúster Atlas.',
  );
  console.error(error instanceof Error ? error.name : 'Error de conexión');
  process.exit(1);
}
const server = app.listen(config.PORT, () => console.log(`Kova API: ${config.PORT}`));
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  });
