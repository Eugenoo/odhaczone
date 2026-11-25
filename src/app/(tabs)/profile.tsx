import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Screen, SectionTitle } from '@/components/screen';
import { Colors, Fonts } from '@/constants/theme';
import { confirm, notify } from '@/lib/confirm';
import { cloudConfigured } from '@/lib/supabase';
import { useSyncStatus } from '@/lib/sync';
import { deleteAccount, signOut, useAuthStore } from '@/store/auth-store';
import { useTodoStore } from '@/store/todo-store';

const comingSoon = (feature: string) => () =>
  notify(feature, 'Coming soon — accounts and settings arrive with cloud sync.');

/** "Profile" frame: account (email-code sign in, cloud sync) plus a few settings. */
export default function ProfileScreen() {
  const resetAll = useTodoStore((s) => s.resetAll);
  const session = useAuthStore((s) => s.session);

  const onLogout = async () => {
    if (await confirm('Log out?', 'Your tasks stay safe in your account. This device will be cleared.', 'Log out')) {
      await signOut();
    }
  };

  const onDeleteAccount = async () => {
    if (!session) {
      if (await confirm('Delete all data?', 'All lists and tasks on this device will be reset.', 'Delete')) resetAll();
      return;
    }
    if (
      await confirm('Delete account?', 'Your account and all your lists and tasks will be permanently deleted. This cannot be undone.', 'Delete')
    ) {
      try {
        await deleteAccount();
      } catch (e) {
        notify('Could not delete account', e instanceof Error ? e.message : 'Please try again.');
      }
    }
  };

  return (
    <Screen label="Profile" title="Your Account" contentGap={20}>
      <UserRow />

      <View style={styles.section}>
        <SectionTitle>Preferences</SectionTitle>
        <Item label="Appearance" onPress={comingSoon('Appearance')} />
        <Item label="Notifications" onPress={comingSoon('Notifications')} />
      </View>

      <View style={styles.section}>
        <SectionTitle>Account</SectionTitle>
        {session ? (
          <Item label="Log out" onPress={onLogout} />
        ) : cloudConfigured ? (
          <Item label="Sign in to sync your tasks" onPress={() => router.push('/login')} />
        ) : null}
        <Item label={session ? 'Delete account' : 'Delete all data'} danger onPress={onDeleteAccount} />
      </View>
    </Screen>
  );
}

/** "Component 1" from Figma: avatar, name, subtitle and an edit action. */
function UserRow() {
  const profileName = useTodoStore((s) => s.profileName);
  const session = useAuthStore((s) => s.session);
  const sync = useSyncStatus();
  const setProfileName = useTodoStore((s) => s.setProfileName);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profileName);

  const save = () => {
    if (draft.trim()) setProfileName(draft.trim());
    setEditing(false);
  };

  return (
    <View style={styles.user}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{profileName.trim().charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.userText}>
        {editing ? (
          <TextInput
            style={[styles.userName, styles.nameInput]}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={save}
            onBlur={save}
            returnKeyType="done"
            autoFocus
          />
        ) : (
          <Text style={styles.userName} numberOfLines={1}>
            {profileName}
          </Text>
        )}
        <Text style={styles.userEmail} numberOfLines={1}>
          {session?.user.email ?? 'Saved on this device only'}
        </Text>
        {session && <Text style={styles.syncText}>{syncLabel(sync.status, sync.lastSyncedAt, sync.error)}</Text>}
      </View>
      <Pressable
        onPress={() => {
          if (editing) return save();
          setDraft(profileName);
          setEditing(true);
        }}
        hitSlop={8}
        accessibilityRole="button">
        <Text style={styles.edit}>{editing ? 'done' : 'edit'}</Text>
      </Pressable>
    </View>
  );
}

function syncLabel(status: string, lastSyncedAt: number | null, error: string | null) {
  if (status === 'syncing') return 'Syncing…';
  if (status === 'offline') return 'Offline. Changes will sync when you are back online.';
  if (status === 'error') return `Sync problem: ${error ?? 'unknown error'}`;
  return lastSyncedAt ? 'All changes synced' : 'Sync ready';
}

function Item({ label, danger, onPress }: { label: string; danger?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.item}>
      <Text style={[styles.itemText, danger && styles.danger]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  user: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 24,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    color: Colors.surface,
  },
  userText: {
    flex: 1,
    gap: 4,
  },
  userName: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: Colors.text,
  },
  nameInput: {
    padding: 0,
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
  userEmail: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.text,
  },
  syncText: {
    fontFamily: Fonts.light,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  edit: {
    fontFamily: Fonts.regular,
    fontSize: 16,
    color: Colors.text,
  },
  section: {
    marginBottom: 18,
  },
  item: {
    paddingTop: 13,
    paddingBottom: 5,
  },
  itemText: {
    fontFamily: Fonts.regular,
    fontSize: 16,
    color: Colors.text,
  },
  danger: {
    color: Colors.danger,
  },
});
