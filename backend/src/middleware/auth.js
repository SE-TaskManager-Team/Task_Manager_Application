const User = require('../models/User');
const TokenBlocklist = require('../models/TokenBlocklist');
const { verifyToken, tokenHash } = require('../utils/security');

async function authenticate(req, res, next) {
  try {
    const authorization = req.get('authorization') || '';
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) return res.status(401).json({ success: false, error: { code: 'AUTHENTICATION_REQUIRED', message: 'A valid bearer token is required.' } });
    const token = match[1];
    let payload;
    try { payload = verifyToken(token); } catch (_error) {
      return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'The token is invalid or expired.' } });
    }
    const blocked = await TokenBlocklist.exists({ tokenHash: tokenHash(token) });
    if (blocked) return res.status(401).json({ success: false, error: { code: 'TOKEN_REVOKED', message: 'This session has been logged out.' } });
    const user = await User.findById(payload.sub).select('+passwordHash');
    if (!user || !user.isActive) return res.status(401).json({ success: false, error: { code: 'ACCOUNT_UNAVAILABLE', message: 'This account is unavailable.' } });
    // The current database role is authoritative; never trust a role supplied by the client/token.
    req.user = user;
    req.authToken = token;
    req.authPayload = payload;
    return next();
  } catch (error) { return next(error); }
}

const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication is required.' } });
  if (!roles.includes(req.user.role)) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Your role is not permitted to perform this operation.' } });
  return next();
};

module.exports = { authenticate, authorize };
