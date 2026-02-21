import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shadows, tokens } from '../../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

export function SplashScreen({ navigation }: Props) {
  const didNavigate = useRef(false);
  const insets = useSafeAreaInsets();
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(16)).current;
  const scale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: tokens.motion.slow,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(rise, {
        toValue: 0,
        duration: tokens.motion.slow,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: tokens.motion.slow,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      if (didNavigate.current) return;
      didNavigate.current = true;
      navigation.replace('MainTabs');
    }, 2200);

    return () => clearTimeout(timer);
  }, [navigation]);

  function goToHome() {
    if (didNavigate.current) return;
    didNavigate.current = true;
    navigation.replace('MainTabs');
  }

  return (
    <View style={styles.container}>
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />
      <Animated.View
        style={[
          styles.content,
          {
            paddingTop: Math.max(insets.top + tokens.spacing.xxl, 56),
            paddingBottom: Math.max(insets.bottom + tokens.spacing.xl, 34),
            opacity: fade,
            transform: [{ translateY: rise }, { scale }],
          },
        ]}
      >
        <View style={styles.heroCard}>
          <Image source={require('../../../assets/splash.png')} style={styles.image} resizeMode="cover" />
        </View>

        <Text style={styles.eyebrow}>Wallet-Native Commerce</Text>
        <Text style={styles.title}>GoldBack Mobile</Text>
        <Text style={styles.subtitle}>Purchase physical GoldBacks with a clean wallet-first checkout flow.</Text>
        <Text style={styles.microcopy}>SOL direct checkout • secure auth • order recovery built in</Text>

        <Pressable style={styles.button} onPress={goToHome} android_ripple={{ color: '#ffffff30' }}>
          <Text style={styles.buttonText}>Enter Dashboard</Text>
        </Pressable>

        <Text style={styles.secondaryAction}>Opens automatically in a moment</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bgBase,
  },
  content: {
    flex: 1,
    paddingHorizontal: tokens.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowTop: {
    position: 'absolute',
    top: -80,
    right: -20,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: '#f7e7bc',
    opacity: 0.45,
  },
  glowBottom: {
    position: 'absolute',
    bottom: -120,
    left: -40,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: '#dfe8ff',
    opacity: 0.4,
  },
  heroCard: {
    width: 286,
    height: 286,
    borderRadius: 38,
    overflow: 'hidden',
    marginBottom: tokens.spacing.xl,
    borderWidth: 1,
    borderColor: '#ffffff80',
    ...shadows.floating,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  eyebrow: {
    fontSize: 11,
    color: tokens.colors.textTertiary,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: tokens.spacing.sm,
  },
  title: {
    fontSize: 34,
    fontWeight: '600',
    color: tokens.colors.textPrimary,
    letterSpacing: 0,
    marginBottom: tokens.spacing.sm,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: tokens.colors.textSecondary,
    marginBottom: tokens.spacing.sm,
    maxWidth: 320,
  },
  microcopy: {
    fontSize: 12,
    color: tokens.colors.textTertiary,
    marginBottom: tokens.spacing.xl,
  },
  button: {
    width: '100%',
    maxWidth: 300,
    backgroundColor: tokens.colors.accentDark,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: tokens.radius.pill,
    alignItems: 'center',
    ...shadows.soft,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0,
  },
  secondaryAction: {
    marginTop: tokens.spacing.md,
    fontSize: tokens.typography.caption,
    color: tokens.colors.textTertiary,
  },
});
