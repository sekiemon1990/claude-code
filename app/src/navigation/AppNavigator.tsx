import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/hooks/useAuth';
import { LoginScreen } from '@/screens/LoginScreen';
import { RecordingListScreen } from '@/screens/RecordingListScreen';
import { RecordScreen } from '@/screens/RecordScreen';
import { RecordingDetailScreen } from '@/screens/RecordingDetailScreen';

export type RootStackParamList = {
  List: undefined;
  Record: undefined;
  Detail: { recordingId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="List">
          {({ navigation }) => (
            <RecordingListScreen
              onSelect={(id) => navigation.navigate('Detail', { recordingId: id })}
              onNewRecording={() => navigation.navigate('Record')}
              onSignOut={signOut}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Record" options={{ headerShown: true, title: '新規録音' }}>
          {({ navigation }) => (
            <RecordScreen
              onDone={(id) => {
                navigation.replace('Detail', { recordingId: id });
              }}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Detail" options={{ headerShown: true, title: '詳細' }}>
          {({ route, navigation }) => (
            <RecordingDetailScreen
              recordingId={route.params.recordingId}
              onBack={() => navigation.goBack()}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
