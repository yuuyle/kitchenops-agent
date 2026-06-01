import { randomUUID } from 'node:crypto'
import type {
  IngredientStock,
  IntakeMode,
  KitchenState,
  MealPlan,
  MealSlot,
  Recipe,
  RecipeIngredient,
  ReviewQueueItem,
  ShoppingListItem,
  VisionDetection,
  VisionScanRequest,
  VisionTrack,
} from '../common/types.ts'
import { classifyFoodWithAzureAi } from './azureAi.ts'
import { addDaysIso, nowIso, recipeCatalog, visionCandidates } from './catalog.ts'
import { createEvent } from './database.ts'

const japaneseWeekdays = ['日', '月', '火', '水', '木', '金', '土']

const hashImage = (imageData?: string) => {
  const seed = imageData ? imageData.slice(-600) : `${Date.now()}`
  let hash = 0

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }

  return hash
}

const stockDisplay = (item: IngredientStock) => `${item.name} ${item.quantity}${item.unit}`

const findStock = (inventory: IngredientStock[], canonicalName: string) =>
  inventory.find((item) => item.canonicalName === canonicalName)

const findRecentTrack = (
  tracks: VisionTrack[],
  mode: IntakeMode,
  canonicalName: string,
  duplicateWindowMs: number,
) => {
  const cutoff = Date.now() - duplicateWindowMs

  return tracks.find(
    (track) =>
      track.mode === mode &&
      track.canonicalName === canonicalName &&
      new Date(track.lastSeenAt).getTime() > cutoff,
  )
}

const statusForDetection = (detection: VisionDetection): VisionTrack['status'] => {
  if (detection.action === 'needs_review') return 'needs_review'
  if (detection.action === 'ignored_duplicate') return 'ignored'
  return 'committed'
}

const createStockFromDetection = (
  detection: VisionDetection,
  storage: IngredientStock['storage'],
  shelfLifeDays: number,
): IngredientStock => ({
  id: randomUUID(),
  name: detection.label,
  canonicalName: detection.canonicalName,
  category: detection.category,
  quantity: detection.quantity,
  unit: detection.unit,
  storage,
  expiresAt: addDaysIso(shelfLifeDays),
  addedAt: nowIso(),
  updatedAt: nowIso(),
  source: 'camera',
  confidence: detection.confidence,
  status: 'ok',
})

const createDetection = async (
  mode: IntakeMode,
  request: VisionScanRequest,
): Promise<{
  detection: VisionDetection
  storage: IngredientStock['storage']
  shelfLifeDays: number
}> => {
  if (!request.demoCanonicalName && (request.imageData || request.imageUrl)) {
    try {
      const aiCandidate = await classifyFoodWithAzureAi(request)

      if (aiCandidate) {
        return {
          storage: aiCandidate.storage,
          shelfLifeDays: aiCandidate.shelfLifeDays,
          detection: {
            id: randomUUID(),
            mode,
            label: aiCandidate.label,
            canonicalName: aiCandidate.canonicalName,
            category: aiCandidate.category,
            quantity: aiCandidate.quantity,
            unit: aiCandidate.unit,
            confidence: aiCandidate.confidence,
            observedAt: nowIso(),
            action: 'needs_review',
            pipeline: aiCandidate.pipeline,
          },
        }
      }
    } catch (error) {
      console.warn('Azure AI food classification failed. Falling back to local candidate.', error)
    }
  }

  const hash = hashImage(request.imageData ?? request.imageUrl)
  const demoCandidate = request.demoCanonicalName
    ? visionCandidates.find((item) => item.canonicalName === request.demoCanonicalName)
    : undefined
  const candidate = demoCandidate ?? visionCandidates[hash % visionCandidates.length]
  const confidence = demoCandidate ? 0.92 : Math.min(0.96, 0.72 + ((hash % 24) / 100))
  const signalStrength = demoCandidate
    ? 'デモサンプル'
    : request.imageData
      ? 'フレーム差分あり'
      : 'デモフレーム'

  return {
    storage: candidate.storage,
    shelfLifeDays: candidate.shelfLifeDays,
    detection: {
      id: randomUUID(),
      mode,
      label: candidate.label,
      canonicalName: candidate.canonicalName,
      category: candidate.category,
      quantity: candidate.quantity,
      unit: candidate.unit,
      confidence,
      observedAt: nowIso(),
      action: confidence >= 0.76 ? 'needs_review' : 'needs_review',
      pipeline: {
        cvSignal: `${signalStrength}: 色ヒストグラム、輪郭、移動物体領域を抽出`,
        llmSignal: `LLM画像認識候補: ${candidate.label}`,
        fusionNote: `CV候補とLLM候補を統合し、信頼度 ${Math.round(confidence * 100)}% で判定`,
      },
    },
  }
}

const candidateForDetection = (detection: VisionDetection) =>
  visionCandidates.find((candidate) => candidate.canonicalName === detection.canonicalName) ?? {
    storage: 'fridge' as const,
    shelfLifeDays: 3,
  }

const createReviewItem = (detection: VisionDetection, reason: string): ReviewQueueItem => ({
  id: randomUUID(),
  detectionId: detection.id,
  detection: { ...detection },
  reason,
  status: 'pending',
  createdAt: nowIso(),
})

export const scanFrame = async (
  state: KitchenState,
  request: VisionScanRequest,
): Promise<KitchenState> => {
  const candidate = await createDetection(request.mode, request)
  const detection = candidate.detection
  const events = [...state.events]
  let inventory = [...state.inventory]
  let visionTracks = [...(state.visionTracks ?? [])]
  const reviewQueue = [...(state.reviewQueue ?? [])]
  const duplicateWindowMs =
    state.cameraCalibration?.duplicateWindowMs ??
    state.status.trackingWindowMs ??
    18_000
  const recentTrack = findRecentTrack(
    visionTracks,
    detection.mode,
    detection.canonicalName,
    duplicateWindowMs,
  )
  if (!recentTrack) {
    detection.trackId = randomUUID()
    detection.frameCount = 1
  }
  const enqueueReview = (reason: string) => {
    const pendingDuplicate = reviewQueue.some(
      (item) =>
        item.status === 'pending' &&
        item.detection.mode === detection.mode &&
        item.detection.canonicalName === detection.canonicalName,
    )

    if (!pendingDuplicate) {
      reviewQueue.unshift(createReviewItem(detection, reason))
    }
  }

  if (recentTrack) {
    detection.trackId = recentTrack.id
    detection.frameCount = recentTrack.frameCount + 1
    detection.action = 'ignored_duplicate'
    detection.pipeline.fusionNote = `${detection.pipeline.fusionNote}。既存トラック ${recentTrack.id.slice(0, 8)} に集約`
    visionTracks = visionTracks.map((track) =>
      track.id === recentTrack.id
        ? {
            ...track,
            lastSeenAt: detection.observedAt,
            frameCount: track.frameCount + 1,
            bestConfidence: Math.max(track.bestConfidence, detection.confidence),
            detectionIds: [detection.id, ...track.detectionIds].slice(0, 12),
            status: track.status === 'needs_review' ? 'needs_review' : track.status,
          }
        : track,
    )
  } else if (detection.confidence < state.status.confidenceThreshold) {
    detection.action = 'needs_review'
    enqueueReview(`${detection.label} の信頼度が閾値未満です。`)
    events.unshift(
      createEvent(
        'vision',
        '確認が必要な候補',
        `${detection.label} の信頼度が閾値未満です。手動確認に回しました。`,
      ),
    )
  } else if (request.mode === 'intake') {
    const existing = findStock(inventory, detection.canonicalName)

    if (existing && existing.unit === detection.unit) {
      detection.action = 'increased'
      detection.stockId = existing.id
      inventory = inventory.map((item) =>
        item.id === existing.id
          ? {
              ...item,
              quantity: item.quantity + detection.quantity,
              confidence: Math.max(item.confidence, detection.confidence),
              updatedAt: nowIso(),
            }
          : item,
      )
      events.unshift(
        createEvent(
          'vision',
          `${detection.label} を在庫に加算`,
          `${detection.quantity}${detection.unit} を追加し、合計を更新しました。`,
        ),
      )
    } else {
      detection.action = 'added'
      const stockItem = createStockFromDetection(detection, candidate.storage, candidate.shelfLifeDays)
      detection.stockId = stockItem.id
      inventory.unshift(stockItem)
      events.unshift(
        createEvent(
          'vision',
          `${detection.label} を登録`,
          `${detection.quantity}${detection.unit} を ${stockItem.storage} 在庫に追加しました。`,
        ),
      )
    }
  } else {
    const existing = findStock(inventory, detection.canonicalName)

    if (!existing) {
      detection.action = 'needs_review'
      enqueueReview(`${detection.label} が在庫にない状態で使用判定されました。`)
      events.unshift(
        createEvent(
          'vision',
          `${detection.label} は在庫未登録`,
          '使用判定されましたが、該当する在庫が見つかりませんでした。',
        ),
      )
    } else if (existing.quantity > detection.quantity && existing.unit === detection.unit) {
      detection.action = 'consumed'
      detection.stockId = existing.id
      inventory = inventory.map((item) =>
        item.id === existing.id
          ? {
              ...item,
              quantity: Math.max(0, item.quantity - detection.quantity),
              updatedAt: nowIso(),
            }
          : item,
      )
      events.unshift(
        createEvent(
          'vision',
          `${detection.label} を使用`,
          `${detection.quantity}${detection.unit} 使用として在庫から差し引きました。`,
        ),
      )
    } else {
      detection.action = 'removed'
      detection.stockId = existing.id
      inventory = inventory.filter((item) => item.id !== existing.id)
      events.unshift(
        createEvent(
          'vision',
          `${detection.label} を使い切り`,
          `${stockDisplay(existing)} を在庫から削除しました。`,
        ),
      )
    }
  }

  if (!recentTrack) {
    const track: VisionTrack = {
      id: detection.trackId ?? randomUUID(),
      mode: detection.mode,
      label: detection.label,
      canonicalName: detection.canonicalName,
      firstSeenAt: detection.observedAt,
      lastSeenAt: detection.observedAt,
      frameCount: 1,
      bestConfidence: detection.confidence,
      detectionIds: [detection.id],
      status: statusForDetection(detection),
    }

    detection.frameCount = track.frameCount
    visionTracks.unshift(track)
  }

  return {
    ...state,
    inventory,
    detections: [detection, ...state.detections],
    visionTracks,
    reviewQueue,
    events,
  }
}

export const resolveReviewItem = (
  state: KitchenState,
  reviewId: string,
  decision: 'approve' | 'reject',
): KitchenState => {
  const target = (state.reviewQueue ?? []).find((item) => item.id === reviewId)

  if (!target || target.status !== 'pending') return state

  const detection: VisionDetection = { ...target.detection }
  let inventory = [...state.inventory]
  const visionTracks = [...(state.visionTracks ?? [])]
  const events = [...state.events]

  if (decision === 'reject') {
    events.unshift(
      createEvent(
        'vision',
        `${detection.label} を却下`,
        '確認キューの候補を在庫に反映せず、却下しました。',
      ),
    )
  } else if (detection.mode === 'intake') {
    const candidate = candidateForDetection(detection)
    const existing = findStock(inventory, detection.canonicalName)

    if (existing && existing.unit === detection.unit) {
      detection.action = 'increased'
      detection.stockId = existing.id
      inventory = inventory.map((item) =>
        item.id === existing.id
          ? {
              ...item,
              quantity: item.quantity + detection.quantity,
              confidence: Math.max(item.confidence, detection.confidence),
              updatedAt: nowIso(),
            }
          : item,
      )
      events.unshift(
        createEvent(
          'vision',
          `${detection.label} を承認して加算`,
          `${detection.quantity}${detection.unit} を在庫に反映しました。`,
        ),
      )
    } else {
      detection.action = 'added'
      const stockItem = createStockFromDetection(detection, candidate.storage, candidate.shelfLifeDays)
      detection.stockId = stockItem.id
      inventory.unshift(stockItem)
      events.unshift(
        createEvent(
          'vision',
          `${detection.label} を承認して登録`,
          `${detection.quantity}${detection.unit} を在庫に追加しました。`,
        ),
      )
    }
  } else {
    const existing = findStock(inventory, detection.canonicalName)

    if (!existing) {
      events.unshift(
        createEvent(
          'vision',
          `${detection.label} の使用候補を承認`,
          '在庫がないため数量変更はせず、使用履歴として承認しました。',
        ),
      )
    } else if (existing.quantity > detection.quantity && existing.unit === detection.unit) {
      detection.action = 'consumed'
      detection.stockId = existing.id
      inventory = inventory.map((item) =>
        item.id === existing.id
          ? {
              ...item,
              quantity: Math.max(0, item.quantity - detection.quantity),
              updatedAt: nowIso(),
            }
          : item,
      )
      events.unshift(
        createEvent(
          'vision',
          `${detection.label} の使用を承認`,
          `${detection.quantity}${detection.unit} を在庫から差し引きました。`,
        ),
      )
    } else {
      detection.action = 'removed'
      detection.stockId = existing.id
      inventory = inventory.filter((item) => item.id !== existing.id)
      events.unshift(
        createEvent(
          'vision',
          `${detection.label} の使い切りを承認`,
          `${stockDisplay(existing)} を在庫から削除しました。`,
        ),
      )
    }
  }

  return {
    ...state,
    inventory,
    visionTracks: visionTracks.map((track) =>
      track.id === detection.trackId
        ? {
            ...track,
            status: decision === 'approve' ? statusForDetection(detection) : 'ignored',
            bestConfidence: Math.max(track.bestConfidence, detection.confidence),
          }
        : track,
    ),
    detections: state.detections.map((item) =>
      item.id === detection.id ? { ...item, ...detection } : item,
    ),
    reviewQueue: state.reviewQueue.map((item) =>
      item.id === reviewId
        ? {
            ...item,
            detection,
            status: decision === 'approve' ? 'approved' : 'rejected',
            resolvedAt: nowIso(),
          }
        : item,
    ),
    events,
  }
}

const availableByCanonicalName = (inventory: IngredientStock[]) => {
  const map = new Map<string, number>()

  for (const item of inventory) {
    map.set(item.canonicalName, (map.get(item.canonicalName) ?? 0) + item.quantity)
  }

  return map
}

const ingredientIsAvailable = (available: Map<string, number>, ingredient: RecipeIngredient) => {
  const stockAmount = available.get(ingredient.canonicalName) ?? 0
  return stockAmount >= ingredient.amount || (ingredient.optional && stockAmount > 0)
}

const recipeScore = (recipe: Recipe, state: KitchenState) => {
  const available = availableByCanonicalName(state.inventory)
  const allergies = state.familyProfile.allergies.filter((allergy) => allergy !== 'なし')
  const allergyPenalty = recipe.ingredients.some((ingredient) =>
    allergies.some((allergy) => ingredient.name.includes(allergy)),
  )
  const dislikePenalty = state.familyProfile.dislikes.some((dislike) => recipe.title.includes(dislike))
  const matched = recipe.ingredients.filter((ingredient) =>
    ingredientIsAvailable(available, ingredient),
  ).length
  const useSoon = recipe.ingredients.filter((ingredient) =>
    state.inventory.some(
      (item) => item.canonicalName === ingredient.canonicalName && item.status === 'use-soon',
    ),
  ).length
  const preference = recipe.tags.filter((tag) =>
    state.familyProfile.favoriteStyles.some((style) => tag.includes(style) || style.includes(tag)),
  ).length
  const timeFit = recipe.cookingMinutes <= state.familyProfile.maxCookingMinutes ? 1 : -1

  return matched * 12 + useSoon * 8 + preference * 6 + timeFit * 4 - (allergyPenalty ? 500 : 0) - (dislikePenalty ? 40 : 0)
}

const gapsForRecipe = (recipe: Recipe, inventory: IngredientStock[]) => {
  const available = availableByCanonicalName(inventory)

  return recipe.ingredients
    .filter((ingredient) => !ingredient.optional)
    .filter((ingredient) => (available.get(ingredient.canonicalName) ?? 0) < ingredient.amount)
    .map((ingredient) => ingredient.name)
}

const usedStockForRecipe = (recipe: Recipe, inventory: IngredientStock[]) => {
  const available = availableByCanonicalName(inventory)

  return recipe.ingredients
    .filter((ingredient) => (available.get(ingredient.canonicalName) ?? 0) > 0)
    .map((ingredient) => ingredient.name)
}

const slotFromRecipe = (recipe: Recipe, inventory: IngredientStock[], note: string): MealSlot => ({
  title: recipe.title,
  recipeId: recipe.id,
  stockUsed: usedStockForRecipe(recipe, inventory),
  shoppingGaps: gapsForRecipe(recipe, inventory),
  prepNote: note,
})

const aggregateShoppingList = (recipes: Recipe[], inventory: IngredientStock[]): ShoppingListItem[] => {
  const required = new Map<string, ShoppingListItem>()
  const available = availableByCanonicalName(inventory)

  for (const recipe of recipes) {
    for (const ingredient of recipe.ingredients) {
      if (ingredient.optional) continue

      const current = required.get(ingredient.canonicalName)
      required.set(ingredient.canonicalName, {
        name: ingredient.name,
        canonicalName: ingredient.canonicalName,
        quantity: (current?.quantity ?? 0) + ingredient.amount,
        unit: ingredient.unit,
        reason: '1週間献立で不足',
      })
    }
  }

  return [...required.values()]
    .map((item) => ({
      ...item,
      quantity: Math.max(0, item.quantity - (available.get(item.canonicalName) ?? 0)),
    }))
    .filter((item) => item.quantity > 0)
}

const planCoverage = (recipes: Recipe[], inventory: IngredientStock[]) => {
  const available = availableByCanonicalName(inventory)
  const required = recipes.flatMap((recipe) => recipe.ingredients.filter((ingredient) => !ingredient.optional))

  if (required.length === 0) return 100

  const covered = required.filter((ingredient) => (available.get(ingredient.canonicalName) ?? 0) > 0).length
  return Math.round((covered / required.length) * 100)
}

export const generateMealPlan = (state: KitchenState): KitchenState => {
  const rankedRecipes = [...recipeCatalog].sort((a, b) => recipeScore(b, state) - recipeScore(a, state))
  const selectedDinnerRecipes = Array.from({ length: 7 }, (_, index) => rankedRecipes[index % rankedRecipes.length])
  const breakfastPool = rankedRecipes.filter((recipe) => recipe.tags.includes('朝食'))
  const lunchPool = rankedRecipes.filter((recipe) => recipe.tags.includes('昼食') || recipe.tags.includes('作り置き'))
  const usedRecipes: Recipe[] = []
  const days = selectedDinnerRecipes.map((dinner, index) => {
    const date = new Date(Date.now() + index * 24 * 60 * 60 * 1000)
    const label = `${date.getMonth() + 1}/${date.getDate()}(${japaneseWeekdays[date.getDay()]})`
    const breakfast = breakfastPool[index % breakfastPool.length] ?? rankedRecipes[(index + 2) % rankedRecipes.length]
    const lunch = lunchPool[index % lunchPool.length] ?? rankedRecipes[(index + 3) % rankedRecipes.length]

    usedRecipes.push(breakfast, lunch, dinner)

    return {
      date: date.toISOString(),
      label,
      breakfast: slotFromRecipe(breakfast, state.inventory, '朝は火入れ少なめで組み立てる'),
      lunch: slotFromRecipe(lunch, state.inventory, '夕食の残りか作り置きに寄せる'),
      dinner: slotFromRecipe(dinner, state.inventory, '期限が近い食材から優先して使う'),
      nutritionFocus:
        dinner.nutrition.proteinGram >= 30
          ? 'たんぱく質を厚めに確保'
          : '野菜量と主食のバランスを優先',
    }
  })

  const mealPlan: MealPlan = {
    id: randomUUID(),
    generatedAt: nowIso(),
    summary: '在庫消費、家族構成、時短、栄養目標をもとに1週間の献立を生成しました。',
    coveragePercent: planCoverage(usedRecipes, state.inventory),
    days,
    shoppingList: aggregateShoppingList(usedRecipes, state.inventory),
  }

  return {
    ...state,
    recipes: recipeCatalog,
    mealPlan,
    events: [
      createEvent(
        'meal-plan',
        '1週間の献立を生成',
        `在庫カバー率 ${mealPlan.coveragePercent}%、買い足し ${mealPlan.shoppingList.length} 件です。`,
      ),
      ...state.events,
    ],
  }
}
