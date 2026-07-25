import { computeDistanceKm, groupServicesByCategory, summarizeSelection } from '@instahealth/core'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'

import { BranchErrorState } from '../../../components/branch/BranchErrorState'
import { BranchInfoHeader } from '../../../components/branch/BranchInfoHeader'
import { BranchPhotoHeader } from '../../../components/branch/BranchPhotoHeader'
import { BranchProfileSkeleton } from '../../../components/branch/BranchProfileSkeleton'
import { PreparationStrip } from '../../../components/branch/PreparationStrip'
import { ServicesSection } from '../../../components/branch/ServicesSection'
import { SlotsPreviewStrip } from '../../../components/branch/SlotsPreviewStrip'
import { StickyBookingBar } from '../../../components/branch/StickyBookingBar'
import { getPreparationStrip } from '../../../features/branch/prep'
import { useBranchProfile, useBranchSlotsPreview } from '../../../features/branch/queries'
import { useBookingStore } from '../../../features/booking/store'
import { useUserLocation } from '../../../features/home/useUserLocation'

// F04 — Branch profile & service selection, built to the approved
// branch-profile mockup. Deep-linkable via instahealth://branch/<id>.
// Tab bar stays visible (DECISION-navigation-safe-areas §1: browsing is a
// destination); the sticky CTA sits above it.
export default function BranchProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')

  const branchQuery = useBranchProfile(id)
  const slotsQuery = useBranchSlotsPreview(id)
  const { location } = useUserLocation()

  const branch = branchQuery.data ?? null
  const openBranch = useBookingStore((state) => state.openBranch)
  const selectedServices = useBookingStore((state) => state.selectedServices)
  const toggleService = useBookingStore((state) => state.toggleService)

  // Register the branch in the booking store — resets any selection carried
  // over from a DIFFERENT branch (spec: keep only within the same branch).
  useEffect(() => {
    if (branch) openBranch(branch.id, branch.nameAr)
  }, [branch, openBranch])

  const groups = useMemo(() => (branch ? groupServicesByCategory(branch.services) : []), [branch])
  const selectedServiceIds = useMemo(
    () => new Set(selectedServices.map((service) => service.id)),
    [selectedServices],
  )
  const summary = useMemo(() => summarizeSelection(selectedServices), [selectedServices])
  const prepStrip = useMemo(() => getPreparationStrip(selectedServices), [selectedServices])

  const now = new Date()
  const distanceKm =
    location.coords && branch && branch.lat !== null && branch.lng !== null
      ? computeDistanceKm(location.coords, { lat: branch.lat, lng: branch.lng })
      : null

  if (branchQuery.isPending) {
    return (
      <View className="flex-1 bg-ih-neutral-50">
        <BranchProfileSkeleton />
      </View>
    )
  }

  if (branchQuery.isError || branch === null) {
    return (
      <View className="flex-1 bg-ih-neutral-50">
        <BranchErrorState
          isNotFound={!branchQuery.isError}
          onRetry={() => void branchQuery.refetch()}
        />
      </View>
    )
  }

  return (
    <View className="flex-1 bg-ih-neutral-50">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }}>
        <BranchPhotoHeader
          photos={branch.photos}
          isHospital={branch.categorySlugs.includes('scans')}
        />
        <BranchInfoHeader branch={branch} distanceKm={distanceKm} now={now} />
        <View className="gap-4 px-5 pb-6 pt-4">
          <SlotsPreviewStrip slots={slotsQuery.data} isLoading={slotsQuery.isPending} now={now} />
          {prepStrip !== null ? <PreparationStrip prep={prepStrip} /> : null}
          <ServicesSection
            groups={groups}
            selectedServiceIds={selectedServiceIds}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onToggleService={toggleService}
          />
          {summary.count === 0 && branch.services.length > 0 ? (
            <Text className="text-center font-arabic text-[13px] text-ih-neutral-500">
              اختر خدمة واحدة على الأقل للمتابعة
            </Text>
          ) : null}
        </View>
      </ScrollView>
      <StickyBookingBar summary={summary} onBook={() => router.push('/(app)/booking/slot')} />
    </View>
  )
}
