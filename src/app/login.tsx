import { router } from 'expo-router';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts } from '@/constants/theme';
import { cloudConfigured } from '@/lib/supabase';
import { sendCode, useAuthStore, verifyCode } from '@/store/auth-store';

const RESEND_SECONDS = 30;

/** Sign in / create account with an emailed one-time code. */
export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const session = useAuthStore((s) => s.session);

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<ComponentRef<typeof TextInput>>(null);

  // Signed in (the code worked): leave this screen.
  useEffect(() => {
    if (!session) return;
    if (router.canGoBack()) router.back();
    else router.replace('/profile');
  }, [session]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());

  const send = async () => {
    if (!validEmail || busy) return;
    setBusy(true);
    setError(null);
    try {
      await sendCode(email);
      setStep('code');
      setCode('');
      setCooldown(RESEND_SECONDS);
      setTimeout(() => codeRef.current?.focus(), 100);
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (code.trim().length < 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await verifyCode(email, code);
    } catch (e) {
      setError(friendly(e));
      setBusy(false);
    }
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/profile'));

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
      <View style={[styles.content, { paddingTop: Platform.OS === 'web' ? 34 : insets.top + 16 }]}>
        <Pressable onPress={close} hitSlop={10} accessibilityRole="button" style={styles.back}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>

        <Text style={styles.label}>Account</Text>
        <Text style={styles.title}>{step === 'email' ? 'Sign in' : 'Check your email'}</Text>
        <Text style={styles.subtitle}>
          {step === 'email'
            ? 'Enter your email and we will send you a code. No password needed, and new accounts are created automatically.'
            : `We sent a code to ${email.trim()}. Enter it below.`}
        </Text>

        {!cloudConfigured && <Text style={styles.error}>Cloud sync is not configured in this build.</Text>}

        {step === 'email' ? (
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={Colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={send}
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            inputMode="email"
            keyboardType="email-address"
            returnKeyType="send"
            autoFocus
          />
        ) : (
          <TextInput
            ref={codeRef}
            style={[styles.input, styles.codeInput]}
            placeholder="123456"
            placeholderTextColor={Colors.textSecondary}
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 8))}
            onSubmitEditing={verify}
            autoComplete="one-time-code"
            inputMode="numeric"
            keyboardType="number-pad"
            maxLength={8}
            returnKeyType="done"
          />
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.button, (busy || (step === 'email' ? !validEmail : code.length < 6)) && styles.buttonDisabled]}
          onPress={step === 'email' ? send : verify}
          disabled={busy || !cloudConfigured}
          accessibilityRole="button">
          {busy ? <ActivityIndicator color={Colors.surface} /> : <Text style={styles.buttonText}>{step === 'email' ? 'Send code' : 'Sign in'}</Text>}
        </Pressable>

        {step === 'code' && (
          <View style={styles.links}>
            <Pressable onPress={send} disabled={cooldown > 0 || busy} accessibilityRole="button">
              <Text style={[styles.link, cooldown > 0 && styles.linkDisabled]}>
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setStep('email');
                setError(null);
              }}
              accessibilityRole="button">
              <Text style={styles.link}>Use a different email</Text>
            </Pressable>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function friendly(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  if (/rate limit|too many|security purposes/i.test(message)) return 'Too many attempts. Please wait a minute and try again.';
  if (/expired|invalid/i.test(message)) return 'That code is wrong or has expired. Check it or request a new one.';
  if (/fetch|network/i.test(message)) return 'No internet connection. Connect and try again.';
  return message;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 20,
    gap: 14,
  },
  back: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  backText: {
    fontFamily: Fonts.regular,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  label: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    color: Colors.textSecondary,
  },
  title: {
    fontFamily: Fonts.bold,
    fontSize: 32,
    color: Colors.text,
  },
  subtitle: {
    fontFamily: Fonts.light,
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: Colors.text,
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
    fontFamily: Fonts.regular,
    fontSize: 18,
    color: Colors.text,
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
  codeInput: {
    textAlign: 'center',
    letterSpacing: 8,
    fontSize: 24,
  },
  error: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.danger,
  },
  button: {
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    fontFamily: Fonts.regular,
    fontSize: 20,
    color: Colors.surface,
  },
  links: {
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  link: {
    fontFamily: Fonts.regular,
    fontSize: 16,
    color: Colors.text,
  },
  linkDisabled: {
    color: Colors.textSecondary,
  },
});
