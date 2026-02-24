const bcrypt = require('bcryptjs');
const { 
  generateAccessToken, 
  generateRefreshToken, 
  verifyRefreshToken 
} = require('../config/auth');
const { findOne, findMany, insert, update, remove } = require('../config/database');
const { logAuditEvent } = require('../middleware/errorHandler');

// Login controller
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await findOne('users', { email });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if user is active
    if (user.status !== 'ACTIVE') {
      return res.status(401).json({
        success: false,
        message: 'Account is inactive. Please contact administrator.'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate tokens
    const payload = {
      userId: user.id,
      role: user.role,
      department: user.department
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Store refresh token in database
    const refreshTokenHash = bcrypt.hashSync(refreshToken, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    await insert('refresh_tokens', {
      user_id: user.id,
      token_hash: refreshTokenHash,
      expires_at: expiresAt
    });

    // Log successful login
    await logAuditEvent(user.id, 'LOGIN', 'USER', user.id, null, {
      login_time: new Date(),
      ip_address: req.ip
    });

    // Update last login time
    await update('users', { last_login: new Date() }, { id: user.id });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: '24h'
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Refresh token controller
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token required'
      });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Find user
    const user = await findOne('users', { id: decoded.userId, status: 'ACTIVE' });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    // Check if refresh token exists and is not revoked
    const storedTokens = await findMany('refresh_tokens', { 
      user_id: user.id, 
      is_revoked: false 
    });

    let validTokenFound = false;
    for (const tokenRecord of storedTokens) {
      if (bcrypt.compareSync(refreshToken, tokenRecord.token_hash)) {
        validTokenFound = true;
        
        // Check if token is expired
        if (new Date() > tokenRecord.expires_at) {
          // Remove expired token
          await remove('refresh_tokens', { id: tokenRecord.id }, false);
          return res.status(401).json({
            success: false,
            message: 'Refresh token expired'
          });
        }
        break;
      }
    }

    if (!validTokenFound) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    // Generate new tokens
    const payload = {
      userId: user.id,
      role: user.role,
      department: user.department
    };

    const newAccessToken = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    // Store new refresh token and revoke old ones
    const refreshTokenHash = bcrypt.hashSync(newRefreshToken, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Revoke all old tokens for this user
    await update('refresh_tokens', { is_revoked: true }, { user_id: user.id });

    // Insert new refresh token
    await insert('refresh_tokens', {
      user_id: user.id,
      token_hash: refreshTokenHash,
      expires_at: expiresAt
    });

    await logAuditEvent(user.id, 'TOKEN_REFRESH', 'USER', user.id, null, {
      refresh_time: new Date()
    });

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        tokens: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          expiresIn: '24h'
        }
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Logout controller
const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      // Find and revoke the refresh token
      const storedTokens = await findMany('refresh_tokens', { 
        user_id: req.user.id, 
        is_revoked: false 
      });

      for (const tokenRecord of storedTokens) {
        if (bcrypt.compareSync(refreshToken, tokenRecord.token_hash)) {
          await update('refresh_tokens', { is_revoked: true }, { id: tokenRecord.id });
          break;
        }
      }
    } else {
      // Revoke all refresh tokens for this user
      await update('refresh_tokens', { is_revoked: true }, { user_id: req.user.id });
    }

    await logAuditEvent(req.user.id, 'LOGOUT', 'USER', req.user.id, null, {
      logout_time: new Date()
    });

    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const user = await findOne('users', { id: req.user.id });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        status: user.status,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update profile
const updateProfile = async (req, res) => {
  try {
    const { name, department } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (department) updateData.department = department;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    await update('users', updateData, { id: req.user.id });

    await logAuditEvent(req.user.id, 'PROFILE_UPDATE', 'USER', req.user.id, null, updateData);

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    // Get current user
    const user = await findOne('users', { id: req.user.id });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const newPasswordHash = bcrypt.hashSync(newPassword, 10);

    // Update password
    await update('users', { password_hash: newPasswordHash }, { id: req.user.id });

    // Revoke all refresh tokens (force re-login)
    await update('refresh_tokens', { is_revoked: true }, { user_id: req.user.id });

    await logAuditEvent(req.user.id, 'PASSWORD_CHANGE', 'USER', req.user.id, null, {
      password_changed_at: new Date()
    });

    res.json({
      success: true,
      message: 'Password changed successfully. Please login again.'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  login,
  refreshToken,
  logout,
  getProfile,
  updateProfile,
  changePassword
};
