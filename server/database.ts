import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type {
  ActivityEvent,
  CameraCalibration,
  IngredientStock,
  KitchenState,
  StockStatus,
} from '../common/types.ts'
import { defaultFamilyProfile, defaultInventory, nowIso, recipeCatalog } from './catalog.ts'

const dataDir = path.join(process.cwd(), 'data')
const configuredDataDir = process.env.KITCHEN_DATA_DIR
const resolvedDataDir = configuredDataDir ? path.resolve(configuredDataDir) : dataDir
const sqlitePath = path.join(resolvedDataDir, 'kitchen.sqlite')
const legacyJsonPath = path.join(resolvedDataDir, 'kitchen.json')
const fallbackJsonPath = path.join(resolvedDataDir, 'kitchen.runtime.json')
const stateKey = 'kitchen-state'

type SqliteStatement = {
  get: (...values: unknown[]) => unknown
  run: (...values: unknown[]) => unknown
}

type SqliteDatabase = {
  exec: (sql: string) => void
  prepare: (sql: string) => SqliteStatement
}

let database: SqliteDatabase | undefined
let sqliteUnavailable = false

const defaultCameraCalibration: CameraCalibration = {
  placement: 'unknown',
  lighting: 'normal',
  perspective: 'angled',
  regionOfInterest: {
    x: 0.18,
    y: 0.16,
    width: 0.64,
    height: 0.68,
  },
  stabilityFrames: 2,
  duplicateWindowMs: 18_000,
}

const statusFor = (expiresAt: string): StockStatus => {
  const expires = new Date(expiresAt).getTime()
  const today = Date.now()
  const diffDays = Math.ceil((expires - today) / (24 * 60 * 60 * 1000))

  if (diffDays < 0) return 'expired'
  if (diffDays <= 3) return 'use-soon'
  return 'ok'
}

const normalizeStock = (item: IngredientStock): IngredientStock => ({
  ...item,
  status: statusFor(item.expiresAt),
})

const normalizeState = (state: KitchenState): KitchenState => ({
  ...state,
  familyProfile: {
    ...state.familyProfile,
    recipeSourcePreferences: state.familyProfile.recipeSourcePreferences ?? {
      preferredSites: [],
      blockedSites: [],
    },
  },
  recipes: state.recipes?.length ? state.recipes : recipeCatalog,
  cameraCalibration: {
    ...defaultCameraCalibration,
    ...(state.cameraCalibration ?? {}),
    regionOfInterest: {
      ...defaultCameraCalibration.regionOfInterest,
      ...(state.cameraCalibration?.regionOfInterest ?? {}),
    },
  },
  visionTracks: (state.visionTracks ?? []).slice(0, 80),
  reviewQueue: (state.reviewQueue ?? []).slice(0, 80),
  inventory: state.inventory
    .filter((item) => item.quantity > 0)
    .map(normalizeStock)
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt)),
  detections: state.detections.slice(0, 80),
  events: state.events.slice(0, 80),
  status: {
    visionProvider: process.env.OPENAI_API_KEY ? 'openai-ready' : 'mock',
    recipeProvider: state.status?.recipeProvider ?? 'mock-web-research',
    cameraCadenceMs: state.status?.cameraCadenceMs ?? 2600,
    confidenceThreshold: state.status?.confidenceThreshold ?? 0.76,
    trackingWindowMs:
      state.status?.trackingWindowMs ??
      state.cameraCalibration?.duplicateWindowMs ??
      defaultCameraCalibration.duplicateWindowMs,
  },
})

export const createEvent = (
  type: ActivityEvent['type'],
  title: string,
  detail: string,
): ActivityEvent => ({
  id: randomUUID(),
  type,
  title,
  detail,
  createdAt: nowIso(),
})

const createInitialState = (): KitchenState => ({
  inventory: defaultInventory.map(normalizeStock),
  familyProfile: defaultFamilyProfile,
  recipes: recipeCatalog,
  cameraCalibration: defaultCameraCalibration,
  detections: [],
  visionTracks: [],
  reviewQueue: [],
  events: [
    createEvent(
      'inventory',
      '初期データを登録',
      'サンプル食材、家族構成、レシピ候補を読み込みました。',
    ),
  ],
  status: {
    visionProvider: process.env.OPENAI_API_KEY ? 'openai-ready' : 'mock',
    recipeProvider: 'mock-web-research',
    cameraCadenceMs: 2600,
    confidenceThreshold: 0.76,
    trackingWindowMs: defaultCameraCalibration.duplicateWindowMs,
  },
})

const openDatabase = async (): Promise<SqliteDatabase | undefined> => {
  if (database) return database
  if (sqliteUnavailable) return undefined

  await fs.mkdir(resolvedDataDir, { recursive: true })

  try {
    const sqlite = await import('node:sqlite')
    const nextDatabase = new sqlite.DatabaseSync(sqlitePath) as unknown as SqliteDatabase
    nextDatabase.exec(`
      CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `)
    database = nextDatabase
  } catch (error) {
    sqliteUnavailable = true
    console.warn('SQLite is unavailable. Falling back to JSON persistence.', error)
    return undefined
  }

  return database
}

const readLegacyJson = async (): Promise<KitchenState | undefined> => {
  try {
    const raw = await fs.readFile(legacyJsonPath, 'utf-8')
    return JSON.parse(raw) as KitchenState
  } catch {
    return undefined
  }
}

const readFallbackJson = async (): Promise<KitchenState | undefined> => {
  try {
    const raw = await fs.readFile(fallbackJsonPath, 'utf-8')
    return JSON.parse(raw) as KitchenState
  } catch {
    return undefined
  }
}

const getStoredState = (db: SqliteDatabase): KitchenState | undefined => {
  const row = db
    .prepare('SELECT value FROM app_state WHERE key = ?')
    .get(stateKey) as { value: string } | undefined

  if (!row) return undefined
  return JSON.parse(row.value) as KitchenState
}

const persistState = (db: SqliteDatabase, state: KitchenState) => {
  const normalized = normalizeState(state)

  db.prepare(
    `
      INSERT INTO app_state (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `,
  ).run(stateKey, JSON.stringify(normalized, null, 2), nowIso())

  db.prepare(
    `
      INSERT INTO app_meta (key, value)
      VALUES ('storage_provider', 'sqlite')
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `,
  ).run()

  return normalized
}

const persistJsonState = async (state: KitchenState) => {
  const normalized = normalizeState(state)

  await fs.mkdir(resolvedDataDir, { recursive: true })
  await fs.writeFile(fallbackJsonPath, JSON.stringify(normalized, null, 2))

  return normalized
}

const ensureState = async () => {
  const db = await openDatabase()

  if (!db) {
    const stored = await readFallbackJson()
    if (stored) return normalizeState(stored)

    const migrated = await readLegacyJson()
    const initial = migrated ?? createInitialState()
    return persistJsonState(initial)
  }

  const stored = getStoredState(db)

  if (stored) return normalizeState(stored)

  const migrated = await readLegacyJson()
  const initial = migrated ?? createInitialState()
  return persistState(db, initial)
}

export const readState = async (): Promise<KitchenState> => ensureState()

export const writeState = async (state: KitchenState): Promise<KitchenState> => {
  const db = await openDatabase()
  if (!db) return persistJsonState(state)

  return persistState(db, state)
}

export const updateState = async (
  updater: (state: KitchenState) => KitchenState | Promise<KitchenState>,
) => {
  const state = await readState()
  const next = await updater(state)
  return writeState(next)
}
