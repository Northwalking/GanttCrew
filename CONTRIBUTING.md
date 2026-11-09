# Contributing · Cómo contribuir

[English](#english) · [Español](#español)

## English

Thanks for helping! Bugs, translations, holiday calendars for other countries, documentation and new
features are all welcome.

**Before you start**

- For anything bigger than a small fix, open an issue first so we can agree on the approach.
- Never paste real team data (names, emails, evaluations, JSON files) into issues or pull requests.

**Set up**

```bash
npm install
npx playwright install chromium
npm run serve        # http://localhost:4173/GanttCrew.html and /demo/
npm test
```

**Guidelines**

- Keep it a **single HTML file with no runtime dependencies**. That is the point of the project.
- Code lives in `src/js/` (see [docs/architecture.md](docs/architecture.md)). Run `npm run format`.
- **Do not break existing data**: teams keep their `datos/` folder across versions. If you change the JSON
  format, read the old one too (see `migratePauses()` for an example).
- **Texts**: write visible texts in Spanish in the code and add the English translation to `i18n/en.tsv`.
  `npm test` fails if a Spanish text shows up in English mode. Keep Spanish and English wording plain and
  consistent with the existing terms.
- Add or update a test in `tests/` for behaviour changes.
- Add a line to `CHANGELOG.md` (and, if users will notice, a bilingual entry in `news.json`, shown in the
  app under *What's new in this version*).

**Pull requests**: small and focused, with a clear description and screenshots for visual changes. CI must
pass.

## Español

¡Gracias por ayudar! Se agradecen errores, traducciones, calendarios de festivos de otros países,
documentación y nuevas funciones.

**Antes de empezar**

- Para algo más que un arreglo pequeño, abre primero una incidencia y acordamos el enfoque.
- No pegues nunca datos reales de un equipo (nombres, correos, evaluaciones, archivos JSON) en incidencias
  ni pull requests.

**Preparar el entorno**

```bash
npm install
npx playwright install chromium
npm run serve        # http://localhost:4173/GanttCrew.html y /demo/
npm test
```

**Pautas**

- Mantén **un único archivo HTML sin dependencias en tiempo de ejecución**: es la razón de ser del proyecto.
- El código está en `src/js/` (ver [docs/architecture.md](docs/architecture.md)). Ejecuta `npm run format`.
- **No rompas los datos existentes**: los equipos conservan su carpeta `datos/` entre versiones. Si cambias
  el formato JSON, sigue leyendo el antiguo (ejemplo: `migratePauses()`).
- **Textos**: escribe los textos visibles en español en el código y añade la traducción inglesa en
  `i18n/en.tsv`. `npm test` falla si aparece un texto en español con la interfaz en inglés. Usa un
  lenguaje claro y coherente con los términos existentes.
- Añade o actualiza una prueba en `tests/` si cambia el comportamiento.
- Añade una línea al `CHANGELOG.md` (y, si el usuario lo va a notar, una entrada bilingüe en `news.json`,
  que la herramienta muestra en *Novedades de esta versión*).

**Pull requests**: pequeños y concretos, con una descripción clara y capturas si cambia algo visual. La
integración continua debe pasar.
