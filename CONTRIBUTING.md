# Contribuyendo a Astian Browser

Gracias por tu interés en contribuir a Astian Browser. Este documento explica el proceso de desarrollo, testing y release.

## 📋 Requisitos previos

- Node.js 22+
- Bun (recomendado) o npm/pnpm
- Git

## 🚀 Configuración de desarrollo

```bash
# Clonar el repositorio
git clone https://github.com/astian/astian-browser.git
cd astian-browser

# Instalar dependencias
bun install

# Iniciar servidor de desarrollo
bun run dev

# Ejecutar tests
bun run test

# Lint y format
bun run lint
bun run format

# Type checking
bun run typecheck
```

## 📦 Build

```bash
# Build para desarrollador
bun run build

# Build nativo para cada OS
bun run build:win    # Windows
bun run build:mac    # macOS
bun run build:linux  # Linux
```

## 🔐 Secrets de Release

Para configurar el CI/CD y publishar releases, necesitas establecer los siguientes secrets en GitHub (Settings > Secrets and variables > Actions):

### Tokens requeridos

- **`GITHUB_TOKEN`** — Token de acceso para subir artifacts. Se genera automáticamente por GitHub Actions, no necesita configuración manual.

### Windows Signing (Opcional en v0.1.0)

Para firmar instaladores de Windows, establece:

- **`CSC_LINK`** — URL o path codificado en base64 del certificado `.pfx`.
- **`CSC_KEY_PASSWORD`** — Contraseña del certificado.

**Alternativa:** Usar Azure Trusted Signing o dejar sin firmar en v0.1.0 (marked as "unsigned").

```bash
# Para codificar un certificado:
base64 -i cert.pfx > cert.b64
# Luego copiar el contenido a CSC_LINK
```

### macOS Notarization (Opcional en v0.1.0)

Para notarizar apps en macOS:

- **`APPLE_ID`** — Email del desarrollador de Apple.
- **`APPLE_ID_PASSWORD`** — Contraseña de app específica (generada en https://appleid.apple.com/account/manage).
- **`APPLE_TEAM_ID`** — Team ID de tu cuenta de desarrollador (ej: `ABCDE12345`).

**Nota:** El notarize aún está stub en `release.yml`. Para habilitarlo:

1. Descomentar secciones en `release.yml`
2. Asegurarse de tener un certificado de desarrollador válido instalado localmente

### Linux

No requiere secrets. Los artifacts (AppImage, deb, rpm) se crean sin firma.

## 🔄 Flujo de Release

### 1. Preparar Release

```bash
# Crear rama de release
git checkout -b release/v0.1.0

# Verificar versión en package.json
# Asegúrate de que "version": "0.1.0"

# Actualizar CHANGELOG.md si existe
# Incluir resumen de cambios y fecha de release

# Commit
git commit -am "chore: release v0.1.0"

# Push
git push origin release/v0.1.0

# Crear PR para review si es necesario
```

### 2. Validar en CI

- Los workflows de CI (`ci.yml`) se ejecutan automáticamente en cada push.
- Espera a que lint, tests y build pasen en todas las plataformas.
- Si algún check falla, corrige el error y vuelve a intentar.

### 3. Crear Tag y Release

```bash
# Crear tag localmente
git tag v0.1.0

# Empujar tag a GitHub
git push origin v0.1.0

# Esto dispara automáticamente release.yml
```

### 4. Monitorear Release Workflow

- Ve a GitHub > Actions > Release
- Espera a que los jobs se completen en todas las plataformas (Linux, Windows, macOS)
- Verifica que los artifacts se hayan uploadado correctamente

### 5. Publicar Release en GitHub

Una vez que `release.yml` completa:

1. Ve a GitHub > Releases > Tags
2. Haz click en el tag `v0.1.0`
3. Haz click en "Create release from tag"
4. Completa el formulario:
   - **Title:** `v0.1.0 — Astian Browser MVP`
   - **Description:** Copia el contenido de CHANGELOG.md o un resumen manual
   - **Prerelease:** Marca si es necesario
5. Publí calo

### 6. Verificar Auto-Update

En la v0.1.0+0.0.x:

1. Instala una versión anterior (ej: v0.0.x) si existe.
2. O modifica manualmente `package.json` version a `0.0.1` para testing.
3. Abre la app en dev mode: `bun run dev`
4. Verifica que aparezca el toast: "Actualización disponible — v0.1.0"
5. Haz click en "Descargar" (se descarga en background)
6. Verifica que aparezca el toast: "Actualización lista — v0.1.0"
7. Haz click en "Reiniciar ahora"
8. App se cierra y reinstala automáticamente

## 🧪 Testing

### Unit Tests

```bash
# Ejecutar tests
bun run test

# Watch mode
bun run test:watch
```

### E2E Smoke Tests

```bash
# Instalar Playwright (si no está)
bunx playwright install

# Ejecutar smoke tests
bun run test:e2e
```

## 📝 Convenciones

- **Commits:** Usa Conventional Commits (`feat:`, `fix:`, `chore:`, etc.)
- **PRs:** Linkazo issue si existe, describe cambios
- **Code:** TypeScript strict, ESLint + Prettier obligatorio

## 🐛 Reporte de Bugs

Usa GitHub Issues con template de bug report:

```markdown
**Descripción:**
[Qué pasó]

**Pasos para reproducir:**

1. ...
2. ...

**Comportamiento esperado:**
[Qué debería pasar]

**Sistema operativo:**
[Windows / macOS / Linux]

**Versión:**
[v0.1.0]
```

## 📄 Licencia

Este proyecto está bajo **GPL-3.0**. Consulta [LICENSE](LICENSE) para más detalles.

## 🙋 Preguntas

- Issues de GitHub para bugs o features
- Discussions para preguntas generales

---

**Gracias por contribuir a Astian Browser! 🚀**
