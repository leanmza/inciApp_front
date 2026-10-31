# Reporte Ciudadano — Front

Front estático (HTML + CSS + JS) que consume la API de Spring Boot **inciApp**.
Ya **no usa Node**: se eliminó `server.js`, `package.json`, `node_modules` y `.env`.

## Cómo correrlo

1. Levantar el back (inciApp) en `http://localhost:8080`.
   - Tiene que existir el rol `USER` en la tabla `roles` (se asigna a cada usuario nuevo).
2. Servir el front con cualquier servidor estático:
   - VS Code → extensión *Live Server* → clic derecho en `index.html` → *Open with Live Server*.
   - o `npx serve .` / `python -m http.server 5500`
   - No abrir los HTML con doble clic (`file://`): el header se carga con `fetch` y no funciona así.
3. Si el back corre en otra URL, cambiarla en `js/config.js`.

## Cómo funciona la sesión (JWT)

- `templates/login.html` hace `POST /auth/login` → el back devuelve `{ username, jwt }`.
- El token se guarda en `sessionStorage` (o en `localStorage` si se marca *Recordar mi sesión*).
- `js/api.js` → `Auth.apiFetch()` agrega `Authorization: Bearer <token>` a cada petición.
  Si el back responde 401 (token vencido, dura 30 min) borra el token y manda al login.
- `js/guard.js` va en el `<head>` de las páginas privadas: sin token vigente redirige a
  `templates/login.html?next=<página>` y después del login vuelve a esa página.
- `js/header.js` muestra/oculta las opciones del menú con `data-auth="user"` / `data-auth="guest"`.
- Cerrar sesión = borrar el token (`Auth.logout()`).

## Endpoints usados

| Acción | Antes (Node) | Ahora (Spring) |
|---|---|---|
| Login | `POST /login` | `POST /auth/login` |
| Registro | `POST /register` | `POST /api/users` |
| ¿Hay sesión? | `GET /session-status` | se lee el JWT en el navegador |
| Ver perfil | `GET /api/profile` | `GET /api/users/me` |
| Editar perfil | `PUT /api/profile` | `PUT /api/users/me` |
| Eliminar cuenta | `DELETE /api/profile` | `DELETE /api/users/me` (soft delete) |
| Cambiar contraseña | `POST /api/change-password` | `PATCH /api/users/me/password` |
| Cerrar sesión | `POST /logout` | se borra el token |
| Provincias/deptos/localidades | escritos a mano | `GET /api/provincias`, `/api/departamentos`, `/api/localidades` |

## Estructura

```
proyecto_final/
├── index.html            ← única página en la raíz
├── templates/            ← todas las demás páginas + header.html (parcial)
├── assets/               ← css, íconos, imágenes
└── js/
```

- Las páginas de `templates/` usan `../assets/...`, `../js/...` y `../index.html`.
- `index.html` enlaza a `templates/...`.
- `templates/header.html` se inyecta tanto en `index.html` como en las páginas de `templates/`,
  por eso sus `href` están escritos desde la raíz (`index.html`, `templates/profile.html`) y
  `header.js` les agrega `../` cuando hace falta (`Auth.url()` en `js/api.js`).
- Para redirigir por código usar siempre `Auth.url('templates/xxx.html')`.
