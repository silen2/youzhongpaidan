import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  hexToRgba,
  relativeLuminance,
  isLightLuminance,
  detectImageBrightness,
  downscaleImage,
  cropImage,
  type CropRegion,
} from '@/utils/image-processing'

describe('image-processing: 纯函数', () => {
  describe('hexToRgba', () => {
    it('#818cf8 + alpha 1 → rgba(129, 140, 248, 1)', () => {
      expect(hexToRgba('#818cf8', 1)).toBe('rgba(129, 140, 248, 1)')
    })

    it('#0f0c29 + alpha 0.5 → rgba(15, 12, 41, 0.5)', () => {
      expect(hexToRgba('#0f0c29', 0.5)).toBe('rgba(15, 12, 41, 0.5)')
    })

    it('白色与黑色边界值', () => {
      expect(hexToRgba('#ffffff', 0.8)).toBe('rgba(255, 255, 255, 0.8)')
      expect(hexToRgba('#000000', 0.3)).toBe('rgba(0, 0, 0, 0.3)')
    })

    it('alpha=0 应输出透明', () => {
      expect(hexToRgba('#34d399', 0)).toBe('rgba(52, 211, 153, 0)')
    })
  })

  describe('relativeLuminance (WCAG)', () => {
    // 参考 https://www.w3.org/WAI/WCAG21/Understanding/relative-luminance.html
    it('白色 ≈ 1.0', () => {
      expect(relativeLuminance(255, 255, 255)).toBeCloseTo(1.0, 5)
    })

    it('黑色 = 0', () => {
      expect(relativeLuminance(0, 0, 0)).toBe(0)
    })

    it('纯绿 > 纯红 > 纯蓝（符合 WCAG 系数 0.7152 / 0.2126 / 0.0722）', () => {
      const g = relativeLuminance(0, 255, 0)
      const r = relativeLuminance(255, 0, 0)
      const b = relativeLuminance(0, 0, 255)
      expect(g).toBeGreaterThan(r)
      expect(r).toBeGreaterThan(b)
    })

    it('中灰介于 0 与 1 之间', () => {
      const lum = relativeLuminance(128, 128, 128)
      expect(lum).toBeGreaterThan(0)
      expect(lum).toBeLessThan(1)
    })

    it('线性区间：s=128 亮度应低于 s=255 的一半（gamma 校正使暗区更暗）', () => {
      // sRGB 128/255 ≈ 0.502，经 gamma 展开后远低于 0.5
      const lumMid = relativeLuminance(128, 128, 128)
      expect(lumMid).toBeLessThan(0.5)
    })
  })

  describe('isLightLuminance', () => {
    it('阈值 0.25 视为暗色（边界保守，视为暗色）', () => {
      expect(isLightLuminance(0.25)).toBe(false)
    })

    it('0.26 视为亮色', () => {
      expect(isLightLuminance(0.26)).toBe(true)
    })

    it('0 视为暗色', () => {
      expect(isLightLuminance(0)).toBe(false)
    })

    it('1 视为亮色', () => {
      expect(isLightLuminance(1)).toBe(true)
    })
  })
})

describe('image-processing: canvas 依赖函数', () => {
  const OriginalImage = globalThis.Image
  let originalCreateElement: typeof document.createElement

  /** Mock Image：src 赋值后异步触发 onload */
  function mockImageOnLoad(width = 100, height = 100) {
    globalThis.Image = class {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      crossOrigin = ''
      width = width
      height = height
      private _src = ''
      set src(v: string) {
        this._src = v
        setTimeout(() => this.onload?.(), 0)
      }
      get src() {
        return this._src
      }
    } as unknown as typeof Image
  }

  /** Mock Image：src 赋值后异步触发 onerror */
  function mockImageOnError() {
    globalThis.Image = class {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      crossOrigin = ''
      private _src = ''
      set src(v: string) {
        this._src = v
        setTimeout(() => this.onerror?.(), 0)
      }
      get src() {
        return this._src
      }
    } as unknown as typeof Image
  }

  /** Mock canvas.getContext 返回 null（触发 fallback 路径） */
  function mockCanvasNullContext() {
    return vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => null,
        } as unknown as HTMLCanvasElement
      }
      return originalCreateElement.call(document, tag)
    })
  }

  /** Mock canvas.getContext 返回带像素数据的 context（触发主路径） */
  function mockCanvasWithContext(data: number[]) {
    return vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({
            drawImage: () => {},
            getImageData: () => ({ data: new Uint8ClampedArray(data) }),
          }),
          toDataURL: () => 'data:image/jpeg;base64,mock',
        } as unknown as HTMLCanvasElement
      }
      return originalCreateElement.call(document, tag)
    })
  }

  beforeEach(() => {
    originalCreateElement = document.createElement.bind(document)
  })

  afterEach(() => {
    globalThis.Image = OriginalImage
    vi.restoreAllMocks()
  })

  describe('detectImageBrightness', () => {
    it('canvas 不支持时 resolve(false)（fallback）', async () => {
      mockImageOnLoad()
      mockCanvasNullContext()
      await expect(detectImageBrightness('data:image/png;base64,xxx')).resolves.toBe(false)
    })

    it('图片加载失败时 resolve(false)', async () => {
      mockImageOnError()
      await expect(detectImageBrightness('bad-url')).resolves.toBe(false)
    })

    it('全白像素 → resolve(true)（亮色背景）', async () => {
      mockImageOnLoad()
      mockCanvasWithContext([255, 255, 255, 255])
      await expect(detectImageBrightness('data:image/png;base64,white')).resolves.toBe(true)
    })

    it('全黑像素 → resolve(false)（暗色背景）', async () => {
      mockImageOnLoad()
      mockCanvasWithContext([0, 0, 0, 255])
      await expect(detectImageBrightness('data:image/png;base64,black')).resolves.toBe(false)
    })

    it('全透明像素被跳过，无有效像素时 resolve(false)', async () => {
      mockImageOnLoad()
      mockCanvasWithContext([0, 0, 0, 0, 255, 255, 255, 0])
      await expect(detectImageBrightness('data:image/png;base64,transparent')).resolves.toBe(false)
    })
  })

  describe('downscaleImage', () => {
    it('canvas 不支持时 resolve(原 dataUrl)（回退原值）', async () => {
      mockImageOnLoad()
      mockCanvasNullContext()
      const original = 'data:image/png;base64,xxx'
      await expect(downscaleImage(original)).resolves.toBe(original)
    })

    it('canvas 可用时 resolve(toDataURL 结果)', async () => {
      mockImageOnLoad()
      mockCanvasWithContext([255, 255, 255, 255])
      await expect(downscaleImage('data:image/png;base64,xxx')).resolves.toBe(
        'data:image/jpeg;base64,mock'
      )
    })

    it('图片加载失败时 reject', async () => {
      mockImageOnError()
      await expect(downscaleImage('bad-url')).rejects.toThrow('Image load failed')
    })
  })

  describe('cropImage', () => {
    const region = { x: 0, y: 0, w: 1, h: 1 }

    it('canvas 不支持时 reject(Canvas not supported)', async () => {
      mockImageOnLoad()
      mockCanvasNullContext()
      await expect(cropImage('data:image/png;base64,xxx', region)).rejects.toThrow(
        'Canvas not supported'
      )
    })

    it('canvas 可用时 resolve(toDataURL 结果)', async () => {
      mockImageOnLoad()
      mockCanvasWithContext([255, 255, 255, 255])
      await expect(cropImage('data:image/png;base64,xxx', region)).resolves.toBe(
        'data:image/jpeg;base64,mock'
      )
    })

    it('图片加载失败时 reject', async () => {
      mockImageOnError()
      await expect(cropImage('bad-url', region)).rejects.toThrow('Image load failed')
    })

    it('区域为部分裁剪时也能正常返回', async () => {
      mockImageOnLoad(200, 100)
      mockCanvasWithContext([0, 0, 0, 255])
      const partial: CropRegion = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 }
      await expect(cropImage('data:image/png;base64,xxx', partial)).resolves.toBe(
        'data:image/jpeg;base64,mock'
      )
    })
  })
})
