import { randomUUID } from 'node:crypto'
import path from 'node:path'
import cors from 'cors'
import express from 'express'
import { z } from 'zod'
import type {
  CameraCalibration,
  IngredientCategory,
  StorageLocation,
  VisionScanRequest,
} from '../common/types.ts'
import { scanFrame, generateMealPlan, resolveReviewItem } from './ai.ts'
import { createEvent, readState, updateState } from './database.ts'
import { getIntegrationStatus } from './integrations.ts'

const app = express()
const port = Number(process.env.PORT ?? 8787)
const isProduction = process.env.NODE_ENV === 'production'
const clientDistPath = path.join(process.cwd(), 'dist')
const clientIndexPath = path.join(clientDistPath, 'index.html')

app.use(cors())
app.use(express.json({ limit: '12mb' }))

const categorySchema = z.enum([
  'vegetable',
  'meat',
  'fish',
  'dairy',
  'egg',
  'staple',
  'soy',
  'fruit',
  'seasoning',
  'prepared',
  'other',
])

const storageSchema = z.enum(['pantry', 'fridge', 'freezer'])

const stockSchema = z.object({
  name: z.string().min(1),
  canonicalName: z.string().min(1),
  category: categorySchema,
  quantity: z.number().positive(),
  unit: z.string().min(1),
  storage: storageSchema,
  expiresAt: z.string().min(1),
  notes: z.string().optional(),
})

const stockPatchSchema = stockSchema.partial().extend({
  quantity: z.number().min(0).optional(),
})

const familyProfileSchema = z.object({
  members: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      ageGroup: z.enum(['adult', 'child', 'senior']),
      appetite: z.enum(['small', 'normal', 'large']),
    }),
  ),
  allergies: z.array(z.string()),
  dislikes: z.array(z.string()),
  favoriteStyles: z.array(z.string()),
  nutritionGoals: z.array(z.string()),
  recipeSourcePreferences: z
    .object({
      preferredSites: z.array(z.string()),
      blockedSites: z.array(z.string()),
    })
    .optional(),
  maxCookingMinutes: z.number().int().min(5).max(180),
  weeklyBudgetYen: z.number().int().min(0),
})

const visionScanSchema = z.object({
  mode: z.enum(['intake', 'consume']),
  imageData: z.string().optional(),
  demoCanonicalName: z.string().optional(),
})

const cameraCalibrationSchema = z.object({
  placement: z.enum(['bag_station', 'fridge_front', 'countertop', 'unknown']),
  lighting: z.enum(['dim', 'normal', 'bright']),
  perspective: z.enum(['top_down', 'front', 'angled']),
  regionOfInterest: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().min(0.05).max(1),
    height: z.number().min(0.05).max(1),
  }),
  stabilityFrames: z.number().int().min(1).max(8),
  duplicateWindowMs: z.number().int().min(1000).max(120000),
  lastCalibratedAt: z.string().optional(),
})

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, service: 'kitchen-ai', port })
})

app.get('/api/integrations', (_request, response) => {
  response.json({ integrations: getIntegrationStatus() })
})

app.get('/api/state', async (_request, response, next) => {
  try {
    response.json(await readState())
  } catch (error) {
    next(error)
  }
})

app.patch('/api/family', async (request, response, next) => {
  try {
    const input = familyProfileSchema.parse(request.body)
    const familyProfile = {
      ...input,
      recipeSourcePreferences: input.recipeSourcePreferences ?? {
        preferredSites: [],
        blockedSites: [],
      },
    }
    const state = await updateState((current) => ({
      ...current,
      familyProfile,
      events: [
        createEvent('inventory', '家族設定を更新', '献立生成に使う家族構成と好みを保存しました。'),
        ...current.events,
      ],
    }))

    response.json(state.familyProfile)
  } catch (error) {
    next(error)
  }
})

app.post('/api/inventory', async (request, response, next) => {
  try {
    const input = stockSchema.parse(request.body)
    const createdAt = new Date().toISOString()

    const state = await updateState((current) => ({
      ...current,
      inventory: [
        {
          id: randomUUID(),
          ...input,
          category: input.category as IngredientCategory,
          storage: input.storage as StorageLocation,
          addedAt: createdAt,
          updatedAt: createdAt,
          source: 'manual',
          confidence: 1,
          status: 'ok',
        },
        ...current.inventory,
      ],
      events: [
        createEvent('inventory', `${input.name} を手動登録`, `${input.quantity}${input.unit} を追加しました。`),
        ...current.events,
      ],
    }))

    response.status(201).json(state.inventory[0])
  } catch (error) {
    next(error)
  }
})

app.patch('/api/inventory/:id', async (request, response, next) => {
  try {
    const patch = stockPatchSchema.parse(request.body)
    let found = false
    const state = await updateState((current) => ({
      ...current,
      inventory: current.inventory
        .map((item) => {
          if (item.id !== request.params.id) return item
          found = true
          return {
            ...item,
            ...patch,
            updatedAt: new Date().toISOString(),
          }
        })
        .filter((item) => item.quantity > 0),
      events: [
        createEvent('inventory', '在庫を更新', '数量、期限、保管場所のいずれかを更新しました。'),
        ...current.events,
      ],
    }))

    if (!found) {
      response.status(404).json({ message: 'ingredient not found' })
      return
    }

    response.json(state.inventory.find((item) => item.id === request.params.id) ?? null)
  } catch (error) {
    next(error)
  }
})

app.delete('/api/inventory/:id', async (request, response, next) => {
  try {
    let deletedName = ''
    const state = await updateState((current) => {
      const target = current.inventory.find((item) => item.id === request.params.id)
      deletedName = target?.name ?? ''

      return {
        ...current,
        inventory: current.inventory.filter((item) => item.id !== request.params.id),
        events: target
          ? [
              createEvent('inventory', `${target.name} を削除`, '在庫管理画面から手動で削除しました。'),
              ...current.events,
            ]
          : current.events,
      }
    })

    if (!deletedName) {
      response.status(404).json({ message: 'ingredient not found' })
      return
    }

    response.json({ ok: true, inventory: state.inventory })
  } catch (error) {
    next(error)
  }
})

app.post('/api/vision/scan', async (request, response, next) => {
  try {
    const input = visionScanSchema.parse(request.body) satisfies VisionScanRequest
    const state = await updateState((current) => scanFrame(current, input))
    const detections = state.detections.slice(0, 1)

    response.json({
      detections,
      inventory: state.inventory,
      visionTracks: state.visionTracks,
      reviewQueue: state.reviewQueue,
      events: state.events.slice(0, 10),
    })
  } catch (error) {
    next(error)
  }
})

app.patch('/api/camera/calibration', async (request, response, next) => {
  try {
    const calibration = cameraCalibrationSchema.parse(request.body) satisfies CameraCalibration
    const lastCalibratedAt = new Date().toISOString()
    const state = await updateState((current) => ({
      ...current,
      cameraCalibration: {
        ...calibration,
        lastCalibratedAt,
      },
      status: {
        ...current.status,
        trackingWindowMs: calibration.duplicateWindowMs,
      },
      events: [
        createEvent(
          'vision',
          'カメラ設定を保存',
          `検出エリアと集約ウィンドウ ${Math.round(calibration.duplicateWindowMs / 1000)} 秒を保存しました。`,
        ),
        ...current.events,
      ],
    }))

    response.json(state.cameraCalibration)
  } catch (error) {
    next(error)
  }
})

app.post('/api/meal-plan/generate', async (_request, response, next) => {
  try {
    const state = await updateState((current) => generateMealPlan(current))

    response.json({
      mealPlan: state.mealPlan,
      recipes: state.recipes,
      events: state.events.slice(0, 10),
    })
  } catch (error) {
    next(error)
  }
})

app.post('/api/review/:id/approve', async (request, response, next) => {
  try {
    const state = await updateState((current) =>
      resolveReviewItem(current, request.params.id, 'approve'),
    )

    response.json(state)
  } catch (error) {
    next(error)
  }
})

app.post('/api/review/:id/reject', async (request, response, next) => {
  try {
    const state = await updateState((current) =>
      resolveReviewItem(current, request.params.id, 'reject'),
    )

    response.json(state)
  } catch (error) {
    next(error)
  }
})

app.get('/api/recipes/:id', async (request, response, next) => {
  try {
    const state = await readState()
    const recipe = state.recipes.find((item) => item.id === request.params.id)

    if (!recipe) {
      response.status(404).json({ message: 'recipe not found' })
      return
    }

    response.json(recipe)
  } catch (error) {
    next(error)
  }
})

if (isProduction) {
  app.use(express.static(clientDistPath))
  app.use((request, response, next) => {
    if (request.path.startsWith('/api')) {
      next()
      return
    }

    response.sendFile(clientIndexPath, (error) => {
      if (error) next(error)
    })
  })
}

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  void _next

  if (error instanceof z.ZodError) {
    response.status(400).json({ message: 'validation error', issues: error.issues })
    return
  }

  console.error(error)
  response.status(500).json({ message: 'internal server error' })
})

app.listen(port, () => {
  console.log(`Kitchen AI API listening on http://localhost:${port}`)
})
