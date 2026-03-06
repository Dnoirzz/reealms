import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gradients, palette } from '../../core/theme';
import { useAppState } from '../../logic/AppStateContext';
import { ActionButton } from '../components/ActionButton';

type ProfileScreenProps = {
  authGateMode?: boolean;
};

type BusyAction = 'signin' | 'signup' | 'guest' | 'sync' | 'signout' | null;

export function ProfileScreen({ authGateMode = false }: ProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const {
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
  const [isLogin, setIsLogin] = React.useState(true);
  const [busyAction, setBusyAction] = React.useState<BusyAction>(null);
  const [feedback, setFeedback] = React.useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = React.useState<'danger' | 'success' | null>(null);

  const isGuest = Boolean(currentUser?.is_anonymous);
  const isAuthBusy = busyAction === 'signin' || busyAction === 'signup';

  async function runAction(
    action: Exclude<BusyAction, null>,
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
      setFeedback(error instanceof Error ? error.message : 'Terjadi kesalahan.');
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
      <LinearGradient
        colors={currentUser ? gradients.shellBackdrop : ['#0F133D', '#0B0E2F', '#060717', '#02020A']}
        end={{ x: 1, y: 1 }}
        locations={currentUser ? undefined : [0, 0.36, 0.74, 1]}
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      {!currentUser ? (
        <LinearGradient
          colors={['rgba(128, 116, 255, 0.20)', 'rgba(58, 66, 146, 0.08)', 'rgba(0, 0, 0, 0.78)']}
          end={{ x: 0.84, y: 1 }}
          locations={[0, 0.4, 1]}
          start={{ x: 0.12, y: 0.12 }}
          style={styles.authGlowOverlay}
        />
      ) : null}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          !currentUser ? styles.authScrollContent : null,
          {
            paddingBottom: currentUser ? 30 : Math.max(insets.bottom + 26, 30),
            paddingTop: currentUser ? insets.top + 14 : insets.top + (authGateMode ? 186 : 108),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {currentUser ? (
          <View style={styles.section}>
            <View style={styles.avatarWrap}>
              <View style={styles.avatar}>
                <Ionicons color={palette.textPrimary} name="person" size={46} />
              </View>
            </View>
            <Text style={styles.profileName}>{currentUser.email || 'Pengguna'}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{isGuest ? 'Akun Tamu' : 'Member Premium'}</Text>
            </View>

            {feedback ? (
              <Text style={[styles.feedback, feedbackTone === 'danger' ? styles.feedbackDanger : styles.feedbackSuccess]}>
                {feedback}
              </Text>
            ) : null}

            {isMemberLoggedIn ? (
              <ActionButton
                label="Sinkronkan Cloud"
                loading={busyAction === 'sync'}
                onPress={() => void runAction('sync', () => syncFromCloud(), 'Sinkronisasi selesai.')}
                variant="secondary"
              />
            ) : null}

            <View style={styles.optionList}>
              <ProfileOption icon="settings-outline" label="Pengaturan" />
              <ProfileOption icon="help-circle-outline" label="Bantuan & Dukungan" />
              <ProfileOption icon="information-circle-outline" label="Tentang Reealms" />
            </View>

            <ActionButton
              label={isGuest ? 'Keluar dari Akun Tamu' : 'Keluar'}
              loading={busyAction === 'signout'}
              onPress={() => void runAction('signout', () => signOut(), 'Berhasil keluar.')}
              variant="ghost"
            />
          </View>
        ) : (
          <View style={[styles.section, styles.authSection]}>
            <Text style={styles.authTitle}>
              {isLogin ? 'Selamat Datang' : 'Daftar Akun'}
            </Text>
            <Text numberOfLines={1} style={styles.authSubtitle}>
              {isLogin
                ? 'Masuk untuk sinkronisasi riwayat dan favorit Anda.'
                : 'Buat akun untuk menikmati fitur personalisasi.'}
            </Text>

            {feedback ? (
              <Text style={[styles.authFeedback, feedbackTone === 'danger' ? styles.feedbackDanger : styles.feedbackSuccess]}>
                {feedback}
              </Text>
            ) : null}

            <View style={styles.authInputGroup}>
              <AuthInputRow
                icon="mail-outline"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="Alamat Email"
                value={email}
              />
              <AuthInputRow
                icon="lock-closed-outline"
                onChangeText={setPassword}
                placeholder="Kata Sandi"
                secureTextEntry
                value={password}
              />
            </View>

            <PrimaryAuthButton
              label={isLogin ? 'Masuk Sekarang' : 'Daftar Sekarang'}
              loading={isAuthBusy}
              onPress={() =>
                void runAction(
                  isLogin ? 'signin' : 'signup',
                  () => (isLogin ? signIn(email.trim(), password) : signUp(email.trim(), password)),
                  isLogin ? 'Berhasil masuk.' : 'Akun berhasil dibuat.',
                )
              }
            />

            <Pressable
              onPress={() => setIsLogin((previous) => !previous)}
              style={({ pressed }) => [styles.switchButton, pressed ? styles.switchButtonPressed : null]}
            >
              <Text style={styles.switchText}>
                {isLogin ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}
              </Text>
            </Pressable>

            <View style={styles.separatorRow}>
              <View style={styles.separatorLine} />
              <Text style={styles.separatorText}>Atau</Text>
              <View style={styles.separatorLine} />
            </View>

            <OutlineAuthButton
              label="Lanjutkan Sebagai Tamu"
              loading={busyAction === 'guest'}
              onPress={() => void runAction('guest', () => signInGuest(), 'Masuk sebagai tamu.')}
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ProfileOption({
  icon,
  label,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
}) {
  return (
    <Pressable style={styles.optionRow}>
      <Ionicons color={palette.textSecondary} name={icon} size={20} />
      <Text style={styles.optionText}>{label}</Text>
      <Ionicons color={palette.textFaint} name="chevron-forward" size={16} />
    </Pressable>
  );
}

type AuthInputRowProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: React.ComponentProps<typeof TextInput>['keyboardType'];
};

function AuthInputRow({
  icon,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = 'default',
}: AuthInputRowProps) {
  return (
    <View style={styles.authInputRow}>
      <Ionicons color="rgba(255, 255, 255, 0.5)" name={icon} size={20} />
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255, 255, 255, 0.56)"
        secureTextEntry={secureTextEntry}
        selectionColor={palette.accentStrong}
        style={styles.authInput}
        value={value}
      />
    </View>
  );
}

type AuthButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
};

function PrimaryAuthButton({ label, onPress, loading = false }: AuthButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.authPrimaryButton,
        loading ? styles.authButtonDisabled : null,
        pressed && !loading ? styles.authButtonPressed : null,
      ]}
    >
      <LinearGradient
        colors={['#726BFC', '#6660F3']}
        end={{ x: 1, y: 0.3 }}
        start={{ x: 0, y: 0.7 }}
        style={styles.authPrimaryGradient}
      >
        {loading ? (
          <ActivityIndicator color={palette.textPrimary} size="small" />
        ) : (
          <Text style={styles.authPrimaryLabel}>{label}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

function OutlineAuthButton({ label, onPress, loading = false }: AuthButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.authOutlineButton,
        loading ? styles.authButtonDisabled : null,
        pressed && !loading ? styles.authButtonPressed : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.textSecondary} size="small" />
      ) : (
        <Text style={styles.authOutlineLabel}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.background,
  },
  authGlowOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  scrollContent: {
    paddingHorizontal: 36,
  },
  authScrollContent: {
    flexGrow: 1,
  },
  section: {
    gap: 16,
  },
  authSection: {
    gap: 20,
  },
  authTitle: {
    color: palette.textPrimary,
    fontSize: 42,
    lineHeight: 50,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  authSubtitle: {
    color: 'rgba(255, 255, 255, 0.62)',
    fontSize: 15,
    lineHeight: 22,
    marginTop: -2,
    marginBottom: 12,
  },
  authInputGroup: {
    gap: 12,
  },
  authInputRow: {
    minHeight: 62,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(56, 59, 108, 0.42)',
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  authInput: {
    flex: 1,
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    paddingVertical: 0,
  },
  authPrimaryButton: {
    minHeight: 62,
    borderRadius: 15,
    overflow: 'hidden',
  },
  authPrimaryGradient: {
    flex: 1,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authPrimaryLabel: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  authOutlineButton: {
    minHeight: 60,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authOutlineLabel: {
    color: 'rgba(255, 255, 255, 0.82)',
    fontSize: 15,
    fontWeight: '500',
  },
  authButtonDisabled: {
    opacity: 0.65,
  },
  authButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.995 }],
  },
  switchButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchButtonPressed: {
    opacity: 0.82,
  },
  switchText: {
    color: '#706CFF',
    fontSize: 15,
    fontWeight: '600',
  },
  separatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    marginBottom: 2,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.13)',
  },
  separatorText: {
    color: 'rgba(255, 255, 255, 0.36)',
    fontSize: 14,
  },
  authFeedback: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    lineHeight: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  feedback: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    lineHeight: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  feedbackDanger: {
    color: palette.danger,
  },
  feedbackSuccess: {
    color: palette.success,
  },
  avatarWrap: {
    alignItems: 'center',
    marginTop: 14,
  },
  avatar: {
    width: 106,
    height: 106,
    borderRadius: 53,
    borderWidth: 2,
    borderColor: palette.accent,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    color: palette.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  roleBadge: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(108, 92, 231, 0.2)',
  },
  roleBadgeText: {
    color: palette.accentStrong,
    fontSize: 12,
    fontWeight: '700',
  },
  optionList: {
    gap: 10,
  },
  optionRow: {
    minHeight: 54,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionText: {
    flex: 1,
    color: palette.textPrimary,
    fontSize: 14,
  },
});
