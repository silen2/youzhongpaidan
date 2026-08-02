/**
 * 图像处理工具函数（从 theme store 抽离的纯/近纯函数）
 *
 * - hexToRgba / relativeLuminance / isLightLuminance：纯函数，可单测
 * - detectImageBrightness / downscaleImage / cropImage：依赖 canvas/Image，
 *   在无 canvas 环境（如 happy-dom 测试）走 fallback 路径
 */

/** Crop region in normalized [0,1] coordinates relative to the original image */
export interface CropRegion {
  x: number
  y: number
  w: number
  h: number
}

/** Convert #rrggbb hex to rgba(r,g,b,alpha) string */
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Calculate WCAG relative luminance from sRGB values
 * Reference: https://www.w3.org/WAI/WCAG21/Understanding/relative-luminance.html
 */
export function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * 判断平均亮度是否为"亮色"背景。
 * 阈值 0.25 略低于 WCAG 中点 0.179 的保守取值（边界视为暗色）。
 * 抽为纯函数以便单测核心判定逻辑。
 */
export function isLightLuminance(avgLuminance: number): boolean {
  return avgLuminance > 0.25
}

/**
 * Sample image pixels via Canvas and determine if the image is "light"
 * Returns true if the average luminance is above the threshold
 */
export function detectImageBrightness(imageUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const maxDim = 128
        const scale = Math.min(maxDim / img.width, maxDim / img.height, 1)
        canvas.width = Math.floor(img.width * scale)
        canvas.height = Math.floor(img.height * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(false)
          return
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data

        let totalLuminance = 0
        let pixelCount = 0

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          const a = data[i + 3]

          // Skip fully transparent pixels
          if (a < 10) continue

          totalLuminance += relativeLuminance(r, g, b)
          pixelCount++
        }

        if (pixelCount === 0) {
          resolve(false)
          return
        }

        const avgLuminance = totalLuminance / pixelCount
        resolve(isLightLuminance(avgLuminance))
      } catch {
        // CORS or other canvas error, fall back to dark
        resolve(false)
      }
    }
    img.onerror = () => {
      resolve(false)
    }
    img.src = imageUrl
  })
}

/**
 * Downscale an image data URL so its longest side <= maxDim.
 * Outputs JPEG to keep storage size manageable for background photos.
 */
export function downscaleImage(dataUrl: string, maxDim = 1920, quality = 0.9): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      try {
        const longest = Math.max(img.width, img.height)
        const scale = longest > maxDim ? maxDim / longest : 1
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(dataUrl)
          return
        }
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', quality))
      } catch {
        resolve(dataUrl)
      }
    }
    img.onerror = () => reject(new Error('Image load failed'))
    img.src = dataUrl
  })
}

/**
 * Crop a normalized region out of an image data URL.
 * Output is capped to maxDim on its longest side, JPEG encoded.
 */
export function cropImage(originalDataUrl: string, region: CropRegion, maxDim = 1920, quality = 0.9): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      try {
        const sx = region.x * img.width
        const sy = region.y * img.height
        const sw = Math.max(1, region.w * img.width)
        const sh = Math.max(1, region.h * img.height)
        const longest = Math.max(sw, sh)
        const scale = longest > maxDim ? maxDim / longest : 1
        const dw = Math.max(1, Math.round(sw * scale))
        const dh = Math.max(1, Math.round(sh * scale))
        const canvas = document.createElement('canvas')
        canvas.width = dw
        canvas.height = dh
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas not supported'))
          return
        }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh)
        resolve(canvas.toDataURL('image/jpeg', quality))
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = () => reject(new Error('Image load failed'))
    img.src = originalDataUrl
  })
}
