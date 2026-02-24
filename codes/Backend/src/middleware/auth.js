const { verifyAccessToken, extractTokenFromHeader } = require('../config/auth');
const { findOne } = require('../config/database');

// Authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const decoded = verifyAccessToken(token);
    
    // Get user from database
    const user = await findOne('users', { id: decoded.userId, status: 'ACTIVE' });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    // Attach user to request object
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message || 'Authentication failed'
    });
  }
};

// Role-based authorization middleware
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

// Resource ownership middleware (for students to access their own cases)
const authorizeOwnership = (resourceType, resourceIdParam = 'id') => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[resourceIdParam];
      const userId = req.user.id;
      const userRole = req.user.role;

      // Admin and orthodontists can access all resources
      if (['ADMIN', 'ORTHODONTIST'].includes(userRole)) {
        return next();
      }

      let resource;
      switch (resourceType) {
        case 'case':
          resource = await findOne('cases', { id: resourceId, student_id: userId });
          break;
        case 'clinical_note':
          resource = await findOne('clinical_notes', { id: resourceId, author_id: userId });
          break;
        case 'document':
          resource = await findOne('medical_documents', { id: resourceId, uploaded_by: userId });
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid resource type'
          });
      }

      if (!resource) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Resource not found or not owned by you'
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Authorization check failed'
      });
    }
  };
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (token) {
      const decoded = verifyAccessToken(token);
      const user = await findOne('users', { id: decoded.userId, status: 'ACTIVE' });
      
      if (user) {
        req.user = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department
        };
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

module.exports = {
  authenticate,
  authorizeRoles,
  authorizeOwnership,
  optionalAuth
};
