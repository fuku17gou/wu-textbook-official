// Service Worker: プッシュ通知の受信と表示
self.addEventListener('push', function (event) {
  if (!event.data) return;

  const data = event.data.json();
  const title = data.title || '学内教科書フリマ';
  const options = {
    body: data.body || '新しい通知が届きました',
    icon: '/icon.png',
    badge: '/icon.png',
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// 通知をクリックしたときの動作（アプリの画面を開く）
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});