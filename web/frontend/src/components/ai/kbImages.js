// Helpers for knowledge-base screenshots, kept out of Markdown.jsx so that file
// only exports components (React Fast Refresh stops working otherwise).
export const KB_IMAGE_PREFIX = '/admin/knowledge/images/'

// True when an answer already shows its screenshots inline, so the caller knows
// not to repeat them underneath.
export function hasInlineKbImage(text) {
  return new RegExp(`!\\[[^\\]]*\\]\\(${KB_IMAGE_PREFIX}`).test(text || '')
}
