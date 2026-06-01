import { existsSync, readFileSync } from 'node:fs'
import process from 'node:process'

const args = process.argv.slice(2)
const envArgIndex = args.findIndex((arg) => arg === '--env')
const envPath =
  envArgIndex >= 0 ? args[envArgIndex + 1] : existsSync('.env.azure-ai.local') ? '.env.azure-ai.local' : undefined

if (envPath) {
  for (const line of readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separator = trimmed.indexOf('=')
    if (separator <= 0) continue

    const key = trimmed.slice(0, separator).trim()
    const rawValue = trimmed.slice(separator + 1).trim()
    const value = rawValue.replace(/^['"]|['"]$/g, '')

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

const required = (key) => {
  const value = process.env[key]?.trim()
  if (!value) throw new Error(`Missing environment variable: ${key}`)
  return value
}

const optional = (key, fallback) => process.env[key]?.trim() || fallback

const trimTrailingSlash = (value) => value.replace(/\/+$/, '')

const openAiV1ChatUrl = (endpoint) => {
  const trimmed = trimTrailingSlash(endpoint)

  if (trimmed.endsWith('/openai/v1/chat/completions')) {
    return trimmed
  }

  if (trimmed.endsWith('/openai/v1')) {
    return `${trimmed}/chat/completions`
  }

  return undefined
}

const parseJsonResponse = async (response) => {
  const text = await response.text()

  try {
    return { text, json: JSON.parse(text) }
  } catch {
    return { text, json: undefined }
  }
}

const assertOk = async (label, response) => {
  const parsed = await parseJsonResponse(response)

  if (!response.ok) {
    const detail = parsed.json ? JSON.stringify(parsed.json, null, 2) : parsed.text
    throw new Error(`${label} failed: HTTP ${response.status}\n${detail}`)
  }

  return parsed.json
}

const testAzureOpenAI = async () => {
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
    ? v1ChatUrl
    : useFoundryRoute
    ? `${endpoint}/models/chat/completions?api-version=${encodeURIComponent(apiVersion)}`
    : `${endpoint}/openai/deployments/${encodeURIComponent(
        deployment,
      )}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`

  const body = useV1Route || useFoundryRoute
    ? {
        model: deployment,
        messages: [
          { role: 'system', content: 'You are a connectivity test.' },
          { role: 'user', content: 'Reply with exactly: kitchenops-ok' },
        ],
        max_completion_tokens: 24,
      }
    : {
        messages: [
          { role: 'system', content: 'You are a connectivity test.' },
          { role: 'user', content: 'Reply with exactly: kitchenops-ok' },
        ],
        max_tokens: 24,
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
  const json = await assertOk('Azure OpenAI chat completions', response)
  const content = json?.choices?.[0]?.message?.content ?? json?.choices?.[0]?.delta?.content

  if (!content) {
    throw new Error(`Azure OpenAI response did not include message content:\n${JSON.stringify(json, null, 2)}`)
  }

  return {
    endpoint,
    deployment,
    apiVersion,
    route: useV1Route
      ? 'azure-openai-v1-chat-completions'
      : useFoundryRoute
        ? 'foundry-model-inference'
        : 'azure-openai-deployments',
    content,
  }
}

const testAzureAiVision = async () => {
  const endpoint = trimTrailingSlash(required('AZURE_AI_VISION_ENDPOINT'))
  const apiKey = required('AZURE_AI_VISION_API_KEY')
  const apiVersion = optional('AZURE_AI_VISION_API_VERSION', '2024-02-01')
  const imageUrl = optional(
    'AZURE_AI_VISION_TEST_IMAGE_URL',
    'https://learn.microsoft.com/azure/ai-services/computer-vision/media/quickstarts/presentation.png',
  )
  const features = optional('AZURE_AI_VISION_FEATURES', 'caption,tags')
  const url = `${endpoint}/computervision/imageanalysis:analyze?features=${encodeURIComponent(
    features,
  )}&language=en&api-version=${encodeURIComponent(apiVersion)}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': apiKey,
    },
    body: JSON.stringify({ url: imageUrl }),
  })
  const json = await assertOk('Azure AI Vision image analysis', response)

  return {
    endpoint,
    apiVersion,
    imageUrl,
    caption: json?.captionResult?.text,
    tags: json?.tagsResult?.values?.slice(0, 5).map((tag) => tag.name) ?? [],
  }
}

const main = async () => {
  console.log('Azure AI connectivity test')
  if (envPath) console.log(`Loaded env file: ${envPath}`)

  const results = []

  try {
    const openAI = await testAzureOpenAI()
    results.push({ service: 'Azure OpenAI', ok: true, ...openAI })
    console.log(`OK Azure OpenAI: ${openAI.content}`)
  } catch (error) {
    results.push({ service: 'Azure OpenAI', ok: false, error: String(error.message ?? error) })
    console.error(`NG Azure OpenAI: ${String(error.message ?? error)}`)
  }

  try {
    const vision = await testAzureAiVision()
    results.push({ service: 'Azure AI Vision', ok: true, ...vision })
    console.log(`OK Azure AI Vision: ${vision.caption ?? 'caption not returned'}`)
    if (vision.tags.length) console.log(`Vision tags: ${vision.tags.join(', ')}`)
  } catch (error) {
    results.push({ service: 'Azure AI Vision', ok: false, error: String(error.message ?? error) })
    console.error(`NG Azure AI Vision: ${String(error.message ?? error)}`)
  }

  const failed = results.filter((result) => !result.ok)

  console.log('\nSummary')
  console.log(JSON.stringify(results, null, 2))

  if (failed.length > 0) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
