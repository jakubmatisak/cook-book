// @vitest-environment node
import { existsSync, readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { siteUrlPlugin } from '../../siteUrl.config'

const html = readFileSync('index.html', 'utf8')
const meta = (attr: 'property' | 'name', key: string) =>
  new RegExp(String.raw`<meta\s+${attr}="${key}"\s+content="([^"]*)"`).exec(html)?.[1]

describe('náhľad pri zdieľaní odkazu (Open Graph, Twitter)', () => {
  it('má Open Graph značky s názvom, popisom a obrázkom', () => {
    expect(meta('property', 'og:type')).toBe('website')
    expect(meta('property', 'og:site_name')).toBe('Kuchárska kniha')
    expect(meta('property', 'og:title')).toBeTruthy()
    expect(meta('property', 'og:description')).toBeTruthy()
    expect(meta('property', 'og:locale')).toBe('sk_SK')
    expect(meta('property', 'og:image')).toBe('%SITE_URL%/og-image.png')
    expect(meta('property', 'og:image:width')).toBe('1200')
    expect(meta('property', 'og:image:height')).toBe('630')
    expect(meta('property', 'og:image:alt')).toBeTruthy()
  })

  it('má Twitter kartu s veľkým obrázkom', () => {
    expect(meta('name', 'twitter:card')).toBe('summary_large_image')
    expect(meta('name', 'twitter:image')).toBe('%SITE_URL%/og-image.png')
    expect(meta('name', 'twitter:title')).toBeTruthy()
  })

  it('predvolený obrázok s hrncom existuje (PNG 1200×630)', () => {
    expect(existsSync('public/og-image.png')).toBe(true)
    expect(statSync('public/og-image.png').size).toBeGreaterThan(5_000)
    const png = readFileSync('public/og-image.png')
    expect(png.subarray(1, 4).toString()).toBe('PNG')
    expect(png.readUInt32BE(16)).toBe(1200)
    expect(png.readUInt32BE(20)).toBe(630)
  })
})

describe('adresa stránky v značkách', () => {
  const plugin = siteUrlPlugin('https://kniha.example.com/')
  const transform = (plugin.transformIndexHtml as (html: string) => string).bind(plugin)

  it('dosadí adresu bez koncovej lomky', () => {
    expect(transform('<meta content="%SITE_URL%/og-image.png" />')).toBe(
      '<meta content="https://kniha.example.com/og-image.png" />',
    )
  })

  it('bez nastavenej adresy ostane relatívna cesta', () => {
    const none = siteUrlPlugin(undefined)
    expect((none.transformIndexHtml as (html: string) => string)('%SITE_URL%/og-image.png')).toBe(
      '/og-image.png',
    )
  })
})
