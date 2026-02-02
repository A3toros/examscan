export const ensureAudioAvailable = (blob?: Blob) => {
  if (!blob || blob.size === 0) {
    throw new Error('No audio captured. Please try recording again.')
  }
  return blob
}

export const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]!)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

