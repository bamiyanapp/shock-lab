// 物理シミュレーション全体で共有する単位換算の定数。重複定義によるずれを防ぐため一元化する。
/** 画面上の1m当たりのピクセル数 */
export const PIXELS_PER_METER = 60;
/** 物理エンジンの1秒当たりのステップ数 */
export const STEPS_PER_SECOND = 60;
/** 重力加速度(m/s²) */
export const GRAVITY_MS2 = 9.8;
/** Matter.jsの質量 = kg × MASS_SCALE（Matterの数値を扱いやすい大きさにするための換算） */
export const MASS_SCALE = 0.02;
/** ばね下質量（1軸あたり・kg）。タイヤとホイール等の、バネの下にある質量 */
export const UNSPRUNG_MASS_KG = 80;
/**
 * Matter.jsは位置更新に「力/質量×Δt²（Δtはミリ秒）」を使うため、実効重力が9.8m/s²になる
 * engine.gravity.scaleは9.8 × 60 / 1e6 = 0.000588になる（gravity.y = 1のとき）。
 */
export const GRAVITY_SCALE = (GRAVITY_MS2 * PIXELS_PER_METER) / 1e6;
/** ニュートン[N]をMatter.jsの力へ換算する係数（F_matter = F_N × MASS_SCALE × 60 / 1e6） */
export const NEWTON_TO_MATTER_FORCE = (MASS_SCALE * PIXELS_PER_METER) / 1e6;
/** 履歴を1サンプルにまとめるtick数（10Hz）。ストアへの反映もこの頻度で行う */
export const HISTORY_SAMPLE_TICKS = 6;
/** 履歴の上限（10Hzで5分） */
export const MAX_HISTORY_SAMPLES = 3000;

/**
 * 角度(rad)を(-π, π]へ正規化する。Matter.jsのbody.angleは回転するたびに増減し続ける値（一回転で
 * 2π）のため、向き（傾き）の判定には正規化した値を使う。そうしないと、空中で一回転して
 * タイヤから着地した（向きは正常な）車体が、「傾いている」と誤判定される（issue #519）。
 */
export function normalizeAngleRad(angle: number): number {
  const twoPi = Math.PI * 2;
  const wrapped = ((((angle + Math.PI) % twoPi) + twoPi) % twoPi) - Math.PI;
  // 範囲を(-π, π]にそろえる（-πはπとして扱う）
  return wrapped === -Math.PI ? Math.PI : wrapped;
}
