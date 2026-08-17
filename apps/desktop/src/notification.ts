import { Notification } from 'electron';

interface DesktopNotificationOptions {
  title: string;
  body: string;
  onClick?: () => void;
}

export function showDesktopNotification({ title, body, onClick }: DesktopNotificationOptions) {
  if (!Notification.isSupported()) return;

  const notification = new Notification({ title, body });
  if (onClick) notification.on('click', onClick);
  notification.show();
}
