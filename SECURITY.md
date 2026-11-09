# Security · Seguridad

## English

GanttCrew has no server: it reads and writes JSON files in a folder shared through a cloud drive.

- **Permissions are enforced by the app.** Anyone with edit access to the folder can modify the files by
  hand. Share the folder only with your team.
- **Encrypted**: quality evaluations and private projects (AES-GCM, key derived from the PM password with
  PBKDF2-SHA-256). Without the password they cannot be read or recovered.
- **Not encrypted**: everything else in the folder, and the backup downloaded from *Projects & team*
  (it includes the evaluations in clear text).

If you find a vulnerability, please do not open a public issue: use GitHub's *Report a vulnerability*
(Security tab) so it can be fixed before it is disclosed.

## Español

GanttCrew no tiene servidor: lee y escribe archivos JSON en una carpeta compartida en la nube.

- **Los permisos los aplica la herramienta.** Quien tenga permiso de edición en la carpeta puede modificar
  los archivos a mano. Comparte la carpeta solo con tu equipo.
- **Cifrado**: las evaluaciones de calidad y los proyectos privados (AES-GCM, con clave derivada de la
  contraseña del PM mediante PBKDF2-SHA-256). Sin la contraseña no se pueden leer ni recuperar.
- **Sin cifrar**: todo lo demás de la carpeta y la copia de seguridad que se descarga en *Proyectos y
  equipo* (incluye las evaluaciones en claro).

Si encuentras una vulnerabilidad, no abras una incidencia pública: usa *Report a vulnerability* (pestaña
Security de GitHub) para poder corregirla antes de hacerla pública.
