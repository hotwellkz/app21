import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface NotificationData {
  title: string;
  message: string;
  type: 'inventory' | 'client' | 'payment' | 'estimate' | 'construction';
}

export const sendNotification = async (data: NotificationData) => {
  try {
    // Сохраняем уведомление в Firebase
    await addDoc(collection(db, 'notifications'), {
      ...data,
      timestamp: serverTimestamp(),
      isRead: false
    });

    // Здесь будет интеграция с Telegram
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      const message = `${data.title}\n\n${data.message}`;
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'HTML'
        })
      });
    }

    return true;
  } catch (error) {
    console.error('Error sending notification:', error);
    return false;
  }
};

export const sendLowStockNotification = async (productName: string, quantity: number, unit: string) => {
  return sendNotification({
    title: 'Низкий остаток товара',
    message: `Товар "${productName}" заканчивается. Текущий остаток: ${quantity} ${unit}`,
    type: 'inventory'
  });
};