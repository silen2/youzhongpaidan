import { describe, it, expect } from 'vitest'
import {
  ATTACHMENT_TYPES,
  isAttachmentType,
  attachmentTypeLabel,
  isImageFile,
  dataUrlToBlob,
  formatFileSize,
} from '@/domain/attachment/attachment'

describe('attachment 类型与标签', () => {
  it('四种类型齐全且顺序固定', () => {
    expect(ATTACHMENT_TYPES).toEqual(['reference', 'draft', 'final', 'other'])
  })

  it('isAttachmentType 校验', () => {
    expect(isAttachmentType('reference')).toBe(true)
    expect(isAttachmentType('final')).toBe(true)
    expect(isAttachmentType('video')).toBe(false)
    expect(isAttachmentType(undefined)).toBe(false)
  })

  it('attachmentTypeLabel 中文映射', () => {
    expect(attachmentTypeLabel('reference')).toBe('参考图')
    expect(attachmentTypeLabel('draft')).toBe('草图')
    expect(attachmentTypeLabel('final')).toBe('终稿')
    expect(attachmentTypeLabel('other')).toBe('其他')
  })
})

describe('attachment 文件校验', () => {
  it('isImageFile 按 MIME 前缀判定', () => {
    expect(isImageFile(new File(['x'], 'a.png', { type: 'image/png' }))).toBe(true)
    expect(isImageFile(new File(['x'], 'a.webp', { type: 'image/webp' }))).toBe(true)
    expect(isImageFile(new File(['x'], 'a.pdf', { type: 'application/pdf' }))).toBe(false)
    expect(isImageFile(new File(['x'], 'a', { type: '' }))).toBe(false)
  })
})

describe('attachment dataUrlToBlob', () => {
  it('base64 dataURL 正确还原为 Blob（mime 与字节一致）', () => {
    // 'hello' 的 base64
    const dataUrl = 'data:image/png;base64,aGVsbG8='
    const blob = dataUrlToBlob(dataUrl)
    expect(blob.type).toBe('image/png')
    expect(blob.size).toBe(5)
  })

  it('无 mime 时兜底 image/png', () => {
    const blob = dataUrlToBlob('data:;base64,aGVsbG8=')
    expect(blob.type).toBe('image/png')
  })

  it('非 base64 / 无逗号抛错', () => {
    expect(() => dataUrlToBlob('not-a-data-url')).toThrow()
    expect(() => dataUrlToBlob('data:image/png;base64,!!')).toThrow()
  })
})

describe('attachment formatFileSize', () => {
  it('B / KB / MB 分级', () => {
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(1536)).toBe('1.5 KB')
    expect(formatFileSize(3 * 1024 * 1024)).toBe('3.00 MB')
  })
})
