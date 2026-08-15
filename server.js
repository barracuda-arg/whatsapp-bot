// server.js
const {
    Client,
    LocalAuth
} = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// 1. Inicializamos el cliente de WhatsApp
// const client = new Client({
//     // LocalAuth guarda la sesión en una carpeta para no tener que escanear el QR cada vez que reinicies
//     authStrategy: new LocalAuth({
//         dataPath: './whatsapp-session'
//     }),
//     puppeteer: {
//         headless: false,
//         // Parámetros recomendados para servidores Linux/VPS
//         args: ['--no-sandbox', '--disable-setuid-sandbox']
//     }
// });

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './whatsapp-session'
    }),
    puppeteer: {
        headless: true, // O false si querés ver la ventana
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            // 🌟 Forzamos a que use un agente de un Chrome real y moderno de escritorio
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ]
    }
});

// 2. Evento para mostrar el código QR en la terminal
client.on('qr', (qr) => {
    console.log('--- ESCANEÁ ESTE CÓDIGO QR CON TU CELULAR ---');
    qrcode.generate(qr, {
        small: true
    });
});

// 3. Evento cuando el bot ya está conectado y listo
client.on('ready', () => {
    console.log('¡WhatsApp conectado exitosamente y listo para enviar mensajes!');
});

// 4. Endpoint HTTP que va a escuchar las órdenes de Laravel
app.post('/api/send', async (req, res) => {
    const {
        phone,
        message
    } = req.body;

    if (!phone || !message) {
        return res.status(400).json({
            status: 'error',
            message: 'Faltan parámetros'
        });
    }

    try {
        // En Argentina, el formato de WhatsApp requiere el código de país (54)
        // seguido del número con el formato que espera la librería (generalmente '549387xxxxxxx@c.us')
        // Limpiamos el número por las dudas
        let formattedPhone = phone.replace(/\D/g, ''); // Deja solo números

        // Si no tiene el @c.us al final, se lo agregamos (es el identificador de chat de WA)
        if (!formattedPhone.endsWith('@c.us')) {
            formattedPhone = `${formattedPhone}@c.us`;
        }

        // Enviamos el mensaje físico a través de WhatsApp Web
        await client.sendMessage(formattedPhone, message);

        console.log(`Mensaje enviado con éxito a: ${formattedPhone}`);
        return res.json({
            status: 'success',
            message: 'Mensaje enviado'
        });

    } catch (error) {
        console.error('Error al enviar el mensaje:', error);
        return res.status(500).json({
            status: 'error',
            detail: error.message
        });
    }
});

// Levantamos el servidor de Express en el puerto 3000
const PORT = process.env.PORT || 3000;
client.initialize();
app.listen(PORT, () => {
    console.log(`Servidor de alertas escuchando en el puerto ${PORT}`);
});


// Al final de tu server.js, agregá este bloque de código:
process.on('SIGINT', async () => {
    console.log('\n🛑 Recibida señal de apagado. Cerrando el bot de forma limpia...');

    try {
        if (client) {
            // .destroy() cierra el navegador Puppeteer de raíz y libera los archivos de sesión sin romperlos
            await client.destroy();
            console.log('✅ Navegador oculto cerrado correctamente.');
        }
    } catch (err) {
        console.error('Error al cerrar el cliente:', err);
    }

    process.exit(0); // Ahora sí, matamos el proceso de Node
});

app.post('/api/logout', async (req, res) => {
    try {
        console.log('Cerrando sesión de WhatsApp de forma definitiva...');

        // 1. Le avisa a los servidores de Meta que desvincule este dispositivo
        await client.logout();

        return res.json({
            status: 'success',
            message: 'Sesión destruida y dispositivo desvinculado exitosamente.'
        });
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        return res.status(500).json({
            status: 'error',
            detail: error.message
        });
    }
});