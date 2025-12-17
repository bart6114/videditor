import { useState, useEffect, useCallback, useRef } from 'react'
import { useApi } from '@/lib/api/client'
import type { SocialPlatform } from '@shared/index'

export type UserSettings = {
  defaultCustomPrompt: string | null
  defaultSocialPrompt: string | null
  defaultSocialPlatforms: SocialPlatform[]
  defaultAvoidOverlap: boolean
  defaultPreferredLength: number
  defaultMaxLength: number
  defaultSchedulingPrompt: string | null
}

type UseUserSettingsState = {
  settings: UserSettings | null
  credits: number | null
  loading: boolean
  error: string | null
}

type UseUserSettingsReturn = UseUserSettingsState & {
  refreshCredits: () => Promise<void>
}

export function useUserSettings(): UseUserSettingsReturn {
  const { call } = useApi()
  const [state, setState] = useState<UseUserSettingsState>({
    settings: null,
    credits: null,
    loading: true,
    error: null,
  })

  const isMountedRef = useRef(true)

  const fetchSettings = useCallback(async () => {
    try {
      const [settingsData, creditsData] = await Promise.all([
        call<{ settings: UserSettings }>('/v1/user/settings'),
        call<{ credits: number }>('/v1/billing/credits'),
      ])

      if (isMountedRef.current) {
        setState({
          settings: settingsData.settings,
          credits: creditsData.credits,
          loading: false,
          error: null,
        })
      }
    } catch (err) {
      if (isMountedRef.current) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to fetch settings',
        }))
      }
    }
  }, [call])

  const refreshCredits = useCallback(async () => {
    try {
      const creditsData = await call<{ credits: number }>('/v1/billing/credits')
      if (isMountedRef.current) {
        setState((prev) => ({
          ...prev,
          credits: creditsData.credits,
        }))
      }
    } catch {
      // Silently fail - credits will be refreshed on next full fetch
    }
  }, [call])

  useEffect(() => {
    isMountedRef.current = true
    fetchSettings()

    return () => {
      isMountedRef.current = false
    }
  }, [fetchSettings])

  return {
    ...state,
    refreshCredits,
  }
}
