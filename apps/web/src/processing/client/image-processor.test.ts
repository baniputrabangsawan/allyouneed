import { describe, expect, it } from 'vitest'
import { encodePngRgba } from './png-codec'
import { compressPng } from './png-compress'
import { executeImageJob } from './image-jobs'
import { runImageJob } from './image-processor'
import { collectTransferables, resultFromSerialized, type SerializedImageJob } from './image-processor-protocol'

function graphicPng(width: number, height: number): Uint8Array {
  const rgba = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      rgba[index] = x < width / 2 ? 220 : 40
      rgba[index + 1] = y < height / 2 ? 40 : 160
      rgba[index + 2] = 80
      rgba[index + 3] = 255
    }
  }
  return encodePngRgba({ width, height, rgba, hasAlpha: false })
}

describe('image processor protocol', () => {
  it('collects transferable buffers without encoding files as base64', () => {
    const buffer = new ArrayBuffer(8)
    const watermark = new ArrayBuffer(4)
    const job: SerializedImageJob = {
      op: 'processImage',
      file: { buffer, type: 'image/png', name: 'source.png' },
      options: { format: 'image/png', quality: 1 },
      watermarkImage: { buffer: watermark, type: 'image/png', name: 'mark.png' },
    }
    expect(collectTransferables(job)).toEqual([buffer, watermark])
  })

  it('rebuilds a result Blob from a transferred buffer', () => {
    const bytes = new Uint8Array([1, 2, 3, 4])
    const result = resultFromSerialized({
      buffer: bytes.buffer,
      mime: 'image/png',
      originalSize: 10,
      optimizedSize: 4,
      savedBytes: 6,
      savedRatio: 0.6,
      recommendWebp: false,
      width: 2,
      height: 2,
    })
    expect(result.blob.type).toBe('image/png')
    expect(result.blob.size).toBe(4)
    expect(result.optimizedSize).toBe(4)
    expect(result.width).toBe(2)
  })
})

describe('image job runner', () => {
  it('uses the same PNG compressor on the fallback path', async () => {
    const bytes = graphicPng(48, 32)
    const file = new File([Uint8Array.from(bytes)], 'graphic.png', { type: 'image/png' })
    const direct = await compressPng(bytes, { mode: 'balanced' })
    const job = await executeImageJob({ op: 'compressPng', file, mode: 'balanced' })
    expect(job.mime).toBe('image/png')
    expect(job.optimizedSize).toBe(direct.compressedSize)
    expect(job.originalSize).toBe(direct.originalSize)
    expect(job.quantized).toBe(direct.quantized)
    expect(job.blob.size).toBe(direct.compressedSize)
  })

  it('falls back without a Worker and reports 0–100 progress', async () => {
    const bytes = graphicPng(64, 48)
    const file = new File([Uint8Array.from(bytes)], 'graphic.png', { type: 'image/png' })
    const percents: number[] = []
    const result = await runImageJob({ op: 'compressPng', file, mode: 'balanced' }, (progress) => {
      if (progress.progress != null) percents.push(progress.progress)
    })
    expect(result.mime).toBe('image/png')
    expect(result.optimizedSize).toBeLessThanOrEqual(result.originalSize)
    expect(percents[0]).toBe(0)
    expect(percents.at(-1)).toBe(100)
    expect(new Set(percents).size).toBeGreaterThan(1)
  })
})
