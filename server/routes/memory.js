const { Router } = require('express')
const { setMemoryPolicy, getMemoryPolicy, listExpiringPolicies, purgeExpiredPolicies, getExpiringItems, runCascadeCleanup } = require('../services/memory')

const router = Router()

const ok = (res, data) => res.json({ ok: true, data })
const err = (res, msg, status = 400) => res.status(status).json({ ok: false, error: msg })

const VALID_TARGET_TYPES = ['source', 'claim', 'entity', 'conflict', 'message']
const VALID_POLICIES = ['session', '24h', '7d', 'project', 'manual']

router.get('/', (req, res) => {
  const { targetType, targetId } = req.query
  if (!targetType || !targetId) return err(res, 'targetType and targetId are required')
  try { ok(res, getMemoryPolicy(targetType, targetId)) }
  catch (e) { err(res, e.message, 500) }
})

router.post('/', (req, res) => {
  const { targetType, targetId, retentionPolicy, inheritedFromId } = req.body || {}
  if (!targetType || !targetId || !retentionPolicy) return err(res, 'targetType, targetId, retentionPolicy are required')
  if (!VALID_TARGET_TYPES.includes(targetType)) return err(res, `targetType must be one of: ${VALID_TARGET_TYPES.join(', ')}`)
  if (!VALID_POLICIES.includes(retentionPolicy)) return err(res, `retentionPolicy must be one of: ${VALID_POLICIES.join(', ')}`)
  try { ok(res, setMemoryPolicy({ targetType, targetId, retentionPolicy, inheritedFromId })) }
  catch (e) { err(res, e.message, 500) }
})

router.get('/expiring', (req, res) => {
  const withinMs = parseInt(req.query.withinMs) || 86400000
  try { ok(res, listExpiringPolicies(withinMs)) }
  catch (e) { err(res, e.message, 500) }
})

router.post('/purge', (req, res) => {
  try { ok(res, { purged: purgeExpiredPolicies() }) }
  catch (e) { err(res, e.message, 500) }
})

router.get('/expiring/:workspaceId', (req, res) => {
  const { workspaceId } = req.params
  const within = parseInt(req.query.within) || 86400000
  try { ok(res, getExpiringItems(workspaceId, within)) }
  catch (e) { err(res, e.message, 500) }
})

router.post('/cleanup/:workspaceId', (req, res) => {
  const { workspaceId } = req.params
  try { ok(res, runCascadeCleanup(workspaceId)) }
  catch (e) { err(res, e.message, 500) }
})

module.exports = router
