const express = require('express');
const cors = require('cors');
const app = express();

// Render asigna el puerto dinámicamente mediante variables de entorno
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Servir la documentación interactiva en la raíz
app.use(express.static('public'));

const ESTRUCTURA_INICIAL = require('./master.json');

const TOKENS_PERMITIDOS = new Set([
    "ALUMNO_JUAN_2026",
    "ALUMNO_MARIA_2026",
    "ALUMNO_CARLOS_2026",
    "PROFESOR_TEST"
]);

const SECCIONES_VALIDAS = new Set([
    "serie_televisiva",
    "peliculas",
    "otros_trabajos_directos",
    "miscelanea",
    "biografias_integrantes"
]);

const db = {};

// --- 1. ENDPOINT DE SALUD PARA RENDER ---
// Este endpoint debe estar ANTES del middleware checkAuth para que Render pueda consultarlo libremente
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: "UP", 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Middleware de Autenticación
const checkAuth = (req, res, next) => {
    const token = req.headers['authorization'];
    
    if (!token) {
        return res.status(401).json({ error: "Falta la cabecera 'Authorization'" });
    }

    if (!TOKENS_PERMITIDOS.has(token)) {
        return res.status(403).json({ error: "Token inválido o no autorizado" });
    }

    if (!db[token]) {
        const copiaLimpia = JSON.parse(JSON.stringify(ESTRUCTURA_INICIAL));
        
        SECCIONES_VALIDAS.forEach(seccion => {
            if (copiaLimpia[seccion] && Array.isArray(copiaLimpia[seccion].datos)) {
                copiaLimpia[seccion].datos = copiaLimpia[seccion].datos.map((item, index) => {
                    if (!item.id) item.id = index + 1; 
                    return item;
                });
            }
        });
        
        db[token] = copiaLimpia;
    }

    req.alumnoToken = token;
    next();
};

const validarSeccion = (req, res, next) => {
    const seccion = req.params.seccion;
    if (!SECCIONES_VALIDAS.has(seccion)) {
        return res.status(404).json({ error: `La sección '${seccion}' no es válida.` });
    }
    next();
};

const validarCamposObligatorios = (req, res, next) => {
    const datos = req.body;
    if (!datos || Object.keys(datos).length === 0) {
        return res.status(400).json({ error: "El cuerpo de la petición no puede estar vacío." });
    }
    next();
};

// --- ENDPOINTS CRUD ---

app.get('/api/master', checkAuth, (req, res) => {
    res.json(db[req.alumnoToken]);
});

app.get('/api/master/:seccion', [checkAuth, validarSeccion], (req, res) => {
    const seccionData = db[req.alumnoToken][req.params.seccion];
    res.json(seccionData);
});

app.post('/api/master/:seccion', [checkAuth, validarSeccion, validarCamposObligatorios], (req, res) => {
    const seccion = req.params.seccion;
    const tablaSeccion = db[req.alumnoToken][seccion];
    
    const nuevoElemento = {
        id: Date.now(),
        ...req.body
    };

    tablaSeccion.datos.push(nuevoElemento);
    
    if (tablaSeccion.hasOwnProperty('peliculas_totales')) tablaSeccion.peliculas_totales = tablaSeccion.datos.length;
    if (tablaSeccion.hasOwnProperty('total_items')) tablaSeccion.total_items = tablaSeccion.datos.length;
    if (tablaSeccion.hasOwnProperty('miembros_totales')) tablaSeccion.miembros_totales = tablaSeccion.datos.length;

    res.status(201).json(nuevoElemento);
});

app.put('/api/master/:seccion/:id', [checkAuth, validarSeccion, validarCamposObligatorios], (req, res) => {
    const { seccion, id } = req.params;
    const datosArray = db[req.alumnoToken][seccion].datos;
    const index = datosArray.findIndex(item => item.id == id);

    if (index === -1) {
        return res.status(404).json({ error: `No se encontró ningún elemento con ID ${id} en la sección ${seccion}.` });
    }

    datosArray[index] = { ...datosArray[index], ...req.body, id: datosArray[index].id };
    res.json(datosArray[index]);
});

app.delete('/api/master/:seccion/:id', [checkAuth, validarSeccion], (req, res) => {
    const { seccion, id } = req.params;
    const tablaSeccion = db[req.alumnoToken][seccion];
    const index = tablaSeccion.datos.findIndex(item => item.id == id);

    if (index === -1) {
        return res.status(404).json({ error: `No se encontró ningún elemento con ID ${id} en la sección ${seccion}.` });
    }

    const eliminado = tablaSeccion.datos.splice(index, 1);

    if (tablaSeccion.hasOwnProperty('peliculas_totales')) tablaSeccion.peliculas_totales = tablaSeccion.datos.length;
    if (tablaSeccion.hasOwnProperty('total_items')) tablaSeccion.total_items = tablaSeccion.datos.length;
    if (tablaSeccion.hasOwnProperty('miembros_totales')) tablaSeccion.miembros_totales = tablaSeccion.datos.length;

    res.json({ mensaje: "Elemento eliminado correctamente", elemento: eliminado });
});

app.post('/api/master/reset', checkAuth, (req, res) => {
    delete db[req.alumnoToken];
    res.json({ mensaje: "Tu entorno de datos ha sido restaurado por completo al estado inicial." });
});

app.listen(PORT, () => {
    console.log(`Servidor API corriendo en el puerto ${PORT}`);
    
    // --- 2. SISTEMA DE AUTO-PING PARA EVITAR QUE SE DUERMA EN CLASE ---
    // Si la variable RENDER_EXTERNAL_URL existe (Render la inyecta sola), se despierta a sí mismo cada 10 minutos
    const APP_URL = process.env.RENDER_EXTERNAL_URL;
    if (APP_URL) {
        setInterval(() => {
            fetch(`${APP_URL}/health`)
                .then(() => console.log('Auto-ping de mantenimiento exitoso para evitar suspensión.'))
                .catch(err => console.error('Error en el auto-ping:', err.message));
        }, 10 * 60 * 1000); // 10 minutos (Render suspende a los 15 minutos)
    }
});
