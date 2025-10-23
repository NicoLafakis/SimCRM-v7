const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.APP_JWT_SECRET || 'dev-insecure-secret-change'
const TOKEN_TTL_SEC = 60 * 60 * 6 // 6h

function issueToken(user) {
  const payload = { sub: user.id, role: user.role || 'player', pn: user.playerName }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL_SEC })
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}

function authMiddleware(req, _res, next) {
  // Dev header bypass remains optionally (explicit env to allow)
  const allowDev = process.env.APP_ALLOW_DEV_HEADER === '1'
  const auth = req.headers.authorization
  if (auth && auth.startsWith('Bearer ')) {
    const raw = auth.slice(7)
    const decoded = verifyToken(raw)
    if (decoded) {
      req.user = { id: decoded.sub, role: decoded.role, playerName: decoded.pn }
      return next()
    }
  }
  if (allowDev) {
    const devId = req.header('x-user-id') || req.query.userId
    if (devId) {
      req.user = { id: devId, role: req.header('x-user-role') || 'player', playerName: devId }
    }
  }
  return next()
}

module.exports = { issueToken, verifyToken, authMiddleware }
