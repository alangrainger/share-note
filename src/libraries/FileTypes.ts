// https://en.wikipedia.org/wiki/List_of_file_signatures

interface IFileType {
  extension: string
  mimetypes: string[]
  signature?: Uint8Array
}

class FileType implements IFileType {
  extension: string
  mimetypes: string[]
  signature?: Uint8Array

  constructor (fileType: IFileType) {
    this.extension = fileType.extension
    this.mimetypes = fileType.mimetypes
    this.signature = fileType.signature
  }

  get mimetype () {
    return this.mimetypes[0]
  }
}

const types: IFileType[] = [
  {
    extension: 'ttf',
    mimetypes: ['font/ttf', 'application/x-font-ttf', 'application/x-font-truetype', 'font/truetype'],
    signature: Buffer.from([0x00, 0x01, 0x00, 0x00, 0x00])
  },
  {
    extension: 'otf',
    mimetypes: ['font/otf', 'application/x-font-opentype'],
    signature: Buffer.from([0x4F, 0x54, 0x54, 0x4F])
  },
  {
    extension: 'woff',
    mimetypes: ['font/woff', 'application/font-woff', 'application/x-font-woff'],
    signature: Buffer.from([0x77, 0x4F, 0x46, 0x46])
  },
  {
    extension: 'woff2',
    mimetypes: ['font/woff2', 'application/font-woff2', 'application/x-font-woff2'],
    signature: Buffer.from([0x77, 0x4F, 0x46, 0x32])
  },
  {
    extension: 'svg',
    mimetypes: ['image/svg+xml']
  }
]

class FileTypes {
  getFromMimetype (mimetype: string) {
    const type = types.find(x => x.mimetypes.includes(mimetype))
    return type ? new FileType(type) : undefined
  }

  getFromExtension (extension: string) {
    const type = types.find(x => x.extension === extension.toLowerCase())
    return type ? new FileType(type) : undefined
  }

  getFromSignature (signature: Uint8Array | ArrayBuffer) {
    if (signature instanceof ArrayBuffer) {
      // Convert to Uint8Array
      signature = new Uint8Array(signature, 0, 10)
    }
    const type = types.find(library => library.signature && this.bufferIsEqual(library.signature, signature as Uint8Array))
    return type ? new FileType(type) : undefined
  }

  bufferIsEqual (librarySignature: Uint8Array, userSignature: Uint8Array) {
    for (let i = 0; i < librarySignature.length; i++) {
      if (librarySignature[i] !== userSignature?.[i]) {
        return false
      }
    }
    return true
  }
}

export default new FileTypes()
