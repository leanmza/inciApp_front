// ========================================
// PROTECCIÓN DE PÁGINAS
// ========================================
// Reemplaza al middleware "paginasProtegidas" del servidor Node.
// Se incluye en el <head> de las páginas que requieren sesión, después de
// config.js y api.js. Si no hay un JWT vigente, redirige a login.html.
Auth.requireAuth();
