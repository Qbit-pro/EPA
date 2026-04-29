const http = require("http");
const { google } = require("googleapis");
require("dotenv").config();

const PORT = Number(process.env.GLOBAL_GOOGLE_TOKEN_PORT || 5555);
const REDIRECT_URI = `http://127.0.0.1:${PORT}/oauth2callback`;
const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

function requireEnv(name) {
  const value = String(process.env[name] || "").trim();

  if (!value) {
    console.error(`${name} is missing in backend/.env`);
    process.exit(1);
  }

  return value;
}

const oauth2Client = new google.auth.OAuth2(
  requireEnv("CLIENT_ID"),
  requireEnv("CLIENT_SECRET"),
  REDIRECT_URI
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent select_account",
  scope: SCOPES,
});

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, REDIRECT_URI);

    if (url.pathname !== "/oauth2callback") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const code = url.searchParams.get("code");

    if (!code) {
      throw new Error("Google did not return an authorization code.");
    }

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      throw new Error("Google did not return a refresh token. Re-run this command and approve the consent screen again.");
    }

    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Global Google Drive token created. You can close this tab and return to PowerShell.");

    console.log("\nAdd these lines to backend/.env:\n");
    console.log(`GLOBAL_GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log(`GLOBAL_GOOGLE_REDIRECT_URI=${REDIRECT_URI}`);
    console.log("\nThen restart the backend with npm start.\n");
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end(err.message);
    console.error(err);
  } finally {
    server.close();
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("\nOpen this URL and sign in as universeexplorer4@gmail.com:\n");
  console.log(authUrl);
  console.log("\nWaiting for Google callback...");
});
