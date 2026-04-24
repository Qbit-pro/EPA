const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { google } = require("googleapis");

function publicUser(user) {
  return {
    _id: user._id,
    username: user.username,
    email: user.email,
    googleDriveConnected: Boolean(user.googleDriveConnected && user.googleRefreshToken)
  };
}

function signToken(user) {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });
}

function buildOAuthClientWithRedirect(redirectUri) {
  return new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    redirectUri || process.env.REDIRECT_URI,
  );
}

function encodeState(payload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodeState(state) {
  if (!state) {
    return {};
  }

  try {
    return JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
  } catch {
    return {};
  }
}

function normalizeRedirectUrl(value) {
  if (!value || typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  const nativeRedirect = process.env.APP_REDIRECT_SCHEME || "expensemanager://oauth";

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("capacitor://") ||
    trimmed.startsWith(nativeRedirect)
  ) {
    return trimmed;
  }

  return "";
}

function normalizeHttpUrl(value) {
  if (!value || typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed.replace(/\/+$/, "");
  }

  return "";
}

function requestOrigin(req) {
  if (!req) {
    return "";
  }

  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : String(forwardedProto || req.protocol || "http").split(",")[0].trim();
  const host = req.get("host");

  if (!host) {
    return "";
  }

  return `${protocol || "http"}://${host}`;
}

function resolveOAuthCallbackUrl(req, state = {}) {
  const explicitCallback = normalizeHttpUrl(state.callbackUrl);

  if (explicitCallback) {
    return explicitCallback;
  }

  const publicServerUrl = normalizeHttpUrl(process.env.PUBLIC_SERVER_URL);

  if (publicServerUrl) {
    return `${publicServerUrl}/api/auth/google/callback`;
  }

  const origin = requestOrigin(req);

  if (origin) {
    return `${origin}/api/auth/google/callback`;
  }

  return normalizeHttpUrl(process.env.REDIRECT_URI) || process.env.REDIRECT_URI || "";
}

function withQueryParams(url, params) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${params.toString()}`;
}

async function findOrCreateGoogleUser(profile) {
  const email = String(profile.email || "").trim().toLowerCase();
  const username = String(
    profile.given_name || profile.name || email.split("@")[0] || "Google User"
  ).trim();

  if (!email) {
    throw new Error("Google account email is missing");
  }

  const update = {
    username,
    email,
  };

  let user = await User.findOne({ email });

  if (!user) {
    const generatedPassword = crypto.randomBytes(24).toString("hex");
    const hashedPassword = await bcrypt.hash(generatedPassword, 10);

    user = await User.create({
      ...update,
      password: hashedPassword,
      googleDriveConnected: false,
    });

    return user;
  }

  user.set(update);

  if (!user.googleDriveConnected) {
    user.googleAccessToken = "";
    user.googleRefreshToken = "";
  }

  await user.save();
  return user;
}

exports.signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });

    if (existingUser) {
      return res.status(409).json({ message: "Email is already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
    });

    res.status(201).json({
      message: "Account created",
      token: signToken(user),
      user: publicUser(user),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Wrong password" });
    }

    res.json({
      token: signToken(user),
      user: publicUser(user),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      user: publicUser(user),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.googleAuth = (req, res) => {
  const token = req.query.token;
  const redirect = normalizeRedirectUrl(req.query.redirect);
  const callbackUrl = resolveOAuthCallbackUrl(req);
  const oauth2Client = buildOAuthClientWithRedirect(callbackUrl);
  const baseScopes = [
    "openid",
    "email",
    "profile",
  ];

  let state = {
    mode: "signin",
    redirect,
    callbackUrl,
  };

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      state = {
        mode: "connect",
        redirect,
        userId: decoded.id,
      };
    } catch {
      return res.status(401).send("Invalid app session");
    }
  }

  const scopes = state.mode === "connect"
    ? [...baseScopes, "https://www.googleapis.com/auth/drive.file"]
    : baseScopes;

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    state: encodeState(state),
    scope: scopes,
  });

  res.redirect(url);
};

exports.googleCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    const decodedState = decodeState(state);
    const oauth2Client = buildOAuthClientWithRedirect(
      resolveOAuthCallbackUrl(req, decodedState)
    );

    if (!code) {
      return res.status(400).send("Missing Google authorization details");
    }

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const googleProfile = await google.oauth2({
      auth: oauth2Client,
      version: "v2",
    }).userinfo.get();

    let user;

    if (decodedState.mode === "connect" && decodedState.userId) {
      user = await User.findById(decodedState.userId);

      if (!user) {
        return res.status(404).send("User not found");
      }

      if (tokens.access_token) {
        user.googleAccessToken = tokens.access_token;
      }

      if (tokens.refresh_token) {
        user.googleRefreshToken = tokens.refresh_token;
      }

      user.googleDriveConnected = Boolean(user.googleRefreshToken);

      await user.save();
    } else {
      user = await findOrCreateGoogleUser(googleProfile.data);
    }

    if (!user) {
      return res.status(404).send("User not found");
    }

    const redirect = normalizeRedirectUrl(decodedState.redirect);

    if (redirect) {
      const query = new URLSearchParams({
        source: "google",
        mode: decodedState.mode === "connect" ? "connect" : "signin",
        token: signToken(user),
        user: JSON.stringify(publicUser(user)),
      });

      return res.redirect(withQueryParams(redirect, query));
    }

    res.send("Google account connected. You can return to Expense Manager.");
  } catch (err) {
    console.error("Google OAuth callback failed:", err);
    res.status(500).send("Error connecting Google account");
  }
};
