export type IngredientCategory =
  | 'vegetable'
  | 'meat'
  | 'fish'
  | 'dairy'
  | 'egg'
  | 'staple'
  | 'soy'
  | 'fruit'
  | 'seasoning'
  | 'prepared'
  | 'other'

export type StorageLocation = 'pantry' | 'fridge' | 'freezer'

export type StockStatus = 'ok' | 'use-soon' | 'expired'

export type IntakeMode = 'intake' | 'consume'

export type CameraPlacement = 'bag_station' | 'fridge_front' | 'countertop' | 'unknown'

export interface CameraCalibration {
  placement: CameraPlacement
  lighting: 'dim' | 'normal' | 'bright'
  perspective: 'top_down' | 'front' | 'angled'
  regionOfInterest: {
    x: number
    y: number
    width: number
    height: number
  }
  stabilityFrames: number
  duplicateWindowMs: number
  lastCalibratedAt?: string
}

export interface IngredientStock {
  id: string
  name: string
  canonicalName: string
  category: IngredientCategory
  quantity: number
  unit: string
  storage: StorageLocation
  expiresAt: string
  addedAt: string
  updatedAt: string
  source: 'camera' | 'manual' | 'seed'
  confidence: number
  status: StockStatus
  notes?: string
}

export interface FamilyMember {
  id: string
  label: string
  ageGroup: 'adult' | 'child' | 'senior'
  appetite: 'small' | 'normal' | 'large'
}

export interface FamilyProfile {
  members: FamilyMember[]
  allergies: string[]
  dislikes: string[]
  favoriteStyles: string[]
  nutritionGoals: string[]
  recipeSourcePreferences: {
    preferredSites: string[]
    blockedSites: string[]
  }
  maxCookingMinutes: number
  weeklyBudgetYen: number
}

export interface RecipeIngredient {
  name: string
  canonicalName: string
  amount: number
  unit: string
  optional?: boolean
}

export interface Recipe {
  id: string
  title: string
  sourceName: string
  sourceUrl: string
  servings: number
  cookingMinutes: number
  tags: string[]
  nutrition: {
    calories: number
    proteinGram: number
    vegetableGram: number
    saltGram: number
  }
  ingredients: RecipeIngredient[]
  steps: string[]
  aiSummary: string
}

export interface MealSlot {
  title: string
  recipeId?: string
  stockUsed: string[]
  shoppingGaps: string[]
  prepNote: string
}

export interface MealPlanDay {
  date: string
  label: string
  breakfast: MealSlot
  lunch: MealSlot
  dinner: MealSlot
  nutritionFocus: string
}

export interface ShoppingListItem {
  name: string
  canonicalName: string
  quantity: number
  unit: string
  reason: string
}

export interface MealPlan {
  id: string
  generatedAt: string
  summary: string
  coveragePercent: number
  days: MealPlanDay[]
  shoppingList: ShoppingListItem[]
}

export interface VisionDetection {
  id: string
  mode: IntakeMode
  label: string
  canonicalName: string
  category: IngredientCategory
  quantity: number
  unit: string
  confidence: number
  trackId?: string
  frameCount?: number
  observedAt: string
  action:
    | 'added'
    | 'increased'
    | 'consumed'
    | 'removed'
    | 'ignored_duplicate'
    | 'needs_review'
  stockId?: string
  pipeline: {
    cvSignal: string
    llmSignal: string
    fusionNote: string
  }
}

export interface VisionTrack {
  id: string
  mode: IntakeMode
  label: string
  canonicalName: string
  firstSeenAt: string
  lastSeenAt: string
  frameCount: number
  bestConfidence: number
  detectionIds: string[]
  status: 'observing' | 'committed' | 'needs_review' | 'ignored'
}

export interface ReviewQueueItem {
  id: string
  detectionId: string
  detection: VisionDetection
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
  resolvedAt?: string
  note?: string
}

export interface ActivityEvent {
  id: string
  type: 'vision' | 'inventory' | 'meal-plan' | 'recipe'
  title: string
  detail: string
  createdAt: string
}

export interface SystemStatus {
  visionProvider: 'mock' | 'openai-ready' | 'azure-ready'
  recipeProvider: 'mock-web-research'
  cameraCadenceMs: number
  confidenceThreshold: number
  trackingWindowMs: number
}

export interface IntegrationStatus {
  name: string
  configured: boolean
  requiredEnvironment: string[]
  note: string
}

export interface KitchenState {
  inventory: IngredientStock[]
  familyProfile: FamilyProfile
  recipes: Recipe[]
  mealPlan?: MealPlan
  cameraCalibration: CameraCalibration
  detections: VisionDetection[]
  visionTracks: VisionTrack[]
  reviewQueue: ReviewQueueItem[]
  events: ActivityEvent[]
  status: SystemStatus
}

export interface VisionScanRequest {
  mode: IntakeMode
  imageData?: string
  imageUrl?: string
  demoCanonicalName?: string
}

export interface VisionScanResponse {
  detections: VisionDetection[]
  inventory: IngredientStock[]
  visionTracks: VisionTrack[]
  reviewQueue: ReviewQueueItem[]
  events: ActivityEvent[]
}
