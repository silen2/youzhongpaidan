/**
 * 附件领域模型：类型、标签、Blob 转换等纯函数（无 DOM/DB 依赖，可单测）。
 */

export const ATTACHMENT_TYPES = ['reference', 'draft', 'final', 'other'] as const

export type AttachmentType = (typeof ATTACHMENT_TYPES)[number]

export const ATTACHMENT_TYPE_LABEL: Record<AttachmentType, string> = {
  reference: '参考图',
  draft: '草图',
  final: '终稿',
  other: '其他',
}

export function isAttachmentType(value: unknown): value is AttachmentType {
  return ATTACHMENT_TYPES.includes(value as AttachmentType)
}

export function attachmentTypeLabel(type: AttachmentType): string {
  return ATTACHMENT_TYPE_LABEL[type] ?? '其他'
}

/** 校验上传文件是否为图片（按 MIME 前缀，accept=image/* 之外的格式直接拒绝） */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

/**
 * dataURL → Blob（纯函数）。仅支持 base64 dataURL（Image 压缩产物即此格式）。
 * 无法解析时抛错，由调用方提示。
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) throw new Error('无效的图片数据')
  const meta = dataUrl.slice(0, comma)
  const mime = meta.match(/^data:([^;]+);/)?.[1] || 'image/png'
  const base64 = dataUrl.slice(comma + 1)
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i)
  }
  return new Blob([bytes], { type: mime })
}

/** 文件大小人性化显示：B/KB/MB */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}
