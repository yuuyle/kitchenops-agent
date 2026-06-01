import type {
  IngredientCategory,
  IngredientStock,
  VisionScanRequest,
} from '../common/types.ts'
import { visionCandidates } from './catalog.ts'

type JsonRecord = Record<string, unknown>

export interface AzureFoodCandidate {
  label: string
  canonicalName: string
  category: IngredientCategory
  quantity: number
  unit: string
  storage: IngredientStock['storage']
  shelfLifeDays: number
  confidence: number
  pipeline: {
    cvSignal: string
    llmSignal: string
    fusionNote: string
  }
}

const categories: IngredientCategory[] = [
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
]

const ingredientHints: Record<string, string[]> = {
  tomato: ['tomato', 'トマト', 'fresh tomato', 'red tomato'],
  milk: ['milk', '牛乳', 'carton milk', 'milk bottle'],
  pork_slices: ['pork', '豚こま肉', 'sliced pork', 'pork slices'],
  cabbage: ['cabbage', 'キャベツ', 'green cabbage'],
  banana: ['banana', 'バナナ', 'bananas'],
  potato: ['potato', 'じゃがいも', 'potatoes'],
}

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')

const required = (key: string) => process.env[key]?.trim() ?? ''

const optional = (key: string, fallback: string) => process.env[key]?.trim() || fallback

export const azureOpenAiConfigured = () =>
  Boolean(
    required('AZURE_OPENAI_ENDPOINT') &&
      required('AZURE_OPENAI_API_KEY') &&
      required('AZURE_OPENAI_DEPLOYMENT'),
  )

export const azureAiVisionConfigured = () =>
  Boolean(required('AZURE_AI_VISION_ENDPOINT') && required('AZURE_AI_VISION_API_KEY'))

export const azureAiFoodPipelineConfigured = () =>
  azureOpenAiConfigured() && azureAiVisionConfigured()

const asRecord = (value: unknown): JsonRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {}

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

const stringValue = (value: unknown) => (typeof value === 'string' ? value : undefined)

const numberValue = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined)

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const parseJsonResponse = async (response: Response) => {
  const text = await response.text()

  try {
    return { text, json: JSON.parse(text) as unknown }
  } catch {
    return { text, json: undefined }
  }
}

const assertOk = async (label: string, response: Response) => {
  const parsed = await parseJsonResponse(response)

  if (!response.ok) {
    const detail = parsed.json ? JSON.stringify(parsed.json, null, 2) : parsed.text
    throw new Error(`${label} failed: HTTP ${response.status}\n${detail}`)
  }

  return parsed.json
}

const dataUrlToBuffer = (dataUrl: string) => {
  const match = dataUrl.match(/^data:([^;,]+)?;base64,(.+)$/)

  if (!match) {
    throw new Error('imageData must be a base64 data URL')
  }

  return {
    contentType: match[1] ?? 'application/octet-stream',
    body: Buffer.from(match[2], 'base64'),
  }
}

const openAiV1ChatUrl = (endpoint: string) => {
  const trimmed = trimTrailingSlash(endpoint)

  if (trimmed.endsWith('/openai/v1/chat/completions')) return trimmed
  if (trimmed.endsWith('/openai/v1')) return `${trimmed}/chat/completions`

  return undefined
}

const analyzeWithAzureVision = async (request: VisionScanRequest) => {
  const endpoint = trimTrailingSlash(required('AZURE_AI_VISION_ENDPOINT'))
  const apiKey = required('AZURE_AI_VISION_API_KEY')
  const apiVersion = optional('AZURE_AI_VISION_API_VERSION', '2024-02-01')
  const features = optional('AZURE_AI_VISION_FEATURES', 'caption,tags,objects')
  const url = `${endpoint}/computervision/imageanalysis:analyze?features=${encodeURIComponent(
    features,
  )}&language=en&api-version=${encodeURIComponent(apiVersion)}`

  const bodyFromDataUrl = request.imageData ? dataUrlToBuffer(request.imageData) : undefined
  const response = await fetch(url, {
    method: 'POST',
    headers: bodyFromDataUrl
      ? {
          'Content-Type': bodyFromDataUrl.contentType,
          'Ocp-Apim-Subscription-Key': apiKey,
        }
      : {
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': apiKey,
        },
    body: bodyFromDataUrl?.body ?? JSON.stringify({ url: request.imageUrl }),
  })

  return assertOk('Azure AI Vision image analysis', response)
}

const summarizeVisionAnalysis = (analysis: unknown) => {
  const root = asRecord(analysis)
  const caption = stringValue(asRecord(root.captionResult).text)
  const tags = asArray(asRecord(root.tagsResult).values)
    .map((item) => stringValue(asRecord(item).name))
    .filter((value): value is string => Boolean(value))
    .slice(0, 14)
  const objects = asArray(asRecord(root.objectsResult).values)
    .flatMap((item) =>
      asArray(asRecord(item).tags).map((tag) => stringValue(asRecord(tag).name)),
    )
    .filter((value): value is string => Boolean(value))
    .slice(0, 10)

  const lines = [
    caption ? `caption=${caption}` : undefined,
    tags.length ? `tags=${tags.join(', ')}` : undefined,
    objects.length ? `objects=${objects.join(', ')}` : undefined,
  ].filter((value): value is string => Boolean(value))

  return {
    caption,
    tags,
    objects,
    summary: lines.join('\n') || 'No caption, tags, or objects returned.',
  }
}

const chatWithAzureOpenAI = async (visionSummary: string) => {
  const endpoint = trimTrailingSlash(required('AZURE_OPENAI_ENDPOINT'))
  const apiKey = required('AZURE_OPENAI_API_KEY')
  const deployment = required('AZURE_OPENAI_DEPLOYMENT')
  const v1ChatUrl = openAiV1ChatUrl(endpoint)
  const useFoundryRoute =
    process.env.AZURE_OPENAI_USE_FOUNDRY_INFERENCE === 'true' ||
    endpoint.includes('.services.ai.azure.com')
  const useV1Route = Boolean(v1ChatUrl)
  const apiVersion = optional(
    'AZURE_OPENAI_API_VERSION',
    useFoundryRoute ? '2024-05-01-preview' : '2024-10-21',
  )
  const url = useV1Route
    ? v1ChatUrl ?? endpoint
    : useFoundryRoute
      ? `${endpoint}/models/chat/completions?api-version=${encodeURIComponent(apiVersion)}`
      : `${endpoint}/openai/deployments/${encodeURIComponent(
          deployment,
        )}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`
  const knownIngredients = visionCandidates.map((candidate) => ({
    canonicalName: candidate.canonicalName,
    category: candidate.category,
    defaultQuantity: candidate.quantity,
    unit: candidate.unit,
    aliases: ingredientHints[candidate.canonicalName] ?? [candidate.canonicalName],
  }))
  const messages = [
    {
      role: 'system',
      content:
        'You identify grocery ingredients from Azure AI Vision signals. Return only one compact JSON object. Use canonicalName from the provided list. If uncertain, still choose the closest food item and lower confidence.',
    },
    {
      role: 'user',
      content: JSON.stringify(
        {
          task: 'Classify the main grocery ingredient in the camera frame.',
          allowedIngredients: knownIngredients,
          allowedCategories: categories,
          outputSchema: {
            canonicalName: 'string from allowedIngredients',
            label: 'short Japanese display name',
            category: 'one allowed category',
            quantity: 'reasonable number',
            unit: 'same unit as allowed ingredient unless clearly different',
            confidence: 'number between 0 and 1',
            reason: 'brief reason in Japanese',
          },
          azureVisionSignals: visionSummary,
        },
        null,
        2,
      ),
    },
  ]
  const body: JsonRecord =
    useV1Route || useFoundryRoute
      ? {
          model: deployment,
          messages,
          max_completion_tokens: 360,
        }
      : {
          messages,
          max_tokens: 360,
          temperature: 0,
        }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(body),
  })
  const json = await assertOk('Azure OpenAI food classification', response)
  const choice = asRecord(asArray(asRecord(json).choices)[0])
  const message = asRecord(choice.message)
  const content = stringValue(message.content)

  if (!content) {
    throw new Error(`Azure OpenAI response did not include message content: ${JSON.stringify(json)}`)
  }

  return content
}

const extractJsonObject = (value: string) => {
  const cleaned = value
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  try {
    return JSON.parse(cleaned) as JsonRecord
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')

    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as JsonRecord
    }

    throw new Error(`Azure OpenAI did not return JSON: ${value}`)
  }
}

export const classifyFoodWithAzureAi = async (
  request: VisionScanRequest,
): Promise<AzureFoodCandidate | undefined> => {
  if (!azureAiFoodPipelineConfigured()) return undefined
  if (!request.imageData && !request.imageUrl) return undefined

  const visionAnalysis = await analyzeWithAzureVision(request)
  const visionSignals = summarizeVisionAnalysis(visionAnalysis)
  const llmContent = await chatWithAzureOpenAI(visionSignals.summary)
  const parsed = extractJsonObject(llmContent)
  const canonicalName = stringValue(parsed.canonicalName)
  const candidate = visionCandidates.find((item) => item.canonicalName === canonicalName)

  if (!candidate) {
    throw new Error(`Azure OpenAI returned unknown canonicalName: ${canonicalName ?? '(empty)'}`)
  }

  const label = stringValue(parsed.label)?.trim() || candidate.label
  const confidence = clamp(numberValue(parsed.confidence) ?? 0.72, 0.1, 0.99)
  const quantity = clamp(numberValue(parsed.quantity) ?? candidate.quantity, 0.1, 9999)
  const unit = stringValue(parsed.unit)?.trim() || candidate.unit
  const reason = stringValue(parsed.reason)?.trim()
  const cvSignal = `Azure AI Vision: ${visionSignals.summary.replace(/\s+/g, ' ').slice(0, 220)}`
  const llmSignal = `Azure OpenAI: ${label} -> ${candidate.canonicalName}`
  const fusionNote = reason
    ? `Azure AI Vision signals were normalized by Azure OpenAI. Reason: ${reason}`
    : 'Azure AI Vision signals were normalized by Azure OpenAI.'

  return {
    label,
    canonicalName: candidate.canonicalName,
    category: candidate.category,
    quantity,
    unit,
    storage: candidate.storage,
    shelfLifeDays: candidate.shelfLifeDays,
    confidence,
    pipeline: {
      cvSignal,
      llmSignal,
      fusionNote,
    },
  }
}
