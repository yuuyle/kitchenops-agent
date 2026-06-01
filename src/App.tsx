import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode, RefObject } from 'react'
import {
  CalendarDays,
  Camera,
  CheckCircle2,
  ChefHat,
  CircleAlert,
  Clock3,
  Cloud,
  Database,
  ExternalLink,
  Eye,
  Flame,
  ListPlus,
  Loader2,
  Package,
  Play,
  Plus,
  RefreshCw,
  Refrigerator,
  Save,
  ScanLine,
  ShoppingBasket,
  Sparkles,
  Square,
  Trash2,
  Utensils,
  Users,
} from 'lucide-react'
import './App.css'
import { api } from './api'
import type {
  FamilyProfile,
  CameraCalibration,
  CameraPlacement,
  IngredientCategory,
  IngredientStock,
  IntegrationStatus,
  IntakeMode,
  KitchenState,
  MealSlot,
  Recipe,
  ReviewQueueItem,
  StorageLocation,
  StockStatus,
  VisionDetection,
  VisionScanResponse,
  VisionTrack,
} from '../common/types.ts'

type View = 'camera' | 'plan' | 'recipes' | 'stock' | 'family'
type CameraScanOverlay = {
  id: string
  mode: IntakeMode
  label: string
  action: VisionDetection['action']
  confidence: number
  quantity: number
  unit: string
}

const categoryLabels: Record<IngredientCategory, string> = {
  vegetable: '野菜',
  meat: '肉',
  fish: '魚介',
  dairy: '乳製品',
  egg: '卵',
  staple: '主食',
  soy: '豆・大豆',
  fruit: '果物',
  seasoning: '調味料',
  prepared: '加工品',
  other: 'その他',
}

const storageLabels: Record<StorageLocation, string> = {
  pantry: '常温',
  fridge: '冷蔵',
  freezer: '冷凍',
}

const placementLabels: Record<CameraPlacement, string> = {
  bag_station: '買い物台',
  fridge_front: '冷蔵庫前',
  countertop: '調理台',
  unknown: '未設定',
}

const lightingLabels: Record<CameraCalibration['lighting'], string> = {
  dim: '暗め',
  normal: '標準',
  bright: '明るめ',
}

const perspectiveLabels: Record<CameraCalibration['perspective'], string> = {
  top_down: '真上',
  front: '正面',
  angled: '斜め',
}

const statusLabels: Record<StockStatus, string> = {
  ok: '通常',
  'use-soon': '早め',
  expired: '期限切れ',
}

const sourceLabels: Record<IngredientStock['source'], string> = {
  camera: 'カメラ追加',
  manual: '手動追加',
  seed: '初期データ',
}

const trackStatusLabels: Record<VisionTrack['status'], string> = {
  observing: '観測中',
  committed: '在庫反映済み',
  needs_review: '確認待ち',
  ignored: '重複扱い',
}

const categoryOptions = Object.entries(categoryLabels) as Array<[IngredientCategory, string]>
const storageOptions = Object.entries(storageLabels) as Array<[StorageLocation, string]>
const placementOptions = Object.entries(placementLabels) as Array<[CameraPlacement, string]>
const lightingOptions = Object.entries(lightingLabels) as Array<[CameraCalibration['lighting'], string]>
const perspectiveOptions = Object.entries(perspectiveLabels) as Array<[CameraCalibration['perspective'], string]>
const demoScanSamples = [
  { canonicalName: 'tomato', label: 'トマト' },
  { canonicalName: 'milk', label: '牛乳' },
  { canonicalName: 'pork_slices', label: '豚こま肉' },
  { canonicalName: 'cabbage', label: 'キャベツ' },
  { canonicalName: 'banana', label: 'バナナ' },
  { canonicalName: 'potato', label: 'じゃがいも' },
]

const todayInputValue = () => new Date().toISOString().slice(0, 10)

const dateInputAfter = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
  }).format(new Date(iso))

const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))

const freshnessScore = (inventory: IngredientStock[]) => {
  if (inventory.length === 0) return 100
  const risky = inventory.filter((item) => item.status !== 'ok').length
  return Math.max(0, Math.round(((inventory.length - risky) / inventory.length) * 100))
}

const canonicalFromName = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\p{Letter}\p{Number}_-]/gu, '')

const actionLabel = (detection: VisionDetection) => {
  switch (detection.action) {
    case 'added':
      return '登録'
    case 'increased':
      return '加算'
    case 'consumed':
      return '使用'
    case 'removed':
      return '削除'
    case 'ignored_duplicate':
      return '重複'
    case 'needs_review':
      return '確認'
  }
}

const scanOverlayMessage = (overlay: CameraScanOverlay) => {
  switch (overlay.action) {
    case 'added':
      return `${overlay.quantity}${overlay.unit}を在庫に登録`
    case 'increased':
      return `${overlay.quantity}${overlay.unit}を在庫に加算`
    case 'consumed':
      return `${overlay.quantity}${overlay.unit}を使用として反映`
    case 'removed':
      return '使い切りとして在庫から削除'
    case 'ignored_duplicate':
      return '連続検出としてトラッキングに集約'
    case 'needs_review':
      return '確認キューに送信'
  }
}

const tabItems: Array<{ id: View; label: string; Icon: typeof Camera }> = [
  { id: 'camera', label: 'カメラ', Icon: Camera },
  { id: 'plan', label: '献立', Icon: CalendarDays },
  { id: 'recipes', label: 'レシピ', Icon: ChefHat },
  { id: 'stock', label: '在庫', Icon: Database },
  { id: 'family', label: '家族', Icon: Users },
]

function App() {
  const [state, setState] = useState<KitchenState | null>(null)
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([])
  const [activeView, setActiveView] = useState<View>('camera')
  const [mode, setMode] = useState<IntakeMode>('intake')
  const [cameraActive, setCameraActive] = useState(false)
  const [autoScan, setAutoScan] = useState(true)
  const [isScanning, setIsScanning] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [scanOverlay, setScanOverlay] = useState<CameraScanOverlay | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanOverlayTimerRef = useRef<number | null>(null)

  const refreshState = useCallback(async () => {
    const [nextState, integrationResult] = await Promise.all([api.getState(), api.getIntegrations()])
    setState(nextState)
    setIntegrations(integrationResult.integrations)
    setSelectedRecipeId((current) => current ?? nextState.recipes[0]?.id)
  }, [])

  useEffect(() => {
    let cancelled = false

    Promise.all([api.getState(), api.getIntegrations()])
      .then(([nextState, integrationResult]) => {
        if (cancelled) return
        setState(nextState)
        setIntegrations(integrationResult.integrations)
        setSelectedRecipeId((current) => current ?? nextState.recipes[0]?.id)
      })
      .catch((reason) => {
        if (!cancelled) setError(String(reason))
      })

    return () => {
      cancelled = true
    }
  }, [])

  const captureFrame = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current

    if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) {
      return undefined
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')

    if (!context) return undefined
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.68)
  }, [])

  const applyVisionScanResult = useCallback((result: VisionScanResponse) => {
    setState((current) =>
      current
        ? {
            ...current,
            inventory: result.inventory,
            visionTracks: result.visionTracks,
            reviewQueue: result.reviewQueue,
            detections: [...result.detections, ...current.detections].slice(0, 80),
            events: result.events,
          }
        : current,
    )
  }, [])

  const showScanOverlay = useCallback((detection?: VisionDetection) => {
    if (!detection) return

    if (scanOverlayTimerRef.current) {
      window.clearTimeout(scanOverlayTimerRef.current)
    }

    setScanOverlay({
      id: detection.id,
      mode: detection.mode,
      label: detection.label,
      action: detection.action,
      confidence: detection.confidence,
      quantity: detection.quantity,
      unit: detection.unit,
    })

    scanOverlayTimerRef.current = window.setTimeout(() => {
      setScanOverlay(null)
      scanOverlayTimerRef.current = null
    }, 4600)
  }, [])

  useEffect(
    () => () => {
      if (scanOverlayTimerRef.current) {
        window.clearTimeout(scanOverlayTimerRef.current)
      }
    },
    [],
  )

  const runScan = useCallback(async () => {
    if (isScanning) return

    setIsScanning(true)
    setError(null)

    try {
      const result = await api.scanFrame(mode, captureFrame())
      applyVisionScanResult(result)
      showScanOverlay(result.detections[0])
    } catch (reason) {
      setError(String(reason))
    } finally {
      setIsScanning(false)
    }
  }, [applyVisionScanResult, captureFrame, isScanning, mode, showScanOverlay])

  const runDemoScan = useCallback(
    async (canonicalName: string) => {
      if (isScanning) return

      setIsScanning(true)
      setError(null)

      try {
        const result = await api.scanFrame(mode, undefined, canonicalName)
        applyVisionScanResult(result)
        showScanOverlay(result.detections[0])
      } catch (reason) {
        setError(String(reason))
      } finally {
        setIsScanning(false)
      }
    },
    [applyVisionScanResult, isScanning, mode, showScanOverlay],
  )

  useEffect(() => {
    if (!cameraActive || !autoScan || !state) return undefined

    const timer = window.setInterval(() => {
      runScan()
    }, state.status.cameraCadenceMs)

    return () => window.clearInterval(timer)
  }, [autoScan, cameraActive, runScan, state])

  const startCamera = async () => {
    setError(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      setCameraActive(true)
    } catch (reason) {
      setError(`カメラを開始できませんでした: ${String(reason)}`)
    }
  }

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setCameraActive(false)
    setScanOverlay(null)
  }

  const generatePlan = async () => {
    setIsGenerating(true)
    setError(null)

    try {
      const result = await api.generateMealPlan()
      setState((current) =>
        current
          ? {
              ...current,
              mealPlan: result.mealPlan,
              recipes: result.recipes,
            }
          : current,
      )
      setActiveView('plan')
    } catch (reason) {
      setError(String(reason))
    } finally {
      setIsGenerating(false)
    }
  }

  const deleteStock = async (id: string) => {
    const result = await api.deleteStock(id)
    setState((current) => (current ? { ...current, inventory: result.inventory } : current))
  }

  const resolveReview = async (id: string, decision: 'approve' | 'reject') => {
    const nextState =
      decision === 'approve' ? await api.approveReview(id) : await api.rejectReview(id)
    setState(nextState)
  }

  const saveCameraCalibration = async (calibration: CameraCalibration) => {
    const saved = await api.saveCameraCalibration(calibration)
    setState((current) =>
      current
        ? {
            ...current,
            cameraCalibration: saved,
            status: {
              ...current.status,
              trackingWindowMs: saved.duplicateWindowMs,
            },
          }
        : current,
    )
    return saved
  }

  const selectedRecipe = useMemo(
    () => state?.recipes.find((recipe) => recipe.id === selectedRecipeId) ?? state?.recipes[0],
    [selectedRecipeId, state?.recipes],
  )

  if (!state) {
    return (
      <main className="loading-screen">
        <Loader2 className="spin" size={28} />
        <span>Kitchen AI を起動中</span>
      </main>
    )
  }

  const expiringCount = state.inventory.filter((item) => item.status === 'use-soon').length
  const expiredCount = state.inventory.filter((item) => item.status === 'expired').length
  const pendingReviewCount = state.reviewQueue.filter((item) => item.status === 'pending').length
  const visionProviderLabel =
    state.status.visionProvider === 'azure-ready'
      ? 'Azure AI'
      : state.status.visionProvider === 'openai-ready'
        ? 'Vision Ready'
        : 'Mock Vision'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">
            <Utensils size={22} />
          </div>
          <div>
            <p className="eyebrow">Kitchen AI</p>
            <h1>食材と献立</h1>
          </div>
        </div>

        <nav className="nav-tabs" aria-label="管理画面">
          {tabItems.map(({ id, label, Icon }) => (
            <button
              type="button"
              key={id}
              className={activeView === id ? 'active' : ''}
              onClick={() => setActiveView(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="system-strip">
          <div>
            <Eye size={16} />
            <span>{visionProviderLabel}</span>
          </div>
          <div>
            <Clock3 size={16} />
            <span>{state.status.cameraCadenceMs / 1000}s</span>
          </div>
          <div>
            <CheckCircle2 size={16} />
            <span>{Math.round(state.status.confidenceThreshold * 100)}%</span>
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">固定カメラ運用</p>
            <h2>{tabItems.find((item) => item.id === activeView)?.label}</h2>
          </div>
          <div className="topbar-actions">
            <button type="button" className="icon-button" onClick={refreshState} title="再読み込み">
              <RefreshCw size={18} />
            </button>
            <button type="button" className="primary-action" onClick={generatePlan} disabled={isGenerating}>
              {isGenerating ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
              <span>献立生成</span>
            </button>
          </div>
        </header>

        {error ? (
          <div className="error-banner">
            <CircleAlert size={18} />
            <span>{error}</span>
          </div>
        ) : null}

        <section className="stats-grid">
          <StatTile icon={<Package size={20} />} label="在庫数" value={`${state.inventory.length}`} tone="green" />
          <StatTile icon={<Flame size={20} />} label="期限注意" value={`${expiringCount + expiredCount}`} tone="amber" />
          <StatTile
            icon={<ShoppingBasket size={20} />}
            label="買い足し"
            value={`${state.mealPlan?.shoppingList.length ?? 0}`}
            tone="coral"
          />
          <StatTile icon={<CircleAlert size={20} />} label="確認" value={`${pendingReviewCount}`} tone="amber" />
          <StatTile icon={<CheckCircle2 size={20} />} label="鮮度" value={`${freshnessScore(state.inventory)}%`} tone="blue" />
        </section>

        {activeView === 'camera' ? (
          <CameraView
            mode={mode}
            setMode={setMode}
            cameraActive={cameraActive}
            autoScan={autoScan}
            isScanning={isScanning}
            detections={state.detections}
            visionTracks={state.visionTracks}
            reviewQueue={state.reviewQueue}
            integrations={integrations}
            calibration={state.cameraCalibration}
            scanOverlay={scanOverlay}
            videoRef={videoRef}
            canvasRef={canvasRef}
            onStart={startCamera}
            onStop={stopCamera}
            onScan={runScan}
            onDemoScan={runDemoScan}
            setAutoScan={setAutoScan}
            onResolveReview={resolveReview}
            onSaveCalibration={saveCameraCalibration}
          />
        ) : null}

        {activeView === 'plan' ? (
          <MealPlanView
            state={state}
            isGenerating={isGenerating}
            onGenerate={generatePlan}
            onRecipeSelect={(recipeId) => {
              setSelectedRecipeId(recipeId)
              setActiveView('recipes')
            }}
          />
        ) : null}

        {activeView === 'recipes' ? (
          <RecipesView
            recipes={state.recipes}
            selectedRecipe={selectedRecipe}
            selectedRecipeId={selectedRecipe?.id}
            onSelect={setSelectedRecipeId}
          />
        ) : null}

        {activeView === 'stock' ? (
          <StockView
            inventory={state.inventory}
            detections={state.detections}
            onDelete={deleteStock}
            onInventoryChanged={refreshState}
          />
        ) : null}

        {activeView === 'family' ? <FamilyView profile={state.familyProfile} onSaved={refreshState} /> : null}

        <ActivityRail state={state} />
      </main>
    </div>
  )
}

function StatTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode
  label: string
  value: string
  tone: 'green' | 'amber' | 'coral' | 'blue'
}) {
  return (
    <div className={`stat-tile ${tone}`}>
      <div className="stat-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function CameraView({
  mode,
  setMode,
  cameraActive,
  autoScan,
  isScanning,
  detections,
  visionTracks,
  reviewQueue,
  integrations,
  calibration,
  scanOverlay,
  videoRef,
  canvasRef,
  onStart,
  onStop,
  onScan,
  onDemoScan,
  setAutoScan,
  onResolveReview,
  onSaveCalibration,
}: {
  mode: IntakeMode
  setMode: (mode: IntakeMode) => void
  cameraActive: boolean
  autoScan: boolean
  isScanning: boolean
  detections: VisionDetection[]
  visionTracks: VisionTrack[]
  reviewQueue: ReviewQueueItem[]
  integrations: IntegrationStatus[]
  calibration: CameraCalibration
  scanOverlay: CameraScanOverlay | null
  videoRef: RefObject<HTMLVideoElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  onStart: () => void
  onStop: () => void
  onScan: () => void
  onDemoScan: (canonicalName: string) => void
  setAutoScan: (value: boolean) => void
  onResolveReview: (id: string, decision: 'approve' | 'reject') => void
  onSaveCalibration: (calibration: CameraCalibration) => Promise<CameraCalibration>
}) {
  const pendingReviews = reviewQueue.filter((item) => item.status === 'pending').slice(0, 4)
  const [calibrationDraft, setCalibrationDraft] = useState(calibration)
  const [isSavingCalibration, setIsSavingCalibration] = useState(false)
  const recentTracks = visionTracks.slice(0, 5)
  const saveCalibration = async () => {
    setIsSavingCalibration(true)

    try {
      const saved = await onSaveCalibration(calibrationDraft)
      setCalibrationDraft(saved)
    } finally {
      setIsSavingCalibration(false)
    }
  }

  return (
    <section className="camera-layout">
      <div className="camera-stage">
        <video ref={videoRef} muted playsInline className={cameraActive ? 'live' : ''} />
        <canvas ref={canvasRef} aria-hidden="true" />
        <div
          className="roi-box"
          style={{
            left: `${calibrationDraft.regionOfInterest.x * 100}%`,
            top: `${calibrationDraft.regionOfInterest.y * 100}%`,
            width: `${calibrationDraft.regionOfInterest.width * 100}%`,
            height: `${calibrationDraft.regionOfInterest.height * 100}%`,
          }}
        />
        {!cameraActive ? (
          <div className="camera-placeholder">
            <Camera size={42} />
            <span>Camera Standby</span>
          </div>
        ) : null}
        <div className="scan-line" />
        {scanOverlay ? (
          <div
            className={`scan-result-overlay ${scanOverlay.action}`}
            key={scanOverlay.id}
            role="status"
            aria-live="polite"
          >
            <div className="scan-result-kicker">
              <ScanLine size={16} />
              <span>{scanOverlay.mode === 'intake' ? '入庫スキャン' : '使用スキャン'}</span>
            </div>
            <strong>{scanOverlay.label}</strong>
            <span>
              {scanOverlayMessage(scanOverlay)} / 信頼度 {Math.round(scanOverlay.confidence * 100)}%
            </span>
          </div>
        ) : null}
      </div>

      <div className="control-panel">
        <div className="segmented">
          <button type="button" className={mode === 'intake' ? 'active' : ''} onClick={() => setMode('intake')}>
            <ListPlus size={17} />
            <span>登録</span>
          </button>
          <button type="button" className={mode === 'consume' ? 'active' : ''} onClick={() => setMode('consume')}>
            <Utensils size={17} />
            <span>使用</span>
          </button>
        </div>

        <div className="button-row">
          {!cameraActive ? (
            <button type="button" className="primary-action" onClick={onStart}>
              <Play size={18} />
              <span>開始</span>
            </button>
          ) : (
            <button type="button" className="secondary-action" onClick={onStop}>
              <Square size={18} />
              <span>停止</span>
            </button>
          )}
          <button type="button" className="secondary-action" onClick={onScan} disabled={isScanning}>
            {isScanning ? <Loader2 className="spin" size={18} /> : <ScanLine size={18} />}
            <span>判定</span>
          </button>
        </div>

        <label className="toggle-row">
          <input type="checkbox" checked={autoScan} onChange={(event) => setAutoScan(event.target.checked)} />
          <span>自動スキャン</span>
        </label>

        <div className="demo-panel">
          <div className="section-heading compact">
            <h3>デモ入力</h3>
            <span>{demoScanSamples.length}</span>
          </div>
          <div className="demo-sample-grid">
            {demoScanSamples.map((sample) => (
              <button
                type="button"
                className="secondary-action"
                key={sample.canonicalName}
                onClick={() => onDemoScan(sample.canonicalName)}
                disabled={isScanning}
              >
                <ScanLine size={16} />
                <span>{sample.label}</span>
              </button>
            ))}
          </div>
        </div>

        <IntegrationStatusPanel integrations={integrations} />

        <div className="calibration-panel">
          <div className="section-heading compact">
            <h3>キャリブレーション</h3>
            <span>{calibrationDraft.lastCalibratedAt ? formatDate(calibrationDraft.lastCalibratedAt) : '未保存'}</span>
          </div>
          <div className="calibration-grid">
            <label>
              設置場所
              <select
                value={calibrationDraft.placement}
                onChange={(event) =>
                  setCalibrationDraft((current) => ({
                    ...current,
                    placement: event.target.value as CameraPlacement,
                  }))
                }
              >
                {placementOptions.map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              明るさ
              <select
                value={calibrationDraft.lighting}
                onChange={(event) =>
                  setCalibrationDraft((current) => ({
                    ...current,
                    lighting: event.target.value as CameraCalibration['lighting'],
                  }))
                }
              >
                {lightingOptions.map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              角度
              <select
                value={calibrationDraft.perspective}
                onChange={(event) =>
                  setCalibrationDraft((current) => ({
                    ...current,
                    perspective: event.target.value as CameraCalibration['perspective'],
                  }))
                }
              >
                {perspectiveOptions.map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              集約秒数
              <input
                type="number"
                min="1"
                max="120"
                value={Math.round(calibrationDraft.duplicateWindowMs / 1000)}
                onChange={(event) =>
                  setCalibrationDraft((current) => ({
                    ...current,
                    duplicateWindowMs: Number(event.target.value) * 1000,
                  }))
                }
              />
            </label>
            <label>
              X
              <input
                type="number"
                min="0"
                max="95"
                value={Math.round(calibrationDraft.regionOfInterest.x * 100)}
                onChange={(event) =>
                  setCalibrationDraft((current) => ({
                    ...current,
                    regionOfInterest: {
                      ...current.regionOfInterest,
                      x: Number(event.target.value) / 100,
                    },
                  }))
                }
              />
            </label>
            <label>
              Y
              <input
                type="number"
                min="0"
                max="95"
                value={Math.round(calibrationDraft.regionOfInterest.y * 100)}
                onChange={(event) =>
                  setCalibrationDraft((current) => ({
                    ...current,
                    regionOfInterest: {
                      ...current.regionOfInterest,
                      y: Number(event.target.value) / 100,
                    },
                  }))
                }
              />
            </label>
            <label>
              幅
              <input
                type="number"
                min="5"
                max="100"
                value={Math.round(calibrationDraft.regionOfInterest.width * 100)}
                onChange={(event) =>
                  setCalibrationDraft((current) => ({
                    ...current,
                    regionOfInterest: {
                      ...current.regionOfInterest,
                      width: Number(event.target.value) / 100,
                    },
                  }))
                }
              />
            </label>
            <label>
              高さ
              <input
                type="number"
                min="5"
                max="100"
                value={Math.round(calibrationDraft.regionOfInterest.height * 100)}
                onChange={(event) =>
                  setCalibrationDraft((current) => ({
                    ...current,
                    regionOfInterest: {
                      ...current.regionOfInterest,
                      height: Number(event.target.value) / 100,
                    },
                  }))
                }
              />
            </label>
          </div>
          <button
            type="button"
            className="secondary-action"
            onClick={saveCalibration}
            disabled={isSavingCalibration}
          >
            {isSavingCalibration ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
            <span>保存</span>
          </button>
        </div>

        <div className="track-panel">
          <div className="section-heading compact">
            <h3>トラッキング</h3>
            <span>{recentTracks.length}</span>
          </div>
          {recentTracks.length === 0 ? (
            <span className="quiet">追跡中の食材はありません</span>
          ) : (
            <div className="track-list">
              {recentTracks.map((track) => (
                <div className="track-item" key={track.id}>
                  <div>
                    <strong>{track.label}</strong>
                    <span>
                      {trackStatusLabels[track.status]} / {formatDateTime(track.lastSeenAt)}
                    </span>
                    <span>track {track.id.slice(0, 8)}</span>
                  </div>
                  <div className={`track-status ${track.status}`}>
                    {track.frameCount} frames
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="detection-list">
          {detections.slice(0, 6).map((detection) => (
            <div className="detection-item" key={detection.id}>
              <div>
                <strong>{detection.label}</strong>
                <span>
                  {formatDateTime(detection.observedAt)} / 信頼度 {Math.round(detection.confidence * 100)}%
                  {detection.trackId ? ` / track ${detection.trackId.slice(0, 8)}` : ''}
                </span>
                <span>{detection.pipeline.fusionNote}</span>
              </div>
              <div className={`detection-badge ${detection.action}`}>
                {actionLabel(detection)}
              </div>
            </div>
          ))}
        </div>

        <div className="review-panel">
          <div className="section-heading compact">
            <h3>確認キュー</h3>
            <span>{pendingReviews.length}</span>
          </div>
          {pendingReviews.length === 0 ? (
            <span className="quiet">確認待ちはありません</span>
          ) : (
            <div className="review-list">
              {pendingReviews.map((item) => (
                <div className="review-item" key={item.id}>
                  <div>
                    <strong>{item.detection.label}</strong>
                    <span>{item.reason}</span>
                  </div>
                  <div className="review-actions">
                    <button
                      type="button"
                      className="icon-button approve"
                      onClick={() => onResolveReview(item.id, 'approve')}
                      title="採用"
                    >
                      <CheckCircle2 size={17} />
                    </button>
                    <button
                      type="button"
                      className="icon-button reject"
                      onClick={() => onResolveReview(item.id, 'reject')}
                      title="却下"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function IntegrationStatusPanel({ integrations }: { integrations: IntegrationStatus[] }) {
  const configuredCount = integrations.filter((integration) => integration.configured).length

  return (
    <div className="integration-panel">
      <div className="section-heading compact">
        <h3>Microsoft AI</h3>
        <span>
          {configuredCount}/{integrations.length}
        </span>
      </div>
      {integrations.length === 0 ? (
        <span className="quiet">連携状態を確認中です</span>
      ) : (
        <div className="integration-list">
          {integrations.map((integration) => (
            <div className="integration-item" key={integration.name}>
              <Cloud size={17} />
              <div>
                <strong>{integration.name}</strong>
                <span>{integration.requiredEnvironment.join(' / ')}</span>
              </div>
              <span className={integration.configured ? 'integration-badge ready' : 'integration-badge pending'}>
                {integration.configured ? 'Ready' : '未設定'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MealPlanView({
  state,
  isGenerating,
  onGenerate,
  onRecipeSelect,
}: {
  state: KitchenState
  isGenerating: boolean
  onGenerate: () => void
  onRecipeSelect: (recipeId: string) => void
}) {
  const plan = state.mealPlan

  if (!plan) {
    return (
      <section className="empty-state">
        <CalendarDays size={38} />
        <h3>献立は未生成です</h3>
        <button type="button" className="primary-action" onClick={onGenerate} disabled={isGenerating}>
          {isGenerating ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
          <span>1週間を生成</span>
        </button>
      </section>
    )
  }

  return (
    <section className="plan-layout">
      <div className="plan-header">
        <div>
          <p className="eyebrow">在庫カバー率 {plan.coveragePercent}%</p>
          <h3>{plan.summary}</h3>
        </div>
        <button type="button" className="secondary-action" onClick={onGenerate} disabled={isGenerating}>
          {isGenerating ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
          <span>再生成</span>
        </button>
      </div>

      <div className="week-grid">
        {plan.days.map((day) => (
          <article className="day-card" key={day.date}>
            <div className="day-card-header">
              <strong>{day.label}</strong>
              <span>{day.nutritionFocus}</span>
            </div>
            <MealSlotButton label="朝" slot={day.breakfast} onRecipeSelect={onRecipeSelect} />
            <MealSlotButton label="昼" slot={day.lunch} onRecipeSelect={onRecipeSelect} />
            <MealSlotButton label="夜" slot={day.dinner} onRecipeSelect={onRecipeSelect} />
          </article>
        ))}
      </div>

      <div className="shopping-section">
        <h3>買い足し</h3>
        <div className="shopping-list">
          {plan.shoppingList.length === 0 ? (
            <span className="quiet">追加購入なし</span>
          ) : (
            plan.shoppingList.map((item) => (
              <span className="shopping-chip" key={item.canonicalName}>
                {item.name} {item.quantity}
                {item.unit}
              </span>
            ))
          )}
        </div>
      </div>
    </section>
  )
}

function MealSlotButton({
  label,
  slot,
  onRecipeSelect,
}: {
  label: string
  slot: MealSlot
  onRecipeSelect: (recipeId: string) => void
}) {
  const hasGaps = slot.shoppingGaps.length > 0

  return (
    <button
      type="button"
      className="meal-slot"
      onClick={() => slot.recipeId && onRecipeSelect(slot.recipeId)}
      disabled={!slot.recipeId}
    >
      <span className="meal-label">{label}</span>
      <span className="meal-title">{slot.title}</span>
      <span className={hasGaps ? 'gap-count alert' : 'gap-count'}>
        {hasGaps ? `不足 ${slot.shoppingGaps.length}` : '在庫内'}
      </span>
    </button>
  )
}

function RecipesView({
  recipes,
  selectedRecipe,
  selectedRecipeId,
  onSelect,
}: {
  recipes: Recipe[]
  selectedRecipe?: Recipe
  selectedRecipeId?: string
  onSelect: (recipeId: string) => void
}) {
  return (
    <section className="recipes-layout">
      <div className="recipe-list">
        {recipes.map((recipe) => (
          <button
            type="button"
            className={recipe.id === selectedRecipeId ? 'recipe-row active' : 'recipe-row'}
            key={recipe.id}
            onClick={() => onSelect(recipe.id)}
          >
            <strong>{recipe.title}</strong>
            <span>
              {recipe.cookingMinutes}分 / {recipe.tags.slice(0, 2).join('・')}
            </span>
          </button>
        ))}
      </div>

      {selectedRecipe ? (
        <article className="recipe-detail">
          <div className="recipe-detail-header">
            <div>
              <p className="eyebrow">{selectedRecipe.sourceName}</p>
              <h3>{selectedRecipe.title}</h3>
            </div>
            <a href={selectedRecipe.sourceUrl} target="_blank" rel="noreferrer" className="icon-link">
              <ExternalLink size={18} />
            </a>
          </div>

          <p className="recipe-summary">{selectedRecipe.aiSummary}</p>

          <div className="recipe-meta">
            <span>{selectedRecipe.servings}人分</span>
            <span>{selectedRecipe.cookingMinutes}分</span>
            <span>P {selectedRecipe.nutrition.proteinGram}g</span>
            <span>野菜 {selectedRecipe.nutrition.vegetableGram}g</span>
          </div>

          <div className="detail-columns">
            <div>
              <h4>材料</h4>
              <ul className="ingredient-list">
                {selectedRecipe.ingredients.map((ingredient) => (
                  <li key={`${selectedRecipe.id}-${ingredient.canonicalName}`}>
                    <span>{ingredient.name}</span>
                    <strong>
                      {ingredient.amount}
                      {ingredient.unit}
                    </strong>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4>手順</h4>
              <ol className="step-list">
                {selectedRecipe.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          </div>
        </article>
      ) : null}
    </section>
  )
}

function StockView({
  inventory,
  detections,
  onDelete,
  onInventoryChanged,
}: {
  inventory: IngredientStock[]
  detections: VisionDetection[]
  onDelete: (id: string) => void
  onInventoryChanged: () => void
}) {
  const [form, setForm] = useState({
    name: '',
    quantity: 1,
    unit: '個',
    category: 'vegetable' as IngredientCategory,
    storage: 'fridge' as StorageLocation,
    expiresAt: dateInputAfter(5),
  })
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [remainingDrafts, setRemainingDrafts] = useState<Record<string, string>>({})
  const [storageFilter, setStorageFilter] = useState<'all' | StorageLocation>('all')
  const filteredInventory = inventory.filter((item) =>
    storageFilter === 'all' ? true : item.storage === storageFilter,
  )
  const todaysUsage = detections
    .filter((detection) => detection.mode === 'consume')
    .filter((detection) => new Date(detection.observedAt).toDateString() === new Date().toDateString())
    .slice(0, 6)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)

    try {
      await api.createStock({
        name: form.name,
        canonicalName: canonicalFromName(form.name),
        category: form.category,
        quantity: Number(form.quantity),
        unit: form.unit,
        storage: form.storage,
        expiresAt: new Date(form.expiresAt).toISOString(),
      })
      setForm((current) => ({ ...current, name: '', quantity: 1, expiresAt: dateInputAfter(5) }))
      await onInventoryChanged()
    } finally {
      setSaving(false)
    }
  }

  const saveRemaining = async (item: IngredientStock) => {
    const draft = remainingDrafts[item.id] ?? String(item.quantity)
    const quantity = Number(draft)

    if (!Number.isFinite(quantity) || quantity < 0) return

    setUpdatingId(item.id)

    try {
      await api.updateStock(item.id, { quantity })
      await onInventoryChanged()
      setRemainingDrafts((current) => {
        const next = { ...current }
        delete next[item.id]
        return next
      })
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <section className="stock-layout">
      <form className="stock-form" onSubmit={submit}>
        <input
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          placeholder="食材名"
          required
        />
        <input
          type="number"
          min="0.1"
          step="0.1"
          value={form.quantity}
          onChange={(event) => setForm((current) => ({ ...current, quantity: Number(event.target.value) }))}
          required
        />
        <input
          value={form.unit}
          onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))}
          placeholder="単位"
          required
        />
        <select
          value={form.category}
          onChange={(event) =>
            setForm((current) => ({ ...current, category: event.target.value as IngredientCategory }))
          }
        >
          {categoryOptions.map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={form.storage}
          onChange={(event) => setForm((current) => ({ ...current, storage: event.target.value as StorageLocation }))}
        >
          {storageOptions.map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={form.expiresAt}
          min={todayInputValue()}
          onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))}
        />
        <button type="submit" className="icon-button filled" disabled={saving || !form.name.trim()} title="追加">
          {saving ? <Loader2 className="spin" size={18} /> : <Plus size={18} />}
        </button>
      </form>

      <div className="storage-filter" aria-label="保管場所フィルタ">
        <button
          type="button"
          className={storageFilter === 'all' ? 'active' : ''}
          onClick={() => setStorageFilter('all')}
        >
          <Database size={16} />
          <span>すべて</span>
        </button>
        {storageOptions.map(([value, label]) => (
          <button
            type="button"
            className={storageFilter === value ? 'active' : ''}
            onClick={() => setStorageFilter(value)}
            key={value}
          >
            <Package size={16} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="usage-adjustment-panel">
        <div className="section-heading compact">
          <h3>今日の使用</h3>
          <span>{todaysUsage.length}</span>
        </div>
        {todaysUsage.length === 0 ? (
          <span className="quiet">今日の使用検出はまだありません</span>
        ) : (
          <div className="usage-chip-list">
            {todaysUsage.map((detection) => (
              <span className={`usage-chip ${detection.action}`} key={detection.id}>
                {detection.label} / {actionLabel(detection)}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="stock-table">
        {filteredInventory.map((item) => (
          <div className="stock-row" key={item.id}>
            <div className="stock-main">
              <span className={`status-dot ${item.status}`} />
              <div>
                <strong>{item.name}</strong>
                <span>{categoryLabels[item.category]}</span>
                <span className="stock-meta">
                  {sourceLabels[item.source]} / 更新 {formatDateTime(item.updatedAt)} / 信頼度{' '}
                  {Math.round(item.confidence * 100)}%
                </span>
              </div>
            </div>
            <strong>
              {item.quantity}
              {item.unit}
            </strong>
            <div className="remaining-control">
              <input
                type="number"
                min="0"
                step="0.1"
                value={remainingDrafts[item.id] ?? item.quantity}
                onChange={(event) =>
                  setRemainingDrafts((current) => ({
                    ...current,
                    [item.id]: event.target.value,
                  }))
                }
                aria-label={`${item.name} の残量`}
              />
              <span>{item.unit}</span>
            </div>
            <span>{storageLabels[item.storage]}</span>
            <span>{formatDate(item.expiresAt)}</span>
            <span className={`status-pill ${item.status}`}>{statusLabels[item.status]}</span>
            <button
              type="button"
              className="icon-button"
              onClick={() => saveRemaining(item)}
              disabled={updatingId === item.id}
              title="残量保存"
            >
              {updatingId === item.id ? <Loader2 className="spin" size={17} /> : <Save size={17} />}
            </button>
            <button type="button" className="icon-button" onClick={() => onDelete(item.id)} title="削除">
              <Trash2 size={17} />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

function FamilyView({ profile, onSaved }: { profile: FamilyProfile; onSaved: () => void }) {
  const [draft, setDraft] = useState(profile)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)

    try {
      await api.saveFamily(draft)
      await onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="family-layout">
      <div className="profile-panel">
        <h3>家族構成</h3>
        <div className="member-grid">
          {draft.members.map((member) => (
            <div className="member-card" key={member.id}>
              <Users size={18} />
              <strong>{member.label}</strong>
              <span>{member.ageGroup === 'child' ? '子ども' : member.ageGroup === 'senior' ? 'シニア' : '大人'}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="settings-grid">
        <label>
          アレルギー
          <input
            value={draft.allergies.join(', ')}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                allergies: event.target.value.split(',').map((item) => item.trim()).filter(Boolean),
              }))
            }
          />
        </label>
        <label>
          苦手
          <input
            value={draft.dislikes.join(', ')}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                dislikes: event.target.value.split(',').map((item) => item.trim()).filter(Boolean),
              }))
            }
          />
        </label>
        <label>
          好み
          <input
            value={draft.favoriteStyles.join(', ')}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                favoriteStyles: event.target.value.split(',').map((item) => item.trim()).filter(Boolean),
              }))
            }
          />
        </label>
        <label>
          栄養目標
          <input
            value={draft.nutritionGoals.join(', ')}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                nutritionGoals: event.target.value.split(',').map((item) => item.trim()).filter(Boolean),
              }))
            }
          />
        </label>
        <label>
          優先レシピサイト
          <input
            value={draft.recipeSourcePreferences.preferredSites.join(', ')}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                recipeSourcePreferences: {
                  ...current.recipeSourcePreferences,
                  preferredSites: event.target.value.split(',').map((item) => item.trim()).filter(Boolean),
                },
              }))
            }
          />
        </label>
        <label>
          除外レシピサイト
          <input
            value={draft.recipeSourcePreferences.blockedSites.join(', ')}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                recipeSourcePreferences: {
                  ...current.recipeSourcePreferences,
                  blockedSites: event.target.value.split(',').map((item) => item.trim()).filter(Boolean),
                },
              }))
            }
          />
        </label>
        <label>
          調理時間
          <input
            type="number"
            min="5"
            max="180"
            value={draft.maxCookingMinutes}
            onChange={(event) =>
              setDraft((current) => ({ ...current, maxCookingMinutes: Number(event.target.value) }))
            }
          />
        </label>
        <label>
          週予算
          <input
            type="number"
            min="0"
            step="500"
            value={draft.weeklyBudgetYen}
            onChange={(event) =>
              setDraft((current) => ({ ...current, weeklyBudgetYen: Number(event.target.value) }))
            }
          />
        </label>
      </div>

      <button type="button" className="primary-action" onClick={save} disabled={saving}>
        {saving ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
        <span>保存</span>
      </button>
    </section>
  )
}

function ActivityRail({ state }: { state: KitchenState }) {
  return (
    <section className="activity-rail">
      <div className="section-heading">
        <h3>アクティビティ</h3>
        <span>{state.events.length}</span>
      </div>
      <div className="activity-list">
        {state.events.slice(0, 8).map((event) => (
          <div className="activity-item" key={event.id}>
            <div className="activity-icon">
              {event.type === 'vision' ? <ScanLine size={16} /> : null}
              {event.type === 'inventory' ? <Refrigerator size={16} /> : null}
              {event.type === 'meal-plan' ? <CalendarDays size={16} /> : null}
              {event.type === 'recipe' ? <ChefHat size={16} /> : null}
            </div>
            <div>
              <strong>{event.title}</strong>
              <span>{event.detail}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default App
