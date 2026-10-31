// ========================================
// SELECTS DE PROVINCIA / DEPARTAMENTO / LOCALIDAD
// ========================================
// Antes los departamentos estaban escritos a mano en el HTML (ids 1 a 18).
// Ahora se cargan de la API, así coinciden siempre con la base de datos.
//   GET /api/provincias      -> [{ id, nombre, departamentos: [...] }]
//   GET /api/departamentos   -> [{ id, nombre, provincia: { id, nombre } }]
//   GET /api/localidades     -> [{ id, nombre, departamento: { id, nombre } }]

(function () {
    let cache = null;

    async function cargarDatos() {
        if (cache) return cache;

        const [provincias, departamentos, localidades] = await Promise.all([
            Auth.apiFetch('/api/provincias', { auth: false }),
            Auth.apiFetch('/api/departamentos', { auth: false }),
            Auth.apiFetch('/api/localidades', { auth: false })
        ]);

        const porNombre = (a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es');

        cache = {
            provincias: (provincias || []).sort(porNombre),
            departamentos: (departamentos || []).sort(porNombre),
            localidades: (localidades || []).sort(porNombre)
        };
        return cache;
    }

    function llenarSelect(select, items, textoVacio) {
        select.innerHTML = '';

        const vacia = document.createElement('option');
        vacia.value = '';
        vacia.textContent = textoVacio;
        select.appendChild(vacia);

        items.forEach((item) => {
            const opcion = document.createElement('option');
            opcion.value = item.id;
            opcion.textContent = item.nombre;
            select.appendChild(opcion);
        });

        select.disabled = items.length === 0;
    }

    /**
     * Encadena los tres selects y opcionalmente preselecciona valores.
     * seleccion = { idProvincia, idDepartamento, idLocalidad }
     * Si no se indica provincia, se preselecciona Mendoza si existe.
     */
    async function iniciar({ provincia, departamento, localidad }, seleccion = {}) {
        const datos = await cargarDatos();

        const actualizarLocalidades = () => {
            const idDep = Number(departamento.value);
            const lista = datos.localidades.filter(l => l.departamento && l.departamento.id === idDep);
            llenarSelect(localidad, lista, idDep ? 'Selecciona tu localidad' : 'Selecciona primero el departamento');
            if (!idDep) localidad.disabled = true;
        };

        const actualizarDepartamentos = () => {
            const idProv = Number(provincia.value);
            const lista = datos.departamentos.filter(d => d.provincia && d.provincia.id === idProv);
            llenarSelect(departamento, lista, idProv ? 'Selecciona tu departamento' : 'Selecciona primero la provincia');
            if (!idProv) departamento.disabled = true;
            actualizarLocalidades();
        };

        llenarSelect(provincia, datos.provincias, 'Selecciona tu provincia');
        provincia.disabled = false;

        provincia.addEventListener('change', actualizarDepartamentos);
        departamento.addEventListener('change', actualizarLocalidades);

        let idProvincia = seleccion.idProvincia;
        if (!idProvincia) {
            const mendoza = datos.provincias.find(p => (p.nombre || '').toLowerCase() === 'mendoza');
            if (mendoza) idProvincia = mendoza.id;
        }

        if (idProvincia) provincia.value = String(idProvincia);
        actualizarDepartamentos();

        if (seleccion.idDepartamento) {
            departamento.value = String(seleccion.idDepartamento);
            actualizarLocalidades();
        }
        if (seleccion.idLocalidad) {
            localidad.value = String(seleccion.idLocalidad);
        }
    }

    window.Ubicaciones = { iniciar };
})();
