import { formatEgyptianPhoneDisplay, PATIENT_SUPPORT } from '@instahealth/core'
import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Linking, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ConfirmSheet } from '../../components/profile/ConfirmSheet'
import { performLogout } from '../../features/auth/logout'
import { useAuthStore } from '../../features/auth/store'

// PROF-01 — the حسابي tab (SPEC-PROF-01: no design bundle BY INSTRUCTION —
// composed strictly from existing anatomies: the dashboard's sectioned-card
// idiom as mobile rows, the branch-profile list rows, the F01 name screen for
// editing). Deliberately thin; the substance is account deletion.

function Row({
  icon,
  label,
  hint,
  disabled,
  destructive,
  onPress,
  testID,
}: {
  icon: string
  label: string
  hint?: string
  disabled?: boolean
  destructive?: boolean
  onPress?: () => void
  testID: string
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled === true }}
      disabled={disabled === true || onPress === undefined}
      onPress={onPress}
      className="min-h-[52px] flex-row items-center gap-3 border-b border-ih-neutral-100 bg-ih-neutral-0 px-4"
      style={disabled === true ? { opacity: 0.5 } : undefined}
    >
      <Text className="text-lg">{icon}</Text>
      <Text
        className={`flex-1 font-arabic-semibold text-[15px] ${
          destructive === true ? 'text-ih-error' : 'text-ih-neutral-800'
        }`}
      >
        {label}
      </Text>
      {hint !== undefined ? (
        <Text className="font-arabic text-xs text-ih-neutral-500">{hint}</Text>
      ) : null}
      {onPress !== undefined && disabled !== true ? (
        <Text className="text-xs text-ih-neutral-400">‹</Text>
      ) : null}
    </Pressable>
  )
}

export default function Profile() {
  const router = useRouter()
  const profile = useAuthStore((state) => state.profile)
  const [confirmingLogout, setConfirmingLogout] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const phoneDisplay = profile !== null ? formatEgyptianPhoneDisplay(profile.phone) : ''
  const appVersion = Constants.expoConfig?.version ?? null

  const hasSupport =
    PATIENT_SUPPORT.whatsapp !== null ||
    PATIENT_SUPPORT.phone !== null ||
    PATIENT_SUPPORT.email !== null

  const openSupport = () => {
    // Prefer WhatsApp, then a call, then email — first configured wins.
    if (PATIENT_SUPPORT.whatsapp !== null) {
      void Linking.openURL(`https://wa.me/${PATIENT_SUPPORT.whatsapp.replace(/\D/g, '')}`)
    } else if (PATIENT_SUPPORT.phone !== null) {
      void Linking.openURL(`tel:${PATIENT_SUPPORT.phone}`)
    } else if (PATIENT_SUPPORT.email !== null) {
      void Linking.openURL(`mailto:${PATIENT_SUPPORT.email}`)
    }
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)
    await performLogout()
    // The (auth) guard takes over once the session clears — no navigation here.
  }

  return (
    <SafeAreaView className="flex-1 bg-ih-neutral-50" edges={['top']}>
      <View className="border-b border-ih-neutral-200 bg-ih-neutral-0 px-5 pb-3.5 pt-2">
        <Text className="font-arabic-bold text-[22px] text-ih-neutral-800">حسابي</Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="gap-5 px-5 py-4">
        {/* identity card — name (tap to edit) + read-only phone */}
        <Pressable
          testID="profile-identity"
          accessibilityRole="button"
          accessibilityLabel="تعديل الاسم"
          onPress={() => router.push('/(app)/edit-name')}
          className="flex-row items-center gap-3.5 rounded-ih-md border border-ih-neutral-200 bg-ih-neutral-0 p-4"
        >
          <View className="h-12 w-12 items-center justify-center rounded-ih-full bg-ih-primary-50">
            <Text className="font-arabic-bold text-lg text-ih-primary-700">
              {(profile?.name_ar ?? '؟').trim().charAt(0)}
            </Text>
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="font-arabic-bold text-base text-ih-neutral-800" numberOfLines={1}>
              {profile?.name_ar ?? '—'}
            </Text>
            <Text className="font-arabic text-[13px] text-ih-neutral-500">{phoneDisplay}</Text>
          </View>
          <Text className="font-arabic-semibold text-[13px] text-ih-primary-600">تعديل</Text>
        </Pressable>

        {/* settings rows */}
        <View className="overflow-hidden rounded-ih-md border border-ih-neutral-200">
          <Row icon="🌐" label="اللغة" hint="قريباً" disabled testID="profile-language" />
          {hasSupport ? (
            <Row icon="💬" label="تواصل معنا" onPress={openSupport} testID="profile-support" />
          ) : null}
          <Row
            icon="ℹ️"
            label="عن التطبيق"
            hint={appVersion !== null ? `الإصدار ${appVersion}` : undefined}
            testID="profile-about"
          />
          <Row icon="📄" label="الشروط والأحكام" hint="قريباً" disabled testID="profile-terms" />
          <Row icon="🔒" label="سياسة الخصوصية" hint="قريباً" disabled testID="profile-privacy" />
        </View>

        {/* session + account */}
        <View className="overflow-hidden rounded-ih-md border border-ih-neutral-200">
          <Row
            icon="🚪"
            label="تسجيل الخروج"
            onPress={() => setConfirmingLogout(true)}
            testID="profile-logout"
          />
          <Row
            icon="🗑️"
            label="حذف الحساب"
            destructive
            onPress={() => router.push('/(app)/delete-account')}
            testID="profile-delete"
          />
        </View>
      </ScrollView>

      <ConfirmSheet
        visible={confirmingLogout}
        title="تسجيل الخروج؟"
        body="يمكنك العودة في أي وقت برقم هاتفك."
        safeLabel="البقاء"
        destructiveLabel="تسجيل الخروج"
        isBusy={isLoggingOut}
        onSafe={() => setConfirmingLogout(false)}
        onDestructive={() => void handleLogout()}
        testId="logout-sheet"
      />
    </SafeAreaView>
  )
}
