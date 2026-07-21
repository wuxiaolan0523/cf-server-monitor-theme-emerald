import type { EarthViewMode, NodeViewMode, PublicSettings } from '@/utils/api'
import type { ByteDecimalsConfig } from '@/utils/helper'
import { usePreferredDark, useStorageAsync } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

export type ThemeMode = 'auto' | 'light' | 'dark'
type Lang = 'zh-CN' | 'en-US'

/** 固定的字节精度配置 */
const BYTE_DECIMALS: ByteDecimalsConfig = {
  B: 0,
  KB: 0,
  MB: 1,
  GB: 1,
  TB: 2,
}

function isValidThemeMode(value: unknown): value is ThemeMode {
  return value === 'auto' || value === 'light' || value === 'dark'
}

const useAppStore = defineStore('app', () => {
  const loading = ref<boolean>(true)

  // 使用 VueUse 的 useStorageAsync 实现自动持久化
  const themeMode = useStorageAsync<ThemeMode>('themeMode', 'auto', localStorage)
  const lang = ref<Lang>('zh-CN')
  const publicSettings = ref<PublicSettings>()
  const nodeSelectedGroup = useStorageAsync<string>('nodeSelectedGroup', 'all', localStorage)
  const isLoggedIn = ref<boolean>(false)
  const connectionError = ref<boolean>(false)

  // 首页滚动位置记忆
  const homeScrollPosition = ref<number>(0)

  // 使用 null 表示未设置，等待主题配置加载后决定
  const storedViewMode = useStorageAsync<NodeViewMode | null>('nodeViewMode', null, localStorage)

  // 计算属性：从主题配置获取默认视图模式
  const defaultViewMode = computed<NodeViewMode>(() => {
    return publicSettings.value?.themeSettings.defaultViewMode ?? 'card'
  })

  // 校验视图模式是否为合法值
  function isValidViewMode(value: string | null): value is NodeViewMode {
    return value === 'card' || value === 'list'
  }

  // 当前实际使用的视图模式
  const nodeViewMode = computed<NodeViewMode>({
    get: () => {
      // 校验 storedViewMode 是否为合法值，非法值时使用默认值
      if (storedViewMode.value !== null && isValidViewMode(storedViewMode.value)) {
        return storedViewMode.value
      }
      return defaultViewMode.value
    },
    set: (val) => {
      storedViewMode.value = val
    },
  })

  // 字节格式化精度（固定配置）
  const byteDecimals: ByteDecimalsConfig = { ...BYTE_DECIMALS }

  // 计算属性：公告配置
  const alertEnabled = computed<boolean>(() => {
    return publicSettings.value?.themeSettings.alertEnabled ?? false
  })

  const alertTitle = computed<string>(() => {
    return publicSettings.value?.themeSettings.alertTitle ?? ''
  })

  const alertContent = computed<string>(() => {
    return publicSettings.value?.themeSettings.alertContent ?? ''
  })

  const earthViewMode = computed<EarthViewMode>(() => {
    return publicSettings.value?.themeSettings.earthViewMode ?? 'earth'
  })

  const visitorInfoCardEnabled = computed<boolean>(() => {
    return publicSettings.value?.themeSettings.visitorInfoCardEnabled ?? true
  })

  const hideAdminEntryWhenLoggedOut = computed<boolean>(() => {
    return publicSettings.value?.themeSettings.hideAdminEntryWhenLoggedOut ?? false
  })

  const disablePageAnimation = computed<boolean>(() => {
    return publicSettings.value?.themeSettings.disablePageAnimation ?? false
  })

  // 计算属性：ICP 备案配置
  const icpEnabled = computed<boolean>(() => {
    return publicSettings.value?.themeSettings.icpEnabled ?? false
  })

  const icpNumber = computed<string>(() => {
    return publicSettings.value?.themeSettings.icpNumber ?? ''
  })

  const icpUrl = computed<string>(() => {
    return publicSettings.value?.themeSettings.icpUrl || 'https://beian.miit.gov.cn/'
  })

  // 计算属性：公安备案配置
  const policeEnabled = computed<boolean>(() => {
    return publicSettings.value?.themeSettings.policeEnabled ?? false
  })

  const policeNumber = computed<string>(() => {
    return publicSettings.value?.themeSettings.policeNumber ?? ''
  })

  const policeUrl = computed<string>(() => {
    return publicSettings.value?.themeSettings.policeUrl ?? ''
  })

  // 计算属性：自定义背景配置
  const backgroundEnabled = computed<boolean>(() => {
    return publicSettings.value?.themeSettings.backgroundEnabled ?? false
  })

  const backgroundType = computed<'image' | 'video'>(() => {
    return publicSettings.value?.themeSettings.backgroundType ?? 'image'
  })

  const lightBackgroundUrl = computed<string>(() => {
    return publicSettings.value?.themeSettings.lightBackgroundUrl ?? ''
  })

  const darkBackgroundUrl = computed<string>(() => {
    return publicSettings.value?.themeSettings.darkBackgroundUrl ?? ''
  })

  const backgroundBlur = computed<number>(() => {
    return publicSettings.value?.themeSettings.backgroundBlur ?? 0
  })

  const backgroundOverlay = computed<number>(() => {
    return publicSettings.value?.themeSettings.backgroundOverlay ?? 0
  })

  // 当 publicSettings 加载后，如果 localStorage 没有保存过视图模式或值为非法值，使用默认值
  watch(publicSettings, (settings) => {
    if (settings && !isValidViewMode(storedViewMode.value)) {
      // 触发 computed setter，会自动保存到 localStorage
      storedViewMode.value = defaultViewMode.value
    }
  }, { immediate: true })

  // 使用 VueUse 的 usePreferredDark 检测系统主题偏好
  const prefersDark = usePreferredDark()

  watch(themeMode, (mode) => {
    if (!isValidThemeMode(mode)) {
      themeMode.value = 'auto'
    }
  }, { immediate: true })

  // 计算当前是否为暗色模式
  const isDark = computed(() => {
    if (themeMode.value === 'auto') {
      return prefersDark.value
    }
    return themeMode.value === 'dark'
  })

  const resolvedThemeMode = computed<'light' | 'dark'>(() => isDark.value ? 'dark' : 'light')

  // 计算属性：当前主题模式下的背景 URL
  const currentBackgroundUrl = computed<string>(() => {
    if (!backgroundEnabled.value) {
      return ''
    }

    if (resolvedThemeMode.value === 'dark') {
      return darkBackgroundUrl.value
    }
    return lightBackgroundUrl.value
  })

  function updateThemeMode(mode?: ThemeMode) {
    if (mode) {
      themeMode.value = isValidThemeMode(mode) ? mode : 'auto'
      return
    }

    const nextMode: Record<ThemeMode, ThemeMode> = {
      auto: 'light',
      light: 'dark',
      dark: 'auto',
    }

    const currentMode = isValidThemeMode(themeMode.value) ? themeMode.value : 'auto'
    themeMode.value = nextMode[currentMode]
  }

  function updateLoginState(loggedIn: boolean) {
    isLoggedIn.value = loggedIn
  }

  return {
    loading,
    themeMode,
    isDark,
    resolvedThemeMode,
    lang,
    nodeSelectedGroup,
    nodeViewMode,
    defaultViewMode,
    byteDecimals,
    alertEnabled,
    alertTitle,
    alertContent,
    earthViewMode,
    visitorInfoCardEnabled,
    hideAdminEntryWhenLoggedOut,
    disablePageAnimation,
    icpEnabled,
    icpNumber,
    icpUrl,
    policeEnabled,
    policeNumber,
    policeUrl,
    backgroundEnabled,
    backgroundType,
    lightBackgroundUrl,
    darkBackgroundUrl,
    currentBackgroundUrl,
    backgroundBlur,
    backgroundOverlay,
    isLoggedIn,
    publicSettings,
    connectionError,
    homeScrollPosition,
    updateThemeMode,
    updateLoginState,
  }
})

export { useAppStore }
