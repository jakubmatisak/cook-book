import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import type { ApiErrorBody, ImportRecipeResultDto } from '@shared/api'
import { createApp } from '../../worker/app'
import { isForbiddenHost } from '../../worker/services/importRecipe'
import { api, send } from './helpers'

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])

const recipeLd = {
  '@context': 'https://schema.org',
  '@type': 'Recipe',
  name: 'Palacinky',
  description: 'Tenké palacinky.',
  image: 'https://cdn.example.com/palacinky.png',
  recipeYield: '4 porcie',
  prepTime: 'PT10M',
  cookTime: 'PT15M',
  recipeIngredient: ['250 ml mlieka', '2 vajcia', '200 g múky'],
  recipeInstructions: [
    { '@type': 'HowToStep', text: 'Zmiešaj.' },
    { '@type': 'HowToStep', text: 'Upeč.' },
  ],
}

const page = (body: string, head = '') =>
  `<!doctype html><html><head><title>x</title>${head}</head><body>${body}</body></html>`
const jsonLdPage = (ld: unknown) =>
  page('', `<script type="application/ld+json">${JSON.stringify(ld)}</script>`)

type Handler = (url: URL) => Response | Promise<Response>

/** Falošný fetch: stránky podľa adresy, všetko ostatné je 404. Eviduje volané adresy. */
function fakeFetch(routes: Record<string, Handler | Response>) {
  const calls: string[] = []
  const fn: typeof fetch = async (input) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    calls.push(url.href)
    const hit = routes[url.href]
    if (!hit) return new Response('nenájdené', { status: 404 })
    return typeof hit === 'function' ? hit(url) : hit.clone()
  }
  return { fn, calls }
}

const html = (body: string, status = 200) =>
  new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } })

const importUrl = (fetchFn: typeof fetch, url: string) =>
  send(createApp({ fetchFn }), 'POST', api('/recipes/import'), { url })

const errorOf = async (res: Response) => (await res.json<ApiErrorBody>()).error

describe('isForbiddenHost', () => {
  it('zakáže lokálne a privátne adresy', () => {
    for (const host of [
      'localhost',
      'foo.localhost',
      'nas.local',
      'db.internal',
      '127.0.0.1',
      '10.1.2.3',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '[::1]',
      '[fe80::1]',
      '[fd12:3456::1]',
      '2130706433',
      '0x7f000001',
    ]) {
      expect(isForbiddenHost(host), host).toBe(true)
    }
  })

  it('verejné adresy prejdú', () => {
    for (const host of ['example.com', 'recepty.sk', '8.8.8.8', '172.32.0.1', 'www.varecha.sk']) {
      expect(isForbiddenHost(host), host).toBe(false)
    }
  })
})

describe('POST /recipes/import', () => {
  it('načíta recept z JSON-LD a stiahne fotku do úložiska', async () => {
    const { fn, calls } = fakeFetch({
      'https://example.com/palacinky': html(jsonLdPage(recipeLd)),
      'https://cdn.example.com/palacinky.png': new Response(PNG, {
        headers: { 'content-type': 'image/png' },
      }),
    })
    const res = await importUrl(fn, 'https://example.com/palacinky')
    expect(res.status).toBe(200)
    const body = await res.json<ImportRecipeResultDto>()
    expect(body.warnings).toEqual([])
    expect(body.recipe).toMatchObject({
      title: 'Palacinky',
      servings: 4,
      prepMinutes: 10,
      cookMinutes: 15,
      sourceUrl: 'https://example.com/palacinky',
      steps: [{ text: 'Zmiešaj.' }, { text: 'Upeč.' }],
    })
    expect(body.recipe.ingredients?.map((i) => [i.name, i.quantity, i.unit])).toEqual([
      ['mlieka', 250, 'ml'],
      ['vajcia', 2, null],
      ['múky', 200, 'g'],
    ])
    expect(body.coverImageUrl).toMatch(/^\/img\/.+\.png$/)
    expect(body.recipe.coverImageId).toBeTruthy()
    expect(calls).toEqual(['https://example.com/palacinky', 'https://cdn.example.com/palacinky.png'])
    expect((await env.BUCKET.list()).objects).toHaveLength(1)
  })

  it('recept bez fotky vráti bez fotky', async () => {
    const { fn } = fakeFetch({
      'https://example.com/r': html(jsonLdPage({ ...recipeLd, image: undefined })),
    })
    const body = await (await importUrl(fn, 'https://example.com/r')).json<ImportRecipeResultDto>()
    expect(body.coverImageUrl).toBeNull()
    expect(body.recipe.coverImageId ?? null).toBeNull()
  })

  it('nepodarená fotka nezhodí import, len pridá upozornenie', async () => {
    const { fn } = fakeFetch({
      'https://example.com/r': html(jsonLdPage(recipeLd)),
      'https://cdn.example.com/palacinky.png': new Response('nie je obrázok', {
        headers: { 'content-type': 'image/png' },
      }),
    })
    const res = await importUrl(fn, 'https://example.com/r')
    expect(res.status).toBe(200)
    const body = await res.json<ImportRecipeResultDto>()
    expect(body.coverImageUrl).toBeNull()
    expect(body.warnings).toEqual(['Fotku receptu sa nepodarilo stiahnuť.'])
    expect((await env.BUCKET.list()).objects).toHaveLength(0)
  })

  it('zloží recept z microdata vrátane textu v prvkoch', async () => {
    const markup = page(`
      <div itemscope itemtype="https://schema.org/Recipe">
        <h1 itemprop="name">Vajíčková &amp; praženica</h1>
        <meta itemprop="recipeYield" content="2 porcie">
        <time itemprop="cookTime" datetime="PT5M">5 minút</time>
        <ul><li itemprop="recipeIngredient">3 vajcia</li><li itemprop="recipeIngredient">1 PL masla</li></ul>
        <div itemprop="recipeInstructions">Rozpusti maslo. Pridaj vajcia.</div>
      </div>`)
    const { fn } = fakeFetch({ 'https://example.com/m': html(markup) })
    const res = await importUrl(fn, 'https://example.com/m')
    expect(res.status).toBe(200)
    const body = await res.json<ImportRecipeResultDto>()
    expect(body.recipe).toMatchObject({
      title: 'Vajíčková & praženica',
      servings: 2,
      cookMinutes: 5,
      steps: [{ text: 'Rozpusti maslo. Pridaj vajcia.' }],
    })
    expect(body.recipe.ingredients?.map((i) => [i.name, i.quantity, i.unit])).toEqual([
      ['vajcia', 3, null],
      ['masla', 1, 'PL'],
    ])
  })

  it('stránka bez receptu je 422 no_recipe', async () => {
    const { fn } = fakeFetch({ 'https://example.com/blog': html(page('<p>Len text.</p>')) })
    const res = await importUrl(fn, 'https://example.com/blog')
    expect(res.status).toBe(422)
    expect((await errorOf(res)).code).toBe('no_recipe')
  })

  it('neplatná adresa je 400, lokálna alebo privátna 422 a nič sa nestiahne', async () => {
    const { fn, calls } = fakeFetch({})
    expect((await importUrl(fn, 'nie je adresa')).status).toBe(400)
    expect((await importUrl(fn, 'ftp://example.com/r')).status).toBe(400)
    for (const url of ['http://localhost/r', 'http://192.168.0.1/r', 'http://169.254.169.254/latest']) {
      const res = await importUrl(fn, url)
      expect(res.status, url).toBe(422)
      expect((await errorOf(res)).code).toBe('forbidden_host')
    }
    expect(calls).toEqual([])
  })

  it('presmerovanie na privátnu adresu sa zastaví', async () => {
    const { fn, calls } = fakeFetch({
      'https://example.com/r': new Response(null, {
        status: 302,
        headers: { location: 'http://10.0.0.5/tajne' },
      }),
    })
    const res = await importUrl(fn, 'https://example.com/r')
    expect(res.status).toBe(422)
    expect((await errorOf(res)).code).toBe('forbidden_host')
    expect(calls).toEqual(['https://example.com/r'])
  })

  it('presmerovanie na verejnú adresu sa nasleduje', async () => {
    const { fn } = fakeFetch({
      'https://example.com/old': new Response(null, { status: 301, headers: { location: '/new' } }),
      'https://example.com/new': html(jsonLdPage({ ...recipeLd, image: undefined })),
    })
    const res = await importUrl(fn, 'https://example.com/old')
    expect(res.status).toBe(200)
    expect((await res.json<ImportRecipeResultDto>()).recipe.sourceUrl).toBe('https://example.com/new')
  })

  it('zacyklené presmerovanie skončí chybou', async () => {
    const { fn } = fakeFetch({
      'https://example.com/a': new Response(null, { status: 302, headers: { location: '/a' } }),
    })
    const res = await importUrl(fn, 'https://example.com/a')
    expect(res.status).toBe(502)
    expect((await errorOf(res)).code).toBe('fetch_failed')
  })

  it('chyba servera, pád spojenia a iný typ obsahu sú zrozumiteľné chyby', async () => {
    const blocked = fakeFetch({ 'https://example.com/r': html('zakázané', 403) })
    const res403 = await importUrl(blocked.fn, 'https://example.com/r')
    expect(res403.status).toBe(502)
    expect((await errorOf(res403)).message).toContain('403')

    const broken: typeof fetch = () => Promise.reject(new Error('spojenie zlyhalo'))
    const resNet = await importUrl(broken, 'https://example.com/r')
    expect(resNet.status).toBe(502)
    expect((await errorOf(resNet)).code).toBe('fetch_failed')

    const pdf = fakeFetch({
      'https://example.com/r': new Response('%PDF', { headers: { 'content-type': 'application/pdf' } }),
    })
    const resPdf = await importUrl(pdf.fn, 'https://example.com/r')
    expect(resPdf.status).toBe(422)
    expect((await errorOf(resPdf)).code).toBe('not_html')
  })

  it('príliš veľká stránka sa odmietne', async () => {
    const { fn } = fakeFetch({
      'https://example.com/big': html('x'.repeat(2 * 1024 * 1024 + 10)),
    })
    const res = await importUrl(fn, 'https://example.com/big')
    expect(res.status).toBe(422)
    expect((await errorOf(res)).code).toBe('too_large')
  })
})
