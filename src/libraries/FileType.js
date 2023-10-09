const bufferIsEqual = function (buf1, buf2) {
  let i
  if (buf1.length !== buf2.length) { return false }
  for (i = buf1.length - 1; i >= 0; i--) {
    if (buf1[i] !== buf2[i]) { return false }
  }
  return true
}

export default function fileSignature (buf) {
  for (const signature of signatures) {
    if (bufferIsEqual(buf.slice(0, signature.byteSeq.length), signature.byteSeq)) {
      return {
        extension: signature?.extension || '',
        mimeType: signature?.mimeType.mime || 'application/octet-stream'
      }
    }
  }
}

/**
 * Looks for a signature match, and returns information about the signature
 *
 * returns undefined if no match
 */

const signatures = [
  {
    byteSeq: Buffer.from([0x00, 0x01, 0x00, 0x00, 0x00]),
    extension: 'ttf',
    mimeType: {
      mime: 'font/ttf',
      extensions: ['ttf']
    }
  },
  {
    byteSeq: Buffer.from([0xff, 0xd8, 0xff]),
    extension: 'jpg',
    mimeType: {
      mime: 'image/jpg',
      extensions: ['jpg', 'jpeg']
    }
  },
  {
    byteSeq: Buffer.from([0x42, 0x4d]),
    extension: 'bmp',
    mimeType: {
      mime: 'image/bmp',
      extensions: ['bmp']
    }
  },
  {
    byteSeq: Buffer.from([0x47, 0x49, 0x46, 0x38]),
    extension: 'gif',
    mimeType: {
      mime: 'image/gif',
      extensions: ['gif']
    }
  },
  {
    byteSeq: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    extension: 'png',
    mimeType: {
      mime: 'image/png',
      extensions: ['png']
    }
  },
  {
    byteSeq: Buffer.from([0x4d, 0x4d, 0x00, 0x2a]),
    extension: 'tif',
    mimeType: {
      mime: 'image/tiff',
      extensions: ['tif', 'tiff']
    }
  },
  {
    byteSeq: Buffer.from([0x49, 0x49, 0x2a, 0x00]),
    extension: 'tif',
    mimeType: {
      mime: 'image/tiff',
      extensions: ['tif', 'tiff']
    }
  },
  {
    byteSeq: Buffer.from([0x49, 0x20, 0x49]),
    extension: 'tif',
    mimeType: {
      mime: 'image/tiff',
      extensions: ['tif', 'tiff']
    }
  },
  {
    byteSeq: Buffer.from([0x00]),
    extension: [
      'PIC',
      'PIF',
      'SEA',
      'YTR'
    ]
  },
  {
    byteSeq: Buffer.from([0xBE, 0xBA, 0xFE, 0xCA]),
    extension: [
      'DBA'
    ]
  },
  {
    byteSeq: Buffer.from([0x00, 0x01, 0x42, 0x44]),
    extension: [
      'DBA'
    ]
  },
  {
    byteSeq: Buffer.from([0x00, 0x01, 0x44, 0x54]),
    extension: [
      'TDA'
    ]
  },
  {
    byteSeq: Buffer.from([0x00, 0x01, 0x00, 0x00]),
    extension: [
      '...'
    ]
  },
  {
    byteSeq: Buffer.from([0x00, 0x00, 0x01, 0x00]),
    extension: [
      'ico'
    ],
    mimeType: {
      mime: 'image/x-icon',
      extensions: [
        'ico'
      ]
    }
  },
  {
    byteSeq: Buffer.from([0x1F, 0x9D]),
    extension: [
      'z',
      'tar.z'
    ]
  },
  {
    byteSeq: Buffer.from([0x1F, 0xA0]),
    extension: [
      'z',
      'tar.z'
    ]
  },
  {
    byteSeq: Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0x47, 0x49, 0x46, 0x38, 0x39, 0x61]),
    extension: [
      'gif'
    ],
    mimeType: {
      mime: 'image/gif',
      extensions: [
        'gif'
      ]
    }
  },
  {
    byteSeq: Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x4D, 0x4D, 0x00, 0x2A]),
    extension: [
      'tif',
      'tiff'
    ],
    mimeType: {
      mime: 'image/tiff',
      extensions: [
        'tiff',
        'tif'
      ]
    }
  },
  {
    byteSeq: Buffer.from([0x4D, 0x5A]),
    extension: [
      'exe'
    ],
    mimeType: {
      mime: 'application/x-msdownload',
      extensions: [
        'exe',
        'dll',
        'com',
        'bat',
        'msi'
      ]
    }
  },
  {
    byteSeq: Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x00]),
    extension: [
      'rar'
    ],
    mimeType: {
      mime: 'application/x-rar-compressed',
      extensions: [
        'rar'
      ]
    }
  },
  {
    byteSeq: Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x01, 0x00]),
    extension: [
      'rar'
    ],
    mimeType: {
      mime: 'application/x-rar-compressed',
      extensions: [
        'rar'
      ]
    }
  },
  {
    byteSeq: Buffer.from([0x7F, 0x45, 0x4C, 0x46]),
    extension: [
      ''
    ]
  },
  {
    byteSeq: Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    extension: [
      'png'
    ],
    mimeType: {
      mime: 'image/png',
      extensions: [
        'png'
      ]
    }
  },
  {
    byteSeq: Buffer.from([0xCA, 0xFE, 0xBA, 0xBE]),
    extension: [
      'class'
    ],
    mimeType: {
      mime: 'application/java-vm',
      extensions: [
        'class'
      ]
    }
  },
  {
    byteSeq: Buffer.from([0xEF, 0xBB, 0xBF]),
    extension: [
      ''
    ]
  },
  {
    byteSeq: Buffer.from([0xFE, 0xED, 0xFA, 0xCE]),
    extension: [
      ''
    ]
  },
  {
    byteSeq: Buffer.from([0xFE, 0xED, 0xFA, 0xCF]),
    extension: [
      ''
    ]
  },
  {
    byteSeq: Buffer.from([0xCE, 0xFA, 0xED, 0xFE]),
    extension: [
      ''
    ]
  },
  {
    byteSeq: Buffer.from([0xCF, 0xFA, 0xED, 0xFE]),
    extension: [
      ''
    ]
  },
  {
    byteSeq: Buffer.from([0xFF, 0xFE]),
    extension: [
      ''
    ]
  },
  {
    byteSeq: Buffer.from([0xFF, 0xFE, 0x00, 0x00]),
    extension: [
      ''
    ]
  },
  {
    byteSeq: Buffer.from([0x25, 0x50, 0x44, 0x46]),
    extension: [
      'pdf'
    ],
    mimeType: {
      mime: 'application/pdf',
      extensions: [
        'pdf'
      ]
    }
  },
  {
    byteSeq: Buffer.from([0x30, 0x26, 0xB2, 0x75, 0x8E, 0x66, 0xCF, 0x11, 0xA6, 0xD9, 0x00, 0xAA, 0x00, 0x62, 0xCE, 0x6C]),
    extension: [
      'asf',
      'wma',
      'wmv'
    ],
    mimeType: {
      mime: 'video/x-ms-asf',
      extensions: [
        'asf',
        'asx'
      ]
    }
  },
  {
    byteSeq: Buffer.from([0x24, 0x53, 0x44, 0x49, 0x30, 0x30, 0x30, 0x31]),
    extension: [
      ''
    ]
  },
  {
    byteSeq: Buffer.from([0x4F, 0x67, 0x67, 0x53]),
    extension: [
      'ogg',
      'oga',
      'ogv'
    ],
    mimeType: {
      mime: 'audio/ogg',
      extensions: [
        'oga',
        'ogg',
        'spx'
      ]
    }
  },
  {
    byteSeq: Buffer.from([0x38, 0x42, 0x50, 0x53]),
    extension: [
      'psd'
    ],
    mimeType: {
      mime: 'image/vnd.adobe.photoshop',
      extensions: [
        'psd'
      ]
    }
  },
  {
    byteSeq: Buffer.from([0xFF, 0xFB]),
    extension: [
      'mp3'
    ],
    mimeType: {
      mime: 'audio/mpeg',
      extensions: [
        'mpga',
        'mp2',
        'mp2a',
        'mp3',
        'm2a',
        'm3a'
      ]
    }
  },
  {
    byteSeq: Buffer.from([0x49, 0x44, 0x33]),
    extension: [
      'mp3'
    ],
    mimeType: {
      mime: 'audio/mpeg',
      extensions: [
        'mpga',
        'mp2',
        'mp2a',
        'mp3',
        'm2a',
        'm3a'
      ]
    }
  },
  {
    byteSeq: Buffer.from([0x42, 0x4D]),
    extension: [
      'bmp',
      'dib'
    ],
    mimeType: {
      mime: 'image/bmp',
      extensions: [
        'bmp'
      ]
    }
  },
  {
    byteSeq: Buffer.from([0x43, 0x44, 0x30, 0x30, 0x31]),
    extension: [
      'iso'
    ],
    mimeType: {
      mime: 'application/x-iso9660-image',
      extensions: [
        'iso'
      ]
    }
  },
  {
    byteSeq: Buffer.from([0x53, 0x49, 0x4d, 0x50, 0x4c, 0x45, 0x20, 0x20, 0x3d, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x54]),
    extension: [
      'fits'
    ]
  },
  {
    byteSeq: Buffer.from([0x66, 0x4C, 0x61, 0x43]),
    extension: [
      'flac'
    ],
    mimeType: {
      mime: 'audio/x-flac',
      extensions: [
        'flac'
      ]
    }
  }
]
