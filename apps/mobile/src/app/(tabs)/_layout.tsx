import { Image } from 'expo-image';
import { Tabs } from 'expo-router/js-tabs';

import { colors, fonts } from '@/theme';

const icons = {
  index: require('@/assets/images/friend/nav-chat.png'),
  stories: require('@/assets/images/friend/nav-story.png'),
  records: require('@/assets/images/friend/nav-record.png'),
  growth: require('@/assets/images/friend/nav-growth.png'),
};

function TabIcon({ source, focused }: { source: number; focused: boolean }) {
  return (
    <Image
      source={source}
      style={{ width: 34, height: 34, opacity: focused ? 1 : 0.55, transform: [{ scale: focused ? 1.08 : 1 }] }}
      contentFit="contain"
    />
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.display, fontSize: 13 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 76,
          paddingTop: 6,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: '대화', tabBarIcon: ({ focused }) => <TabIcon source={icons.index} focused={focused} /> }}
      />
      <Tabs.Screen
        name="stories"
        options={{ title: '이야기', tabBarIcon: ({ focused }) => <TabIcon source={icons.stories} focused={focused} /> }}
      />
      <Tabs.Screen
        name="records"
        options={{ title: '기록', tabBarIcon: ({ focused }) => <TabIcon source={icons.records} focused={focused} /> }}
      />
      <Tabs.Screen
        name="growth"
        options={{ title: '성장', tabBarIcon: ({ focused }) => <TabIcon source={icons.growth} focused={focused} /> }}
      />
    </Tabs>
  );
}
