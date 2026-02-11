# ESLint Roadmap — Gradual Tightening Plan

Objetivo: aplicar reglas de ESLint de forma incremental para mejorar calidad sin romper flujo de trabajo.

## Fase 1 — Visibilidad (Completado: configuración)
- [x] Cambiar reglas seleccionadas de `off` a `warn` para obtener señal sin fallos en CI
  - `no-console` -> `warn`
  - `no-unused-vars` -> `warn` (args: after-used)
  - `consistent-return` -> `warn`
  - `no-param-reassign` -> `warn`
  - `no-empty` -> `warn`
  - `no-shadow` -> `warn`

## Fase 2 — Corrección por regla (automatizable)
- Por cada regla marcada `warn`:
  - Ejecutar `npm run lint` y generar listado de archivos/errores
  - Crear PRs pequeños (by-rule) con fixes automáticos (`--fix`) + manual fixes cuando sea necesario
  - Marcar la regla como `error` o mantener `warn` si no es viable aún

Reglas e issues iniciales propuestos:
- `no-unused-vars`: limpiar variables no usadas y parámetros (issue: `eslint/no-unused-vars`)
- `no-console`: reemplazar por `logger.*` cuando aplique o convertir a `logger.debug` (issue: `eslint/no-console`)
- `no-param-reassign`: evitar reassigns o usar patrones seguros (issue: `eslint/no-param-reassign`)
- `consistent-return`: detectar funciones inconsistentes y corregir (issue: `eslint/consistent-return`)
- `no-shadow`: resolver sombras de variables (issue: `eslint/no-shadow`)

## Fase 3 — Harden
- Una vez que las reglas críticas estén en `error` y la base esté limpia, reducir reglas relaxadas adicionales (ej.: `no-plusplus`, `max-len`) y aplicar formato con `prettier` y `eslint --fix`.

## Tareas operativas
- [ ] Añadir check de lint en la pipeline CI (workflow que corra `npm run lint && npm run test:run`)
- [ ] Añadir Issue templates para PRs de "eslint fix: <rule>"
- [ ] Crear PR inicial: "eslint: phase-1 warnings" con solo cambios de config
- [ ] Crear script `scripts/eslint-report.js` que genera reporte por regla (opcional)

---

Si confirmas, puedo: 1) ejecutar `npm run lint` ahora para generar el primer reporte y crear issues automáticamente, o 2) comenzar a aplicar fixes automáticos para la regla `no-unused-vars` y abrir el PR correspondiente.
