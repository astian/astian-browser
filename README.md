# Astian Browser

Navegador web multiplataforma hecho con Electron, React y TypeScript.

## Direccion de producto

- Inspiracion visual y de experiencia: Flow, Arc y Zen.
- Implementacion propia: no se usa Flow Browser como base directa de codigo.
- UX principal en MVP: pestañas horizontales personalizables desde onboarding y preferencias.

## Stack

- Electron + TypeScript
- React + Tailwind
- Zustand para estado UI
- Drizzle ORM + SQLite
- Vitest para pruebas

## Desarrollo

```bash
bun install
bun run dev
```

Si aparece el error `Electron uninstall`, ejecuta:

```bash
bun run repair:electron
bun run dev
```

Nota: el `postinstall` ya intenta corregir esto automaticamente al instalar dependencias.

## Scripts clave

```bash
bun run lint
bun run typecheck
bun run test
bun run build
bun run db:generate
bun run repair:electron
```

## Estructura

- `src/main`: proceso principal y control de tabs via WebContentsView
- `src/preload`: bridge IPC seguro
- `src/shared`: contratos IPC tipados
- `src/renderer`: shell UI, onboarding y preferencias

## Licencia

GPL-3.0-only.
