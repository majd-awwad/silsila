/** Classroom materials experiments and activities can require. The teacher ticks what is available. */
import type { L } from '../contracts';

export const RESOURCES = {
  cups: { ar: 'كاسات', en: 'Cups' },
  metal_cup: { ar: 'كاسة معدن', en: 'Metal cup' },
  water: { ar: 'مي', en: 'Water' },
  ice: { ar: 'ثلج / ثلاجة', en: 'Ice or a fridge' },
  food_color: { ar: 'ملوّن طعام', en: 'Food colouring' },
  napkins: { ar: 'محارم', en: 'Paper tissues' },
  cover: { ar: 'غطا أو نايلون', en: 'Lid or cling film' },
  plates: { ar: 'صحون واسعة', en: 'Wide plates' },
  fan: { ar: 'مروحة أو كرتونة للتهوية', en: 'Fan or card for airflow' },
  sunlight: { ar: 'شبّاك مشمس', en: 'Sunny window' },
  flashlight: { ar: 'كشّاف', en: 'Torch' },
  ruler: { ar: 'مسطرة', en: 'Ruler' },
  paper: { ar: 'ورق وأقلام', en: 'Paper and pens' },
  scissors: { ar: 'مقص آمن', en: 'Safety scissors' },
  grid_paper: { ar: 'ورق مربّعات', en: 'Grid paper' },
  string: { ar: 'خيط', en: 'String' },
  basin: { ar: 'وعاء كبير', en: 'Large basin' },
  clay: { ar: 'معجون', en: 'Modelling clay' },
  small_objects: { ar: 'أغراض صغيرة متنوّعة', en: 'Assorted small objects' },
  screen: { ar: 'جهاز عرض / شاشة', en: 'Projector or screen' },
} satisfies Record<string, L>;

export type ResourceId = keyof typeof RESOURCES;
export const RESOURCE_IDS = Object.keys(RESOURCES) as ResourceId[];
