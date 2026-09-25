// A single local "daily verse" reminder. No push tokens, no server — nothing
// about the child leaves the device.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const REMINDER_KEY = 'bible-friend.daily-reminder';
const CHANNEL_ID = 'daily-verse';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export function isDailyReminderOn(): boolean {
  try {
    return localStorage.getItem(REMINDER_KEY) === 'on';
  } catch {
    return false;
  }
}

export async function enableDailyReminder(hour = 19, minute = 0): Promise<boolean> {
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: '오늘의 말씀',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: { title: '성경 친구가 기다려요 🌈', body: '오늘의 말씀 한 끼 먹으러 갈까요?' },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: CHANNEL_ID,
    },
  });
  localStorage.setItem(REMINDER_KEY, 'on');
  return true;
}

export async function disableDailyReminder(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  localStorage.setItem(REMINDER_KEY, 'off');
}
