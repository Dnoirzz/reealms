import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { migrationStatus } from '../../core/constants';
import { palette } from '../../core/theme';
import { useAppState } from '../../logic/AppStateContext';
import { ActionButton } from '../components/ActionButton';

type ProfileScreenProps = {
  authGateMode?: boolean;
};

export function ProfileScreen({ authGateMode = false }: ProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const {
    canEnterMainNavigation,
    currentUser,
    isMemberLoggedIn,
    signIn,
    signInGuest,
    signOut,
    signUp,
    syncFromCloud,
  } = useAppState();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [busyAction, setBusyAction] = React.useState<'signin' | 'signup' | 'guest' | 'sync' | 'signout' | null>(null);
  const [feedback, setFeedback] = React.useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = React.useState<'neutral' | 'danger' | 'success'>('neutral');

  const userLabel = currentUser?.email ?? currentUser?.id ?? 'No active session';
  const isGuest = Boolean(currentUser?.is_anonymous);

  async function runAction(
    action: NonNullable<typeof busyAction>,
    runner: () => Promise<void>,
    successMessage?: string,
  ) {
    setBusyAction(action);
    setFeedback(null);
    try {
      await runner();
      if (successMessage) {
        setFeedback(successMessage);
        setFeedbackTone('success');
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Unknown error');
      setFeedbackTone('danger');
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <ScrollView
        contentContainerStyle={{
          paddingBottom: 36,
          paddingHorizontal: 20,
          paddingTop: insets.top + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBlock}>
          <Text style={styles.title}>{authGateMode && !canEnterMainNavigation ? 'Enter Reealms' : 'Profile & auth'}</Text>
          <Text style={styles.subtitle}>
            {authGateMode && !canEnterMainNavigation
              ? 'Sign in or use guest mode to continue into the Expo rebuild.'
              : 'Supabase auth is wired here first so the rest of the migration can depend on a stable session model.'}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Session</Text>
          <Text style={styles.sessionLabel}>{userLabel}</Text>
          <Text style={styles.sessionMeta}>
            {currentUser
              ? isGuest
                ? 'Guest access is active for the current launch.'
                : 'Member session is active and eligible for sync.'
              : 'No session is active yet.'}
          </Text>

          {feedback ? (
            <Text
              style={[
                styles.feedback,
                feedbackTone === 'danger'
                  ? styles.feedbackDanger
                  : feedbackTone === 'success'
                    ? styles.feedbackSuccess
                    : null,
              ]}
            >
              {feedback}
            </Text>
          ) : null}

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={palette.textMuted}
              selectionColor={palette.accent}
              style={styles.input}
              value={email}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Password</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={palette.textMuted}
              secureTextEntry
              selectionColor={palette.accent}
              style={styles.input}
              value={password}
            />
          </View>

          {!currentUser ? (
            <View style={styles.buttonStack}>
              <ActionButton
                label="Sign in"
                loading={busyAction === 'signin'}
                onPress={() => void runAction('signin', () => signIn(email.trim(), password), 'Signed in.')}
              />
              <ActionButton
                label="Create account"
                loading={busyAction === 'signup'}
                onPress={() => void runAction('signup', () => signUp(email.trim(), password), 'Account created. Check your inbox if confirmation is required.')}
                variant="secondary"
              />
              <ActionButton
                label="Continue as guest"
                loading={busyAction === 'guest'}
                onPress={() => void runAction('guest', () => signInGuest(), 'Guest session opened.')}
                variant="ghost"
              />
            </View>
          ) : (
            <View style={styles.buttonStack}>
              {isMemberLoggedIn ? (
                <ActionButton
                  label="Pull cloud sync"
                  loading={busyAction === 'sync'}
                  onPress={() => void runAction('sync', () => syncFromCloud(), 'Cloud data pulled.')}
                  variant="secondary"
                />
              ) : null}
              <ActionButton
                label={isGuest ? 'Leave guest session' : 'Sign out'}
                loading={busyAction === 'signout'}
                onPress={() => void runAction('signout', () => signOut(), 'Signed out.')}
                variant="ghost"
              />
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Migration status</Text>
          {migrationStatus.map((entry) => (
            <View key={entry} style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>{entry}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerBlock: {
    gap: 8,
    marginBottom: 18,
  },
  title: {
    color: palette.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  card: {
    gap: 16,
    marginBottom: 16,
    padding: 18,
    borderRadius: 26,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  cardTitle: {
    color: palette.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  sessionLabel: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  sessionMeta: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  feedback: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    color: palette.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  feedbackDanger: {
    color: palette.danger,
  },
  feedbackSuccess: {
    color: palette.success,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.backgroundSoft,
    color: palette.textPrimary,
    fontSize: 15,
    paddingHorizontal: 16,
  },
  buttonStack: {
    gap: 12,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: palette.accentCool,
    marginTop: 6,
  },
  statusText: {
    flex: 1,
    color: palette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
});
