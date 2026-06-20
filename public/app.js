document.addEventListener('DOMContentLoaded', () => {
    const playMethod = document.getElementById('play-method');
    const playSeccion = document.getElementById('play-seccion');
    const playToken = document.getElementById('play-token');
    const playPayload = document.getElementById('play-payload');
    const payloadContainer = document.getElementById('payload-container');
    const btnSend = document.getElementById('btn-send');
    const responseOutput = document.getElementById('response-output');
    const responseStatus = document.getElementById('response-status');

    // Escucha cambios en el método HTTP para ocultar o mostrar la caja del JSON (Payload)
    playMethod.addEventListener('change', () => {
        if (playMethod.value === 'POST') {
            payloadContainer.classList.remove('hidden');
        } else {
            payloadContainer.classList.add('hidden');
        }
    });

    // Ejecuta la llamada simulada hacia tu API en Node.js
    btnSend.addEventListener('click', async () => {
        const token = playToken.value.trim();
        const metodo = playMethod.value;
        const seccion = playSeccion.value;

        if (!token) {
            alert('¡Por favor, introduce un Token de alumno válido para las pruebas!');
            return;
        }

        // Construcción dinámica de la URL del endpoint local
        let url = '/api/master';
        let options = {
            method: metodo === 'RESET' ? 'POST' : metodo,
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json'
            }
        };

        if (metodo === 'RESET') {
            url += '/reset';
        } else if (seccion) {
            url += `/${seccion}`;
        }

        // Si es un POST ordinario adjuntamos el cuerpo
        if (metodo === 'POST' && playMethod.value !== 'RESET') {
            try {
                options.body = JSON.stringify(JSON.parse(playPayload.value));
            } catch (e) {
                responseStatus.textContent = "Error JSON";
                responseStatus.className = "status-badge error";
                responseOutput.textContent = `// Error de formato en tu Payload:\n${e.message}`;
                return;
            }
        }

        responseStatus.textContent = "Cargando...";
        responseStatus.className = "status-badge";

        try {
            const res = await fetch(url, options);
            const data = await res.json();

            // Actualizamos la etiqueta de estado HTTP devuelta por Express
            responseStatus.textContent = `Status: ${res.status} ${res.statusText}`;
            if (res.ok) {
                responseStatus.className = "status-badge success";
            } else {
                responseStatus.className = "status-badge error";
            }

            // Pintamos el JSON formateado con 2 espacios en la caja de consola
            responseOutput.textContent = JSON.stringify(data, null, 2);

        } catch (error) {
            responseStatus.textContent = "Error de Conexión";
            responseStatus.className = "status-badge error";
            responseOutput.textContent = `// No se pudo conectar con el servidor API:\n${error.message}`;
        }
    });
});
