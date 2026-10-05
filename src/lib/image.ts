export const MAX_IMAGE_SIDE = 1600
const QUALITY = 0.82

/** Rozmery, ktoré sa zmestia do štvorca `max` × `max`, so zachovaným pomerom; nikdy nezväčší. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

export interface ResizedImage {
  blob: Blob
  width: number
  height: number
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY))
}

/**
 * Zmenší fotku z mobilu na max 1600 px a prevedie do WebP (alebo JPEG, ak prehliadač WebP nevie).
 * Orientáciu z EXIF rieši `createImageBitmap`.
 */
export async function resizeImage(file: Blob): Promise<ResizedImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_IMAGE_SIDE)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Prehliadač nevie spracovať obrázok.')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  let blob = await canvasToBlob(canvas, 'image/webp')
  if (!blob || blob.type !== 'image/webp') blob = await canvasToBlob(canvas, 'image/jpeg')
  if (!blob) throw new Error('Obrázok sa nepodarilo zmenšiť.')
  return { blob, width, height }
}
