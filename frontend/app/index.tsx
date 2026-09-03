// app/index.tsx
import { Colors, Spacing } from '@/constants/design-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Href, Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { listFarms } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-storage';

export default function Index() {
  const [isLoading, setIsLoading] = useState(true);
  const [route, setRoute] = useState<Href>('/(auth)/onboarding');

  useEffect(() => {
    const checkAppState = async () => {
      try {
        const [token, hasSeenOnboarding] = await Promise.all([
          getAuthToken(),
          AsyncStorage.getItem('has_completed_onboarding'),
        ]);

        if (token) {
          const userData = await AsyncStorage.getItem('user_data');
          const user = JSON.parse(userData || '{}');

          if (user.role === 'OWNER') {
            const farms = await listFarms();
            setRoute(farms.length === 0 ? '/setup' : '/(tabs)');
          } else {
            setRoute('/(tabs)');
          }
        } else if (hasSeenOnboarding === 'true') {
          setRoute('/(auth)/login');
        } else {
          setRoute('/(auth)/onboarding');
        }
      } catch (error) {
        console.error("Erreur lors de la vérification de l'état :", error);
        setRoute('/(auth)/onboarding');
      } finally {
        setTimeout(() => setIsLoading(false), 1200);
      }
    };

    checkAppState();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.splash}>
        <Image
          source={require('./assets/images/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
      </View>
    );
  }

  return <Redirect href={route} />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: Spacing.stackGap * 2, // 32
  },
  loader: {
    marginTop: Spacing.stackGap, // 16
  },
});