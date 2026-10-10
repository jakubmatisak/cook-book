import { Hono } from 'hono'
import {
  acceptShareSchema,
  createShareSchema,
  dismissNoticeSchema,
  shareItemsSchema,
} from '../../shared/schemas/sharing'
import type { AppEnv } from '../env'
import { parseBody } from '../http'
import {
  acceptShare,
  createShares,
  declineShare,
  dismissChangedNotice,
  leaveShare,
  listIncoming,
  listNotices,
  listOutgoing,
  markShareSeen,
  removeShareItems,
  revokeShare,
} from '../services/sharing'

const ok = { ok: true }

/** Zdieľanie receptov s inými domácnosťami cez e-mail (verejný odkaz `/s/<kód>` je v `/shared`). */
export const sharingRoutes = new Hono<AppEnv>()
  .post('/', async (c) => {
    const input = await parseBody(c, createShareSchema)
    return c.json(await createShares(c.get('db'), c.get('user'), input), 201)
  })
  .get('/outgoing', async (c) => c.json(await listOutgoing(c.get('db'), c.get('user').householdId)))
  .get('/incoming', async (c) => c.json(await listIncoming(c.get('db'), c.get('user'))))
  .get('/notices', async (c) => c.json(await listNotices(c.get('db'), c.get('user'))))
  .post('/notices/dismiss', async (c) => {
    const { recipeId } = await parseBody(c, dismissNoticeSchema)
    await dismissChangedNotice(c.get('db'), c.get('user').householdId, recipeId)
    return c.json(ok)
  })
  .post('/:id/accept', async (c) => {
    // Bez tela = prijať všetko.
    const body = c.req.header('content-type')?.includes('json') ? await parseBody(c, acceptShareSchema) : {}
    await acceptShare(c.get('db'), c.get('user'), c.req.param('id'), body.recipeIds)
    return c.json(ok)
  })
  .post('/:id/decline', async (c) => {
    await declineShare(c.get('db'), c.get('user'), c.req.param('id'))
    return c.json(ok)
  })
  .post('/:id/leave', async (c) => {
    await leaveShare(c.get('db'), c.get('user').householdId, c.req.param('id'))
    return c.json(ok)
  })
  .post('/:id/revoke', async (c) => {
    await revokeShare(c.get('db'), c.get('user').householdId, c.req.param('id'))
    return c.json(ok)
  })
  .post('/:id/items/remove', async (c) => {
    const { recipeIds } = await parseBody(c, shareItemsSchema)
    await removeShareItems(c.get('db'), c.get('user').householdId, c.req.param('id'), recipeIds)
    return c.json(ok)
  })
  .post('/:id/seen', async (c) => {
    await markShareSeen(c.get('db'), c.get('user').householdId, c.req.param('id'))
    return c.json(ok)
  })
