<script setup lang="ts">
import type { COBEOptions, Globe, Marker } from 'cobe'
import type { NodeData } from '@/stores/nodes'
import { useDocumentVisibility, useElementSize, useElementVisibility, useRafFn } from '@vueuse/core'
import createGlobe from 'cobe'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import { getCoordByCode, getCountryCodeFromRegion } from '@/utils/geoHelper'

const props = defineProps<{
  nodes?: NodeData[]
}>()

interface RegionCluster {
  code: string
  coord: [number, number]
  servers: number
  onlineServers: number
}

const appStore = useAppStore()
const nodesStore = useNodesStore()
const displayNodes = computed(() => props.nodes ?? nodesStore.earthNodes)

const containerRef = ref<HTMLDivElement>()
const canvasRef = ref<HTMLCanvasElement>()
const { width: containerWidth, height: containerHeight } = useElementSize(containerRef)
const documentVisibility = useDocumentVisibility()
const elementVisibility = useElementVisibility(containerRef)
const shouldRender = computed(() => documentVisibility.value === 'visible' && elementVisibility.value)
const shouldAutoRotate = computed(() => appStore.earthViewMode === 'earth')

const MIN_THETA = -0.65
const MAX_THETA = 0.65
const CHINA_COORD = getCoordByCode('CN') ?? [35.8617, 104.1954]
const DEFAULT_PHI = normalizePhi(-Math.PI / 2 - CHINA_COORD[1] * Math.PI / 180)
const INITIAL_THETA = 0.22

let globe: Globe | null = null
let phi = DEFAULT_PHI
let targetPhi = phi
let theta = INITIAL_THETA
let targetTheta = theta
let isPointerDown = false
let lastPointerX = 0
let lastPointerY = 0

function normalizePhi(value: number): number {
  const circle = Math.PI * 2
  let next = value % circle
  if (next <= -Math.PI)
    next += circle
  if (next > Math.PI)
    next -= circle
  return next
}

function clampTheta(value: number): number {
  return Math.min(Math.max(value, MIN_THETA), MAX_THETA)
}

function getCappedDpr(): number {
  return typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2)
}

function getRenderSize(): { width: number, height: number } {
  const width = containerWidth.value || canvasRef.value?.clientWidth || 320
  const height = containerHeight.value || canvasRef.value?.clientHeight || width
  return { width, height }
}

const regionClusters = computed<RegionCluster[]>(() => {
  const clusters = new Map<string, RegionCluster>()
  for (const node of displayNodes.value) {
    const code = getCountryCodeFromRegion(node.region)
    if (!code)
      continue
    const coord = getCoordByCode(code)
    if (!coord)
      continue

    const cluster = clusters.get(code) ?? { code, coord, servers: 0, onlineServers: 0 }
    cluster.servers += 1
    if (node.online)
      cluster.onlineServers += 1
    clusters.set(code, cluster)
  }
  return [...clusters.values()].sort((a, b) => b.servers - a.servers)
})

const markers = computed<Marker[]>(() => regionClusters.value.map(cluster => ({
  location: cluster.coord,
  size: Math.min(0.11, 0.035 + cluster.servers * 0.012),
})))

const themeColors = computed(() => appStore.isDark
  ? {
      dark: 1,
      mapBrightness: 4,
      baseColor: [0.32, 0.33, 0.4] as [number, number, number],
      markerColor: [0.4, 0.7, 1] as [number, number, number],
      glowColor: [0.2, 0.25, 0.45] as [number, number, number],
    }
  : {
      dark: 0,
      mapBrightness: 6,
      baseColor: [1, 1, 1] as [number, number, number],
      markerColor: [0.06, 0.55, 0.4] as [number, number, number],
      glowColor: [1, 1, 1] as [number, number, number],
    })

function buildOptions(): COBEOptions {
  const colors = themeColors.value
  const { width, height } = getRenderSize()
  return {
    devicePixelRatio: getCappedDpr(),
    width,
    height,
    phi,
    theta,
    dark: colors.dark,
    diffuse: 1.2,
    mapSamples: 10000,
    mapBrightness: colors.mapBrightness,
    baseColor: colors.baseColor,
    markerColor: colors.markerColor,
    glowColor: colors.glowColor,
    markers: markers.value,
  }
}

function updateGlobe(): void {
  if (!globe)
    return
  const { width, height } = getRenderSize()
  globe.update({ width, height, phi, theta })
}

function resetStoppedView(): void {
  phi = DEFAULT_PHI
  targetPhi = DEFAULT_PHI
  theta = INITIAL_THETA
  targetTheta = INITIAL_THETA
}

const { pause: pauseRaf, resume: resumeRaf } = useRafFn(() => {
  if (!globe)
    return
  if (!isPointerDown && shouldAutoRotate.value)
    targetPhi += 0.0025

  phi += (targetPhi - phi)
  theta += (targetTheta - theta)
  updateGlobe()
}, { immediate: false })

function syncRafState(): void {
  if (!globe)
    return
  if (shouldRender.value && (shouldAutoRotate.value || isPointerDown)) {
    resumeRaf()
    return
  }
  pauseRaf()
  if (shouldRender.value)
    updateGlobe()
}

function startGlobe(): void {
  if (!canvasRef.value)
    return
  if (appStore.earthViewMode === 'earth-stop')
    resetStoppedView()
  globe = createGlobe(canvasRef.value, buildOptions())
  requestAnimationFrame(updateGlobe)
  syncRafState()
}

function stopGlobe(): void {
  pauseRaf()
  globe?.destroy()
  globe = null

  // Cobe creates a wrapper around the canvas which it does not remove on destroy.
  if (canvasRef.value && containerRef.value) {
    const wrapper = canvasRef.value.parentElement
    if (wrapper && wrapper !== containerRef.value) {
      containerRef.value.appendChild(canvasRef.value)
      wrapper.remove()
    }
  }
}

function rebuildGlobe(): void {
  stopGlobe()
  startGlobe()
}

function onPointerDown(event: PointerEvent): void {
  isPointerDown = true
  lastPointerX = event.clientX
  lastPointerY = event.clientY
  const target = event.currentTarget as HTMLElement
  target.setPointerCapture(event.pointerId)
  syncRafState()
}

function onPointerMove(event: PointerEvent): void {
  if (!isPointerDown)
    return
  targetPhi += (event.clientX - lastPointerX) / 200
  targetTheta = clampTheta(targetTheta + (event.clientY - lastPointerY) / 300)
  lastPointerX = event.clientX
  lastPointerY = event.clientY
}

function onPointerUp(event: PointerEvent): void {
  isPointerDown = false
  const target = event.currentTarget as HTMLElement
  if (target.hasPointerCapture(event.pointerId))
    target.releasePointerCapture(event.pointerId)
  syncRafState()
}

const totalServers = computed(() => displayNodes.value.length)
const onlineServers = computed(() => displayNodes.value.filter(node => node.online).length)
const offlineServers = computed(() => totalServers.value - onlineServers.value)

onMounted(async () => {
  await nextTick()
  startGlobe()
})

onBeforeUnmount(stopGlobe)

watch(() => appStore.isDark, rebuildGlobe)

watch([containerWidth, containerHeight], ([width, height]) => {
  if (globe && width > 0 && height > 0)
    updateGlobe()
})

watch(() => appStore.earthViewMode, (mode) => {
  if (mode === 'earth-stop')
    resetStoppedView()
  syncRafState()
})

watch(
  () => regionClusters.value.map(cluster => `${cluster.code}:${cluster.servers}:${cluster.onlineServers}`).join(','),
  () => {
    globe?.update({ markers: markers.value })
  },
)

watch(shouldRender, syncRafState)
</script>

<template>
  <div ref="containerRef" class="relative mx-auto aspect-square w-full max-w-md -translate-y-6 md:-translate-y-12">
    <canvas
      ref="canvasRef"
      class="absolute inset-0 size-full touch-none cursor-grab select-none active:cursor-grabbing"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    />

    <div
      v-if="totalServers > 0"
      class="pointer-events-none absolute top-6 left-0 flex items-center gap-2 rounded bg-background/60 px-2 py-0.5 text-[10px] text-muted-foreground backdrop-blur-lg md:top-12"
    >
      <div v-if="onlineServers > 0" class="flex items-center gap-1">
        <span class="inline-block size-1.5 animate-pulse rounded-full bg-green-600" />
        <span class="text-green-600">{{ onlineServers }}</span>
      </div>
      <div v-if="offlineServers > 0" class="flex items-center gap-1">
        <span class="inline-block size-1.5 animate-pulse rounded-full bg-yellow-600" />
        <span class="text-yellow-600">{{ offlineServers }}</span>
      </div>
    </div>
  </div>
</template>
