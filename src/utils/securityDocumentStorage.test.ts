import { describe, expect, it } from 'vitest'
import { formatFileSize } from './securityDocumentStorage'

describe('security document storage',()=>{
  it('formats document sizes compactly',()=>{
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(2048)).toBe('2.0 KB')
    expect(formatFileSize(2_500_000)).toBe('2.4 MB')
  })
})
