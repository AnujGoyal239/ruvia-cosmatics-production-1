const User = require('../models/userModel');
const generateToken = require('../utils/generateToken');
const sendEmail = require('../utils/sendEmail');
const { welcomeEmail, passwordResetEmail } = require('../utils/emailTemplates');
const { getTokenCookieOptions } = require('../utils/cookieOptions');
const { revokeToken } = require('../middleware/authMiddleware');
const csrfTokenStore = require('../utils/csrfTokenStore');
const auditLogger = require('../utils/auditLogger');
const {
  generateAndSendVerificationEmail,
  verifyEmail,
  resendVerificationEmail,
} = require('../utils/emailVerificationUtil');
const crypto = require('crypto');

const normalizeAddress = (address = {}) => ({
  firstName: address.firstName || '',
  lastName: address.lastName || '',
  phone: address.phone || '',
  address: address.address || address.street || '',
  city: address.city || '',
  pin: address.pin || address.zipCode || '',
  _id: address._id,
});

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const authUser = async (req, res) => {
  const ipAddress = req.ip;
  const userAgent = req.headers['user-agent'];

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      auditLogger.logLogin({
        ipAddress,
        userAgent,
        status: 'failure',
        reason: 'missing_credentials',
      });
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      auditLogger.logLogin({
        ipAddress,
        userAgent,
        status: 'failure',
        reason: 'user_not_found',
      });
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check if account is locked
    if (user.isAccountLocked()) {
      auditLogger.logLogin({
        userId: user._id,
        ipAddress,
        userAgent,
        status: 'failure',
        reason: 'account_locked',
      });
      return res.status(429).json({ message: 'Account locked due to too many failed login attempts. Try again later.' });
    }

    // Check if account is blocked
    if (user.isBlocked) {
      auditLogger.logLogin({
        userId: user._id,
        ipAddress,
        userAgent,
        status: 'failure',
        reason: 'account_blocked',
      });
      return res.status(403).json({ message: 'Account has been suspended' });
    }

    const isPasswordValid = await user.matchPassword(password);

    if (isPasswordValid) {
      // Reset login attempts on successful login
      await user.resetLoginAttempts();

      const token = generateToken(user._id);
      res.cookie('token', token, getTokenCookieOptions());

      auditLogger.logLogin({
        userId: user._id,
        ipAddress,
        userAgent,
        status: 'success',
      });

      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: token,
      });
    } else {
      // Increment failed login attempts
      await user.incLoginAttempts();
      auditLogger.logLogin({
        userId: user._id,
        ipAddress,
        userAgent,
        status: 'failure',
        reason: 'invalid_password',
      });
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    // Validate password strength
    if (password.length < 12) {
      return res.status(400).json({ message: 'Password must be at least 12 characters' });
    }

    // Check password complexity
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message: 'Password must contain uppercase, lowercase, number, and special character (@$!%*?&)'
      });
    }

    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Generate email verification token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');

    const user = await User.create({
      name,
      email,
      password,
      emailVerificationToken,
      emailVerificationExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    if (user) {
      const token = generateToken(user._id);

      // Send Welcome Email asynchronously
      try {
        const tpl = welcomeEmail({ user });
        setImmediate(() => {
          sendEmail({
            email: user.email,
            subject: tpl.subject,
            message: tpl.text,
            html: tpl.html,
          }).catch((err) => console.error('Welcome email could not be sent', err));
        });
      } catch (err) {
        console.error('Email could not be sent', err);
      }

      // Send Email Verification asynchronously (Req 19).
      // The util generates a fresh token + expiry on the user; verification is
      // currently OPTIONAL (not enforced at checkout) to avoid breaking flows.
      setImmediate(() => {
        generateAndSendVerificationEmail(user).catch((err) =>
          console.error('Verification email could not be sent', err)
        );
      });

      res.cookie('token', token, getTokenCookieOptions());

      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: token,
        message: 'Registration successful. Please verify your email.',
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/me
// @access  Private
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        addresses: (user.addresses || []).map(normalizeAddress),
        phone: user.phone,
        emailVerified: user.emailVerified,
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ message: 'Server error while fetching user profile' });
  }
};

// @desc    Update user profile (excludes role and sensitive fields)
// @route   PUT /api/auth/profile
// @access  Private
const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Only allow specific fields to be updated
    const allowedFields = ['name', 'phone', 'addresses'];
    const updates = {};

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // Handle email change with verification
    if (req.body.email && req.body.email !== user.email) {
      const emailExists = await User.findOne({ email: req.body.email });
      if (emailExists) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      updates.email = req.body.email;
      updates.emailVerified = false;
      updates.emailVerificationToken = crypto.randomBytes(32).toString('hex');
      updates.emailVerificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    // Handle password change (requires old password verification)
    if (req.body.password) {
      if (!req.body.oldPassword) {
        return res.status(400).json({ message: 'Old password is required to change password' });
      }

      const isOldPasswordValid = await user.matchPassword(req.body.oldPassword);
      if (!isOldPasswordValid) {
        return res.status(401).json({ message: 'Old password is incorrect' });
      }

      // Validate new password strength
      if (req.body.password.length < 12) {
        return res.status(400).json({ message: 'New password must be at least 12 characters' });
      }

      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/;
      if (!passwordRegex.test(req.body.password)) {
        return res.status(400).json({
          message: 'Password must contain uppercase, lowercase, number, and special character'
        });
      }

      updates.password = req.body.password;
    }

    Object.assign(user, updates);
    const updatedUser = await user.save();

    // Audit-log password changes performed via profile update
    if (updates.password) {
      auditLogger.logPasswordChange({
        userId: updatedUser._id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        reason: 'user_request',
      });
    }

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      addresses: (updatedUser.addresses || []).map(normalizeAddress),
      phone: updatedUser.phone,
      emailVerified: updatedUser.emailVerified,
      token: generateToken(updatedUser._id),
    });
  } catch (error) {
    console.error('Update user profile error:', error);
    res.status(500).json({ message: 'Server error while updating user profile' });
  }
};

// @desc    Request password reset
// @route   POST /api/auth/forgot-password
// @access  Public
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal if email exists (security best practice)
      return res.status(200).json({ message: 'If email exists, password reset link has been sent' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await user.save();

    // Send reset email
    try {
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
      const tpl = passwordResetEmail({ user, resetUrl });

      await sendEmail({
        email: user.email,
        subject: tpl.subject,
        message: tpl.text,
        html: tpl.html,
      });
    } catch (err) {
      console.error('Password reset email failed:', err);
      user.passwordResetToken = undefined;
      user.passwordResetExpiry = undefined;
      await user.save();
      return res.status(500).json({ message: 'Email could not be sent' });
    }

    res.status(200).json({ message: 'Password reset link has been sent to your email' });
  } catch (error) {
    console.error('Request password reset error:', error);
    res.status(500).json({ message: 'Server error while requesting password reset' });
  }
};

// @desc    Reset password with token
// @route   POST /api/auth/reset-password/:token
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    // Validate password strength
    if (password.length < 12) {
      return res.status(400).json({ message: 'Password must be at least 12 characters' });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message: 'Password must contain uppercase, lowercase, number, and special character'
      });
    }

    // Hash token and find user
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpiry: { $gt: Date.now() }
    });

    if (!user) {
      auditLogger.logPasswordReset({
        email: 'unknown',
        status: 'failure',
        reason: 'invalid_or_expired_token',
        ipAddress: req.ip,
      });
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    // Update password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpiry = undefined;
    // Invalidate all previously issued JWTs by bumping lastLogout. The auth
    // middleware checks token.iat against lastLogout and rejects older tokens.
    user.lastLogout = new Date();
    await user.save();

    auditLogger.logPasswordChange({
      userId: user._id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      reason: 'password_reset',
    });

    auditLogger.logPasswordReset({
      userId: user._id,
      email: user.email,
      status: 'success',
      ipAddress: req.ip,
    });

    res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error while resetting password' });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logoutUser = async (req, res) => {
  try {
    // Revoke token
    if (req.token) {
      revokeToken(req.token);
    }

    // Update last logout time
    await User.findByIdAndUpdate(req.user._id, {
      lastLogout: new Date()
    });

    res.clearCookie('token', getTokenCookieOptions());
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error during logout' });
  }
};

// @desc    Add address to user
// @route   POST /api/auth/address
// @access  Private
const addAddress = async (req, res) => {
  try {
    const address = normalizeAddress(req.body.address || req.body);

    if (!address.address && !address.city && !address.pin) {
      return res.status(400).json({ message: 'Address is required' });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.addresses = user.addresses || [];
    user.addresses.push(address);
    await user.save();

    res.json(user.addresses.map(normalizeAddress));
  } catch (error) {
    console.error('Add address error:', error);
    res.status(500).json({ message: 'Server error while adding address', error: error.message });
  }
};

// @desc    Remove address from user
// @route   DELETE /api/auth/address/:addressId
// @access  Private
const removeAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.addresses = user.addresses.filter(
      (addr) => addr._id.toString() !== req.params.addressId
    );

    await user.save();

    res.json(user.addresses.map(normalizeAddress));
  } catch (error) {
    console.error('Remove address error:', error);
    res.status(500).json({ message: 'Server error while removing address' });
  }
};

// @desc    Verify email address using verification token
// @route   GET /api/v1/auth/verify-email/:token
// @access  Public
const verifyEmailHandler = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Verification token is required',
      });
    }

    const result = await verifyEmail(token);

    if (!result.success) {
      // Token invalid or expired -> 400 Bad Request per Requirement 19
      return res.status(400).json({
        success: false,
        message: result.error || 'Invalid or expired verification token',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully',
    });
  } catch (error) {
    console.error('Email verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during email verification',
    });
  }
};

// @desc    Resend email verification link
// @route   POST /api/v1/auth/resend-verification
// @access  Public
const resendVerificationEmailHandler = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    // Always return a generic success message to avoid revealing whether the
    // email is registered or already verified (user enumeration protection).
    // The util handles the actual lookup, token regeneration, and send.
    const result = await resendVerificationEmail(email);

    if (!result.success) {
      // Log internally but don't leak details to the client
      console.warn('Resend verification skipped or failed:', result.error);
    }

    return res.status(200).json({
      success: true,
      message: 'If an account with that email exists and is not yet verified, a new verification link has been sent.',
    });
  } catch (error) {
    console.error('Resend verification email error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while resending verification email',
    });
  }
};

// @desc    Generate and return a CSRF token for the current session
// @route   GET /api/auth/csrf-token
// @access  Public
const getCsrfToken = async (req, res) => {
  try {
    // Use authenticated user ID when available, otherwise fall back to client IP
    const sessionId = req.user && req.user._id
      ? req.user._id.toString()
      : req.ip;

    const token = csrfTokenStore.generate(sessionId);

    // Expose the token via response header so SPA clients can read it
    res.setHeader('X-CSRF-Token', token);

    // Mirror the token in a SameSite=Strict cookie (double-submit pattern).
    // httpOnly is intentionally false so the frontend can echo the token back
    // in the X-CSRF-Token header on subsequent state-changing requests.
    // SameSite policy is environment-aware (None+Secure in prod for the
    // cross-site Vercel<->Render deployment, Lax for local dev).
    const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
    res.cookie('XSRF-TOKEN', token, {
      httpOnly: false,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
    });

    res.json({ csrfToken: token });
  } catch (error) {
    console.error('CSRF token generation error:', error);
    res.status(500).json({ message: 'Server error while generating CSRF token' });
  }
};

module.exports = {
  authUser,
  registerUser,
  getUserProfile,
  updateUserProfile,
  requestPasswordReset,
  resetPassword,
  logoutUser,
  addAddress,
  removeAddress,
  getCsrfToken,
  verifyEmailHandler,
  resendVerificationEmailHandler,
};
