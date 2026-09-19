import { defineConfig } from 'vitepress'

const hostname = 'https://docs.note.sx'

export default defineConfig({
  title: 'Share Note',
  description: 'Instantly share an Obsidian note, with the full theme and content exactly like you see it in your vault. Encrypted by default.',
  cleanUrls: true,
  lastUpdated: true,
  sitemap: { hostname },
  head: [
    ['link', { rel: 'icon', href: '/icon.png' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:image', content: `${hostname}/og-image.png` }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '675' }]
  ],
  themeConfig: {
    logo: { light: '/logo-black.png', dark: '/logo-white.png', alt: 'Share Note' },
    siteTitle: false,
    search: { provider: 'local' },
    nav: [
      { text: 'Get the plugin', link: 'https://obsidian.md/plugins?id=share-note' },
      { text: 'Roadmap', link: 'https://note.sx/roadmap' }
    ],
    sidebar: [
      {
        text: 'Getting started',
        items: [
          { text: 'About Share Note', link: '/' },
          { text: 'Sharing your first note', link: '/sharing-your-first-note' },
          { text: 'Settings', link: '/settings' }
        ]
      },
      {
        text: 'Features',
        items: [
          { text: 'Encryption', link: '/notes/encryption' },
          { text: 'Theme', link: '/notes/theme' },
          { text: 'Self-deleting notes', link: '/notes/self-deleting-notes' },
          { text: 'Letting readers import your note', link: '/notes/importing-shared-notes' },
          { text: 'Managing your notes', link: '/notes/managing-your-notes' },
          { text: 'Frontmatter properties', link: '/notes/frontmatter-properties' }
        ]
      },
      {
        text: 'Help',
        items: [
          { text: 'Troubleshooting', link: '/troubleshooting' },
          { text: 'FAQ', link: '/faq' },
          { text: 'Running your own server', link: '/running-your-own-server' }
        ]
      }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/alangrainger/share-note' }
    ],
    editLink: {
      pattern: 'https://github.com/alangrainger/share-note/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    },
    outline: 'deep'
  }
})
