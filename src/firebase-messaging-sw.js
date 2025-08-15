importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey : "AIzaSyCZ2Kr_6gWKopc_QIabMb_QWGMmS9Cupzo" ,
    authDomain : "connect-to-node-red-74531.firebaseapp.com" ,
    databaseURL : "https://connect-to-node-red-74531-default-rtdb.firebaseio.com" ,
    projectId : "connect-to-node-red-74531" ,
    storageBucket : "connect-to-node-red-74531.firebasestorage.app" ,
    messagingSenderId : "747008638747" ,
    appId : "1:747008638747:web:d0653f4b5601ee5a7d9dbe" ,
    measurementId : "G-SXPD0D43PB"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
    const d = payload.data || {}
    const n = payload.notification || {}
    const title = d.title || n.title || 'Notification'
    const body  = d.body  || n.body  || ''
    const image = d.image || n.image || 'https://c4.wallpaperflare.com/wallpaper/347/1000/853/studio-ghibli-howl-s-moving-castle-calcifer-anime-fire-hd-wallpaper-thumb.jpg'
    const icon  = d.icon  || n.icon

    const options = {
        body,
        icon,     // small icon
        image,    // BIG image
        data: { url: d.url || n.click_action || '/test/' },
        requireInteraction: false
    };

    self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    event.waitUntil(clients.openWindow('/test/'))
})
