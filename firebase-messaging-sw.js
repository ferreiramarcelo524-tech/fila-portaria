// Este arquivo precisa ficar na RAIZ do site, na mesma pasta do index.html.
// Ele é responsável por mostrar a notificação mesmo quando o app está
// fechado ou o celular está com a tela bloqueada.

importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyCDv9K7VtXwe81eAzQteQb83IYkebPasgE",
    authDomain: "expedicao-antifraud.firebaseapp.com",
    projectId: "expedicao-antifraud",
    storageBucket: "expedicao-antifraud.firebasestorage.app",
    messagingSenderId: "683256630906",
    appId: "1:683256630906:web:688866abf7f2d00e6eb5c3"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    const titulo = (payload.notification && payload.notification.title) || "CD84 - Portaria";
    const opcoes = {
        body: (payload.notification && payload.notification.body) || "",
        icon: "icon-192.png",
        badge: "favicon-32.png",
        vibrate: [200, 100, 200]
    };
    self.registration.showNotification(titulo, opcoes);
});
