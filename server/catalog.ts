import type {
  FamilyProfile,
  IngredientCategory,
  IngredientStock,
  Recipe,
  StorageLocation,
} from '../common/types.ts'

const dayMs = 24 * 60 * 60 * 1000

export const nowIso = () => new Date().toISOString()

export const addDaysIso = (days: number) => {
  const date = new Date(Date.now() + days * dayMs)
  return date.toISOString()
}

export const categoryLabels: Record<IngredientCategory, string> = {
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

export const defaultFamilyProfile: FamilyProfile = {
  members: [
    { id: 'adult-1', label: '大人 1', ageGroup: 'adult', appetite: 'normal' },
    { id: 'adult-2', label: '大人 2', ageGroup: 'adult', appetite: 'normal' },
    { id: 'child-1', label: '子ども 1', ageGroup: 'child', appetite: 'small' },
  ],
  allergies: ['なし'],
  dislikes: ['辛すぎる料理'],
  favoriteStyles: ['和食', '野菜多め', '時短'],
  nutritionGoals: ['たんぱく質を毎食入れる', '野菜を1日350g目標', '塩分控えめ'],
  recipeSourcePreferences: {
    preferredSites: [],
    blockedSites: [],
  },
  maxCookingMinutes: 35,
  weeklyBudgetYen: 12000,
}

const stock = (
  id: string,
  name: string,
  canonicalName: string,
  category: IngredientCategory,
  quantity: number,
  unit: string,
  storage: StorageLocation,
  expiresInDays: number,
): IngredientStock => ({
  id,
  name,
  canonicalName,
  category,
  quantity,
  unit,
  storage,
  expiresAt: addDaysIso(expiresInDays),
  addedAt: addDaysIso(-1),
  updatedAt: nowIso(),
  source: 'seed',
  confidence: 0.99,
  status: 'ok',
})

export const defaultInventory: IngredientStock[] = [
  stock('stock-chicken', '鶏もも肉', 'chicken_thigh', 'meat', 600, 'g', 'fridge', 2),
  stock('stock-salmon', '鮭切り身', 'salmon', 'fish', 3, '切', 'freezer', 12),
  stock('stock-tofu', '木綿豆腐', 'tofu', 'soy', 2, '丁', 'fridge', 4),
  stock('stock-egg', '卵', 'egg', 'egg', 8, '個', 'fridge', 10),
  stock('stock-broccoli', 'ブロッコリー', 'broccoli', 'vegetable', 1, '株', 'fridge', 3),
  stock('stock-carrot', 'にんじん', 'carrot', 'vegetable', 4, '本', 'fridge', 8),
  stock('stock-onion', '玉ねぎ', 'onion', 'vegetable', 5, '個', 'pantry', 15),
  stock('stock-spinach', 'ほうれん草', 'spinach', 'vegetable', 1, '束', 'fridge', 2),
  stock('stock-rice', '米', 'rice', 'staple', 5, 'kg', 'pantry', 45),
  stock('stock-yogurt', 'ヨーグルト', 'yogurt', 'dairy', 4, '個', 'fridge', 5),
]

const recipeSearchUrl = (title: string) =>
  `https://www.google.com/search?q=${encodeURIComponent(`${title} レシピ`)}`

export const recipeCatalog: Recipe[] = [
  {
    id: 'recipe-chicken-teriyaki-broccoli',
    title: '鶏もも肉とブロッコリーの照り焼き',
    sourceName: 'Web検索候補',
    sourceUrl: recipeSearchUrl('鶏もも肉 ブロッコリー 照り焼き'),
    servings: 3,
    cookingMinutes: 25,
    tags: ['和食', '高たんぱく', '弁当向き'],
    nutrition: { calories: 520, proteinGram: 34, vegetableGram: 120, saltGram: 2.2 },
    ingredients: [
      { name: '鶏もも肉', canonicalName: 'chicken_thigh', amount: 450, unit: 'g' },
      { name: 'ブロッコリー', canonicalName: 'broccoli', amount: 1, unit: '株' },
      { name: '玉ねぎ', canonicalName: 'onion', amount: 1, unit: '個', optional: true },
    ],
    steps: [
      '鶏もも肉を一口大に切り、軽く塩をふる。',
      'ブロッコリーを小房に分け、電子レンジで下ゆでする。',
      'フライパンで鶏肉を焼き、玉ねぎとブロッコリーを加える。',
      'しょうゆ、みりん、砂糖を絡めて照りが出るまで煮詰める。',
    ],
    aiSummary: '在庫の肉と緑黄色野菜をまとめて使える主菜。翌日の弁当にも回しやすい構成です。',
  },
  {
    id: 'recipe-salmon-chancha',
    title: '鮭と野菜のみそちゃんちゃん焼き',
    sourceName: 'Web検索候補',
    sourceUrl: recipeSearchUrl('鮭 野菜 ちゃんちゃん焼き'),
    servings: 3,
    cookingMinutes: 30,
    tags: ['和食', '魚', '野菜多め'],
    nutrition: { calories: 460, proteinGram: 31, vegetableGram: 180, saltGram: 2.4 },
    ingredients: [
      { name: '鮭切り身', canonicalName: 'salmon', amount: 3, unit: '切' },
      { name: 'にんじん', canonicalName: 'carrot', amount: 1, unit: '本' },
      { name: '玉ねぎ', canonicalName: 'onion', amount: 1, unit: '個' },
      { name: 'キャベツ', canonicalName: 'cabbage', amount: 0.25, unit: '玉' },
    ],
    steps: [
      '野菜を食べやすい大きさに切る。',
      '鮭と野菜をフライパンに並べ、みそだれを回しかける。',
      'ふたをして蒸し焼きにし、鮭に火を通す。',
      '仕上げにバターを少量加え、香りを立てる。',
    ],
    aiSummary: '魚の日を確保しつつ、在庫野菜を広く使える献立です。',
  },
  {
    id: 'recipe-tofu-egg-stir',
    title: '豆腐と卵のふんわり炒め',
    sourceName: 'Web検索候補',
    sourceUrl: recipeSearchUrl('豆腐 卵 ふんわり炒め'),
    servings: 3,
    cookingMinutes: 15,
    tags: ['時短', '節約', 'やさしい味'],
    nutrition: { calories: 330, proteinGram: 21, vegetableGram: 60, saltGram: 1.6 },
    ingredients: [
      { name: '木綿豆腐', canonicalName: 'tofu', amount: 1, unit: '丁' },
      { name: '卵', canonicalName: 'egg', amount: 3, unit: '個' },
      { name: 'ほうれん草', canonicalName: 'spinach', amount: 0.5, unit: '束', optional: true },
    ],
    steps: [
      '豆腐を水切りし、食べやすい大きさに崩す。',
      '卵を溶き、フライパンで半熟にして一度取り出す。',
      '豆腐と青菜を炒め、卵を戻して軽く合わせる。',
      '白だしまたはしょうゆで薄めに味を整える。',
    ],
    aiSummary: '疲れている日の短時間枠。豆腐と卵でたんぱく質を補えます。',
  },
  {
    id: 'recipe-spinach-omelette',
    title: 'ほうれん草とチーズのオムレツ',
    sourceName: 'Web検索候補',
    sourceUrl: recipeSearchUrl('ほうれん草 チーズ オムレツ'),
    servings: 3,
    cookingMinutes: 20,
    tags: ['朝食', '洋風', 'カルシウム'],
    nutrition: { calories: 390, proteinGram: 24, vegetableGram: 95, saltGram: 1.9 },
    ingredients: [
      { name: '卵', canonicalName: 'egg', amount: 4, unit: '個' },
      { name: 'ほうれん草', canonicalName: 'spinach', amount: 1, unit: '束' },
      { name: 'チーズ', canonicalName: 'cheese', amount: 60, unit: 'g' },
    ],
    steps: [
      'ほうれん草を下ゆでして水気を切る。',
      '卵、チーズ、塩こしょうを混ぜる。',
      'フライパンでほうれん草を軽く炒め、卵液を流す。',
      '弱火でふんわり焼き上げる。',
    ],
    aiSummary: '朝食にも夕食の副菜にも転用できる卵料理です。',
  },
  {
    id: 'recipe-keema-curry',
    title: '野菜たっぷりキーマカレー',
    sourceName: 'Web検索候補',
    sourceUrl: recipeSearchUrl('野菜たっぷり キーマカレー'),
    servings: 4,
    cookingMinutes: 35,
    tags: ['作り置き', '子ども向き', '野菜多め'],
    nutrition: { calories: 610, proteinGram: 28, vegetableGram: 190, saltGram: 2.6 },
    ingredients: [
      { name: 'ひき肉', canonicalName: 'ground_meat', amount: 400, unit: 'g' },
      { name: '玉ねぎ', canonicalName: 'onion', amount: 2, unit: '個' },
      { name: 'にんじん', canonicalName: 'carrot', amount: 1, unit: '本' },
      { name: '米', canonicalName: 'rice', amount: 2, unit: '合' },
    ],
    steps: [
      '玉ねぎとにんじんをみじん切りにする。',
      'ひき肉と野菜を炒め、カレー粉とトマトを加える。',
      '水分を飛ばしながら煮込み、甘口寄りに調整する。',
      'ご飯にかけて盛り付ける。',
    ],
    aiSummary: '不足しがちな食材は買い足し候補に回し、週後半の作り置きにも使えます。',
  },
  {
    id: 'recipe-nikujaga',
    title: '鶏肉のあっさり肉じゃが',
    sourceName: 'Web検索候補',
    sourceUrl: recipeSearchUrl('鶏肉 肉じゃが あっさり'),
    servings: 4,
    cookingMinutes: 35,
    tags: ['和食', '煮物', '作り置き'],
    nutrition: { calories: 480, proteinGram: 29, vegetableGram: 170, saltGram: 2.1 },
    ingredients: [
      { name: '鶏もも肉', canonicalName: 'chicken_thigh', amount: 350, unit: 'g' },
      { name: 'じゃがいも', canonicalName: 'potato', amount: 3, unit: '個' },
      { name: '玉ねぎ', canonicalName: 'onion', amount: 1, unit: '個' },
      { name: 'にんじん', canonicalName: 'carrot', amount: 1, unit: '本' },
    ],
    steps: [
      '材料を大きめに切る。',
      '鶏肉と野菜を炒め、だしを加える。',
      'しょうゆ、みりん、砂糖で薄めに味付けする。',
      'じゃがいもが柔らかくなるまで煮る。',
    ],
    aiSummary: '週前半の主菜と翌日の昼食転用を狙える家庭料理です。',
  },
  {
    id: 'recipe-yogurt-fruit-bowl',
    title: 'ヨーグルトと果物の朝ボウル',
    sourceName: 'Web検索候補',
    sourceUrl: recipeSearchUrl('ヨーグルト 果物 朝食 ボウル'),
    servings: 3,
    cookingMinutes: 8,
    tags: ['朝食', '腸活', '火を使わない'],
    nutrition: { calories: 260, proteinGram: 12, vegetableGram: 0, saltGram: 0.3 },
    ingredients: [
      { name: 'ヨーグルト', canonicalName: 'yogurt', amount: 3, unit: '個' },
      { name: 'バナナ', canonicalName: 'banana', amount: 2, unit: '本' },
      { name: 'オートミール', canonicalName: 'oatmeal', amount: 60, unit: 'g', optional: true },
    ],
    steps: [
      '器にヨーグルトを入れる。',
      '果物を切ってのせる。',
      '好みでオートミールやナッツを加える。',
    ],
    aiSummary: '朝の手間を抑え、乳製品の期限消費にも向きます。',
  },
  {
    id: 'recipe-rice-ball-miso-soup',
    title: '鮭おにぎりと具だくさんみそ汁',
    sourceName: 'Web検索候補',
    sourceUrl: recipeSearchUrl('鮭 おにぎり 具だくさん味噌汁'),
    servings: 3,
    cookingMinutes: 25,
    tags: ['昼食', '和食', '子ども向き'],
    nutrition: { calories: 540, proteinGram: 24, vegetableGram: 150, saltGram: 2.7 },
    ingredients: [
      { name: '米', canonicalName: 'rice', amount: 2, unit: '合' },
      { name: '鮭切り身', canonicalName: 'salmon', amount: 1, unit: '切' },
      { name: '豆腐', canonicalName: 'tofu', amount: 0.5, unit: '丁' },
      { name: 'にんじん', canonicalName: 'carrot', amount: 0.5, unit: '本' },
    ],
    steps: [
      '鮭を焼いてほぐす。',
      'ご飯に鮭を混ぜておにぎりにする。',
      '豆腐と野菜を入れたみそ汁を作る。',
    ],
    aiSummary: '残り食材を昼食に寄せて、夕食の調理負荷を下げます。',
  },
]

export const visionCandidates: Array<{
  label: string
  canonicalName: string
  category: IngredientCategory
  quantity: number
  unit: string
  storage: StorageLocation
  shelfLifeDays: number
}> = [
  {
    label: 'トマト',
    canonicalName: 'tomato',
    category: 'vegetable',
    quantity: 4,
    unit: '個',
    storage: 'fridge',
    shelfLifeDays: 5,
  },
  {
    label: '牛乳',
    canonicalName: 'milk',
    category: 'dairy',
    quantity: 1,
    unit: '本',
    storage: 'fridge',
    shelfLifeDays: 7,
  },
  {
    label: '豚こま肉',
    canonicalName: 'pork_slices',
    category: 'meat',
    quantity: 400,
    unit: 'g',
    storage: 'fridge',
    shelfLifeDays: 2,
  },
  {
    label: 'キャベツ',
    canonicalName: 'cabbage',
    category: 'vegetable',
    quantity: 1,
    unit: '玉',
    storage: 'fridge',
    shelfLifeDays: 7,
  },
  {
    label: 'バナナ',
    canonicalName: 'banana',
    category: 'fruit',
    quantity: 5,
    unit: '本',
    storage: 'pantry',
    shelfLifeDays: 4,
  },
  {
    label: 'じゃがいも',
    canonicalName: 'potato',
    category: 'vegetable',
    quantity: 4,
    unit: '個',
    storage: 'pantry',
    shelfLifeDays: 20,
  },
]
