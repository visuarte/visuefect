# ESLint Issues (auto-generated)

Resumen del escaneo actual:
- Total: **160** problemas (12 errores, 148 advertencias)
- Problemas potencialmente arreglables con `eslint --fix`: **12**

## Errores (prioridad alta)
- `object-curly-newline` en tests (`test/pointercoordinator.test.js`, `test/syncbridge.extra.test.js`, etc.) — arreglables con `--fix` (formato de import/objetos multi-linea)
- `keyword-spacing` en `src/core/Engine.js` (espaciado alrededor de `catch`)

## Advertencias frecuentes
- `no-empty` (múltiples lugares en `src/core/Engine.js`, componentes y tests)
- `no-console` (varios usos en `src/ui/*`, `src/utils/chunksManager.js`)
- `no-unused-vars` (componentes y tests)
- `no-param-reassign` (varios `Assignment to property of function param` en `src/ui/*` y `src/components/*`)
- `consistent-return` (métodos async y arrow functions sin return consistente)
- `no-shadow` (varias sombras de variables locales)

## Sugerencia de workflow (por tarea)
1. Ejecutar `npm run lint -- --fix` para aplicar correcciones automáticas y reducir errores de formato.
2. Abrir PR `eslint/fix-formatting` con los cambios resultantes.
3. Crear PRs específicos por regla (`eslint/fix-no-unused-vars`, `eslint/fix-no-empty`, etc.) con fixes localizados y comentarios claros.
4. Re-evaluar reglas y pasar de `warn` a `error` cuando el área esté limpia.

## Tareas iniciales propuestas (puedes asignarme para crear PRs):
- [ ] `format-fix` — run `eslint --fix`, review, open PR
- [ ] `no-console` — reemplazar o encapsular en `logger.*`, abrir PR con cambios en `src/ui` y `src/utils`
- [ ] `no-empty` — revisar bloques vacíos y eliminar/añadir comments o comportamiento esperado
- [ ] `no-unused-vars` — limpiar variables y parámetros no usados
- [ ] `no-param-reassign` — refactorizar sitios críticos que reassignan parámetros

---

¿Quieres que ejecute `eslint --fix` ahora y abra el PR inicial `eslint/fix-formatting` con los cambios automáticos? Si sí, confirmar y lo hago.