export default {
  async fetch(request) {
    const url = new URL(request.url)
    if (url.pathname === '/api/v1/health') return Response.json({ ok: true })
    return Response.json({ error: { code: 'not_found', message: 'Nenájdené' } }, { status: 404 })
  },
} satisfies ExportedHandler<Env>
