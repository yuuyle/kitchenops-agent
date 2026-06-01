import type { IntegrationStatus } from '../common/types.ts'

const hasAll = (keys: string[]) => keys.every((key) => Boolean(process.env[key]))

export const getIntegrationStatus = (): IntegrationStatus[] => [
  {
    name: 'Azure OpenAI',
    configured: hasAll([
      'AZURE_OPENAI_ENDPOINT',
      'AZURE_OPENAI_API_KEY',
      'AZURE_OPENAI_DEPLOYMENT',
      'AZURE_OPENAI_API_VERSION',
    ]),
    requiredEnvironment: [
      'AZURE_OPENAI_ENDPOINT',
      'AZURE_OPENAI_API_KEY',
      'AZURE_OPENAI_DEPLOYMENT',
      'AZURE_OPENAI_API_VERSION',
    ],
    note: 'Microsoft AI 技術の主接続先。食材認識結果の構造化と献立生成に使う想定です。',
  },
  {
    name: 'Azure AI Vision',
    configured: hasAll(['AZURE_AI_VISION_ENDPOINT', 'AZURE_AI_VISION_API_KEY']),
    requiredEnvironment: ['AZURE_AI_VISION_ENDPOINT', 'AZURE_AI_VISION_API_KEY'],
    note: '固定カメラフレームから食材候補を抽出する Computer Vision 側の接続先です。',
  },
  {
    name: 'OpenAI API',
    configured: hasAll(['OPENAI_API_KEY']),
    requiredEnvironment: ['OPENAI_API_KEY'],
    note: 'Azure OpenAI が使えない場合のフォールバック候補です。',
  },
]
