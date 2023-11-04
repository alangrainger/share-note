import imageCompression, { Options } from 'browser-image-compression'

const types: { [key: string]: string } = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  bmp: 'image/jpeg' // force convert to JPG
}

async function compressArrayBuffer (data: ArrayBuffer, mimeType: string, options: Options) {
  const file = new File([data], '', { type: mimeType })
  const blob = await imageCompression(file, options)
  return blob.arrayBuffer()
}

export async function compressImage (data: ArrayBuffer, filetype: string) {
  const originalData = data
  const type = types[filetype]

  // Only compress supported images, and only if above 100Kb
  if (type && data.byteLength > 100 * 1024) {
    try {
      const defaultOptions = {
        maxSizeMB: 0.7,
        maxWidthOrHeight: 1400,
        preserveExif: false,
        initialQuality: 0.6,
        fileType: type
      }

      data = await compressArrayBuffer(data, type, defaultOptions)

      // If size is >200Kb, test compressing the file as JPG and see how the size compares
      if (data.byteLength > 200 * 1024) {
        const test = await compressArrayBuffer(data, type, Object.assign(defaultOptions, {
          fileType: 'image/jpeg'
        }))
        if (test.byteLength < data.byteLength) {
          data = test
          filetype = 'jpg'
        }
      }

      if (data.byteLength > originalData.byteLength) {
        // New file is bigger, return the original file
        data = originalData
      }
    } catch (e) {
      console.log(e)
    }
  }

  return {
    data,
    filetype,
    changed: data.byteLength !== originalData.byteLength
  }
}
