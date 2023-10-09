// https://en.wikipedia.org/wiki/List_of_file_signatures

interface FileType {
  extension: string;
  mimetypes: string[];
  signature?: Uint8Array
}

const types: FileType[] = [
  {
    extension: 'ttf',
    mimetypes: ['application/x-font-ttf', 'application/x-font-truetype', 'font/truetype'],
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
    return types.find(x => x.mimetypes.includes(mimetype))
  }

  getFromExtension (extension: string) {
    return types.find(x => x.extension === extension.toLowerCase())
  }

  getFromSignature (signature: Uint8Array | ArrayBuffer) {
    if (signature instanceof ArrayBuffer) {
      // Convert to Uint8Array
      signature = new Uint8Array(signature, 0, 10)
    }
    return types.find(library => library.signature && this.bufferIsEqual(library.signature, signature as Uint8Array))
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
