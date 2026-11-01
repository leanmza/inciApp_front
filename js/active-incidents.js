// ========================================
// INCIDENTES ACTIVOS  ->  GET /api/incidentes (Spring, público)
// ========================================
// La página se ve sin sesión iniciada; el back tiene que permitir
// GET /api/incidentes sin JWT.
// Respuesta: lista de IncidenteResponseDTO de todos los usuarios
//   { id, tipo, descripcion, direccion, fecha, estado, prioridad,
//     localidad, departamento, usuario, images: [...] }
// Solo se muestran los que siguen en curso (pendiente, en revisión, en proceso).

document.addEventListener('DOMContentLoaded', () => {
    const lista = document.getElementById('incidents-list');
    const contador = document.getElementById('incidents-counter');
    const mensaje = document.getElementById('incidents-message');
    const formulario = document.getElementById('filters-form');
    const buscador = document.getElementById('filter-search');
    const selectPrioridad = document.getElementById('filter-severity');
    const paginacion = document.getElementById('pagination-section');
    const infoPaginacion = document.getElementById('pagination-info');
    const botonMas = document.getElementById('load-more-btn');

    // Ids de la tabla de estados del back (mismos que en my-reports.js)
    const ESTADO = {
        PENDIENTE: 1,
        EN_REVISION: 2,
        EN_PROCESO: 3
    };
    const ESTADOS_ACTIVOS = [ESTADO.PENDIENTE, ESTADO.EN_REVISION, ESTADO.EN_PROCESO];

    // Clase del badge según el estado (definidas en styles.css)
    const CLASES_ESTADO = {
        [ESTADO.PENDIENTE]: 'badge-active',
        [ESTADO.EN_REVISION]: 'badge-in-progress',
        [ESTADO.EN_PROCESO]: 'badge-in-progress'
    };

    const IMAGEN_POR_DEFECTO = '../assets/img/camara.png';
    const POR_PAGINA = 6;

    let incidentes = [];
    let visibles = [];
    let mostrados = POR_PAGINA;

    // ---------- Helpers para leer los DTO anidados ----------

    // Devuelve el primer campo de texto que exista en el objeto.
    // Si los DTO del back usan otro nombre, agregarlo a la lista correspondiente.
    const texto = (obj, claves) => {
        if (!obj) return '';
        if (typeof obj === 'string') return obj;
        const clave = claves.find(c => obj[c]);
        return clave ? String(obj[clave]) : '';
    };

    const nombreTipo = (i) => texto(i.tipo, ['tipo', 'nombre', 'descripcion']);
    const nombreEstado = (i) => texto(i.estado, ['estado', 'nombre', 'descripcion']);
    const nombrePrioridad = (i) => texto(i.prioridad, ['prioridad', 'nombre', 'descripcion']);
    const nombreLocalidad = (i) => texto(i.localidad, ['nombre', 'localidad']);
    const nombreDepartamento = (i) => texto(i.departamento, ['nombre', 'departamento']);

    const urlImagen = (i) => {
        const primera = i.images && i.images[0];
        const ruta = texto(primera, ['url', 'imageUrl', 'ruta', 'path']);
        if (!ruta) return IMAGEN_POR_DEFECTO;
        // URL absoluta (ej. Cloudinary) o ruta servida por el back
        if (/^(https?:|data:)/i.test(ruta)) return ruta;
        return Auth.API_URL + (ruta.startsWith('/') ? '' : '/') + ruta;
    };

    const idEstado = (i) => Number(i.estado && i.estado.id);

    // 'high' | 'medium' | 'low' | 'none' según el nombre de la prioridad
    const nivelPrioridad = (i) => {
        const p = nombrePrioridad(i).toLowerCase();
        if (!p) return 'none';
        if (p.includes('alta') || p.includes('urgente')) return 'high';
        if (p.includes('media')) return 'medium';
        return 'low';
    };

    const CLASES_PRIORIDAD = {
        high: 'badge-high-severity',
        medium: 'badge-medium-severity',
        low: 'badge-low-severity',
        none: 'badge-low-severity'
    };

    // ---------- Formato ----------

    // "AAAA-MM-DD" (LocalDate) -> "Hoy", "Ayer" o "DD/MM/AAAA"
    const formatearFecha = (iso) => {
        if (!iso) return '';
        const [anio, mes, dia] = String(iso).split('-').map(Number);
        if (!anio || !mes || !dia) return iso;

        const fecha = new Date(anio, mes - 1, dia);
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const dias = Math.round((hoy - fecha) / 86400000);

        if (dias === 0) return 'Hoy';
        if (dias === 1) return 'Ayer';
        return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${anio}`;
    };

    // ---------- Render ----------

    const crearTarjeta = (i) => {
        const tarjeta = document.createElement('article');
        tarjeta.className = 'incident-card';

        // Estructura fija; los datos del back se cargan con textContent (evita inyectar HTML)
        tarjeta.innerHTML = `
            <div class="card-media">
                <span class="incident-id-badge"></span>
                <img class="incident-image" alt="">
            </div>
            <div class="card-body">
                <div class="card-header-meta">
                    <div class="badge-group">
                        <span class="badge badge-prioridad"></span>
                        <span class="badge badge-estado"></span>
                    </div>
                    <time class="meta-time"></time>
                </div>
                <h2 class="card-title"></h2>
                <div class="card-location">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    <span class="location-text"></span>
                </div>
                <p class="card-description"></p>
                <div class="card-footer">
                    <div class="anon-vote-info">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                            <circle cx="12" cy="13" r="4"></circle>
                        </svg>
                        <span class="fotos-text"></span>
                    </div>
                    <a class="card-action-link">Ver detalles 🡪</a>
                </div>
            </div>`;

        const tipo = nombreTipo(i) || 'Sin categoría';
        const ubicacion = [i.direccion, nombreLocalidad(i), nombreDepartamento(i)].filter(Boolean).join(', ');
        const prioridad = nombrePrioridad(i);

        tarjeta.querySelector('.incident-id-badge').textContent = `#REP-${i.id}`;

        const img = tarjeta.querySelector('.incident-image');
        img.src = urlImagen(i);
        img.alt = tipo;
        img.addEventListener('error', () => { img.src = IMAGEN_POR_DEFECTO; }, { once: true });

        const badgePrioridad = tarjeta.querySelector('.badge-prioridad');
        badgePrioridad.textContent = prioridad ? `Prioridad ${prioridad}` : 'Sin prioridad';
        badgePrioridad.classList.add(CLASES_PRIORIDAD[nivelPrioridad(i)]);

        const badgeEstado = tarjeta.querySelector('.badge-estado');
        badgeEstado.textContent = nombreEstado(i) || 'Sin estado';
        badgeEstado.classList.add(CLASES_ESTADO[idEstado(i)] || 'badge-active');

        const tiempo = tarjeta.querySelector('.meta-time');
        tiempo.textContent = formatearFecha(i.fecha);
        if (i.fecha) tiempo.dateTime = i.fecha;

        tarjeta.querySelector('.card-title').textContent = tipo;
        tarjeta.querySelector('.location-text').textContent = ubicacion || 'Ubicación no informada';
        tarjeta.querySelector('.card-description').textContent = i.descripcion || '';
        const fotos = (i.images || []).length;
        tarjeta.querySelector('.fotos-text').textContent =
            fotos === 1 ? '1 foto' : `${fotos} fotos`;

        tarjeta.querySelector('.card-action-link').href =
            `report-details.html?id=${encodeURIComponent(i.id)}`;

        return tarjeta;
    };

    const coincideBusqueda = (i, termino) => {
        if (!termino) return true;
        const campos = [
            `rep-${i.id}`, String(i.id), i.direccion, i.descripcion,
            nombreTipo(i), nombreEstado(i), nombrePrioridad(i),
            nombreLocalidad(i), nombreDepartamento(i)
        ];
        return campos.some(c => (c || '').toLowerCase().includes(termino));
    };

    const mostrarVacio = (texto) => {
        const vacio = document.createElement('p');
        vacio.className = 'reports-empty';
        vacio.textContent = texto;
        lista.appendChild(vacio);
    };

    const render = () => {
        lista.innerHTML = '';
        paginacion.hidden = true;

        if (incidentes.length === 0) {
            mostrarVacio('No hay incidentes en curso en este momento.');
            return;
        }
        if (visibles.length === 0) {
            mostrarVacio('No hay incidentes que coincidan con la búsqueda.');
            return;
        }

        visibles.slice(0, mostrados).forEach(i => lista.appendChild(crearTarjeta(i)));

        const cantidad = Math.min(mostrados, visibles.length);
        infoPaginacion.textContent = `Mostrando ${cantidad} de ${visibles.length} reportes`;
        botonMas.hidden = cantidad >= visibles.length;
        paginacion.hidden = false;
    };

    // Aplica búsqueda y prioridad, y vuelve a la primera tanda
    const filtrar = () => {
        const termino = buscador.value.trim().toLowerCase().replace(/^#/, '');
        const prioridad = selectPrioridad.value;

        visibles = incidentes
            .filter(i => prioridad === 'all' || nivelPrioridad(i) === prioridad)
            .filter(i => coincideBusqueda(i, termino));

        mostrados = POR_PAGINA;
        render();
    };

    const actualizarContador = () => {
        const total = incidentes.length;
        contador.textContent = total === 1 ? '1 reclamo activo' : `${total} reclamos activos`;
    };

    // ---------- Eventos ----------

    formulario.addEventListener('submit', (event) => event.preventDefault());
    buscador.addEventListener('input', filtrar);
    selectPrioridad.addEventListener('change', filtrar);

    botonMas.addEventListener('click', () => {
        mostrados += POR_PAGINA;
        render();
    });

    // ---------- Carga ----------

    const cargarIncidentes = async () => {
        try {
            // Página pública: se pide sin token. Así un JWT vencido guardado en el
            // navegador no provoca un 401 que redirija al login.
            const datos = await Auth.apiFetch('/api/incidentes', { auth: false, cache: 'no-store' });

            // Solo los que siguen en curso; más recientes primero
            incidentes = (Array.isArray(datos) ? datos : [])
                .filter(i => ESTADOS_ACTIVOS.includes(idEstado(i)))
                .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')) || b.id - a.id);

            mensaje.hidden = true;
            actualizarContador();
            filtrar();

        } catch (error) {
            lista.innerHTML = '';
            contador.textContent = 'Sin datos';
            mensaje.textContent = 'No se pudieron cargar los incidentes: ' + error.message;
            mensaje.hidden = false;
        }
    };

    cargarIncidentes();
});
