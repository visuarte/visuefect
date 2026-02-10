Setup de entorno (recomendado) 

1. Instala nvm (https://github.com/nvm-sh/nvm) o usa nodenv.
2. En la raíz del proyecto ejecuta:

   nvm install
   nvm use
   npm ci

3. Variables de entorno:

   - Crea un archivo `.env` copiando `.env.example` y añade valores locales. ` .env` está en `.gitignore`.

4. Para desarrollo:

   npm run dev

5. Para generar build:

   npm run build

Notas de seguridad:

- Ejecutamos `npm audit` en CI y recomendamos revisar cualquier vulnerabilidad de dependencias.
- Si actualizas dependencias mayor (three/pixi/mojs) revisa breaking changes y ejecuta pruebas locales.
