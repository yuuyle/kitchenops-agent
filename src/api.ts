import type {
  FamilyProfile,
  CameraCalibration,
  IngredientStock,
  IntegrationStatus,
  IntakeMode,
  KitchenState,
  MealPlan,
  Recipe,
  VisionScanResponse,
} from '../common/types.ts'

const requestJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<T>
}

export const api = {
  getState: () => requestJson<KitchenState>('/api/state'),
  getIntegrations: () => requestJson<{ integrations: IntegrationStatus[] }>('/api/integrations'),
  saveFamily: (familyProfile: FamilyProfile) =>
    requestJson<FamilyProfile>('/api/family', {
      method: 'PATCH',
      body: JSON.stringify(familyProfile),
    }),
  createStock: (stock: Omit<IngredientStock, 'id' | 'addedAt' | 'updatedAt' | 'source' | 'confidence' | 'status'>) =>
    requestJson<IngredientStock>('/api/inventory', {
      method: 'POST',
      body: JSON.stringify(stock),
    }),
  updateStock: (id: string, patch: Partial<IngredientStock>) =>
    requestJson<IngredientStock | null>(`/api/inventory/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deleteStock: (id: string) =>
    requestJson<{ ok: boolean; inventory: IngredientStock[] }>(`/api/inventory/${id}`, {
      method: 'DELETE',
    }),
  scanFrame: (mode: IntakeMode, imageData?: string, demoCanonicalName?: string, imageUrl?: string) =>
    requestJson<VisionScanResponse>('/api/vision/scan', {
      method: 'POST',
      body: JSON.stringify({ mode, imageData, demoCanonicalName, imageUrl }),
    }),
  saveCameraCalibration: (calibration: CameraCalibration) =>
    requestJson<CameraCalibration>('/api/camera/calibration', {
      method: 'PATCH',
      body: JSON.stringify(calibration),
    }),
  generateMealPlan: () =>
    requestJson<{ mealPlan: MealPlan; recipes: Recipe[] }>('/api/meal-plan/generate', {
      method: 'POST',
    }),
  approveReview: (id: string) =>
    requestJson<KitchenState>(`/api/review/${id}/approve`, {
      method: 'POST',
    }),
  rejectReview: (id: string) =>
    requestJson<KitchenState>(`/api/review/${id}/reject`, {
      method: 'POST',
    }),
}
