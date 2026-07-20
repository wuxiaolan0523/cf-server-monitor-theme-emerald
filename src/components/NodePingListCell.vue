<script setup lang="ts">
import type { NodeStatusPing } from '@/utils/rpc'

const props = defineProps<{
  ping?: Record<string, NodeStatusPing>
}>()

const PING_PROVIDERS = [
  { key: 'ct', label: 'CT' },
  { key: 'cu', label: 'CU' },
  { key: 'cm', label: 'CM' },
  { key: 'bd', label: 'BD' },
] as const

function getProviderState(key: string, label: string) {
  const ping = props.ping?.[key]
  const latency = ping?.latest ?? 0
  const loss = ping?.loss ?? 100
  const available = latency > 0 && loss < 100

  return {
    label,
    display: available ? `${Math.round(latency)}ms` : '--',
    toneClass: getPingToneClass(latency, available),
    tooltip: available
      ? `${ping?.name ?? label}: ${Math.round(latency)}ms\n丢包 ${loss.toFixed(1)}%`
      : `${ping?.name ?? label}: 暂无响应`,
  }
}

function getPingToneClass(latency: number, available: boolean): string {
  if (!available)
    return 'text-muted-foreground'
  if (latency <= 100)
    return 'text-emerald-600 dark:text-emerald-400'
  if (latency <= 200)
    return 'text-amber-600 dark:text-amber-400'
  return 'text-rose-600 dark:text-rose-400'
}
</script>

<template>
  <div class="grid min-w-0 w-full grid-cols-4 gap-x-1 text-center">
    <span v-for="provider in PING_PROVIDERS" :key="provider.key" class="flex min-w-0 flex-col">
      <span class="text-[10px] font-medium text-muted-foreground">{{ provider.label }}</span>
      <span
        class="truncate text-[11px] tabular-nums"
        :class="getProviderState(provider.key, provider.label).toneClass"
      >
        {{ getProviderState(provider.key, provider.label).display }}
      </span>
    </span>
  </div>
</template>
