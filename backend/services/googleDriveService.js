const { google } = require("googleapis");

function escapeDriveQueryValue(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function driveEnvValue(primaryKey, fallbackKey = "") {
  const primary = String(process.env[primaryKey] || "").trim();

  if (primary) {
    return primary;
  }

  return fallbackKey ? String(process.env[fallbackKey] || "").trim() : "";
}

function isGlobalDriveConfigured() {
  return Boolean(
    String(process.env.CLIENT_ID || "").trim()
    && String(process.env.CLIENT_SECRET || "").trim()
    && driveEnvValue("GLOBAL_GOOGLE_REFRESH_TOKEN", "GOOGLE_REFRESH_TOKEN")
    && driveEnvValue("GLOBAL_GOOGLE_REDIRECT_URI", "REDIRECT_URI")
  );
}

function buildGlobalDriveClient() {
  if (!isGlobalDriveConfigured()) {
    throw new Error("Shared Google Drive is not configured");
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    driveEnvValue("GLOBAL_GOOGLE_REDIRECT_URI", "REDIRECT_URI")
  );

  oauth2Client.setCredentials({
    access_token: driveEnvValue("GLOBAL_GOOGLE_ACCESS_TOKEN", "GOOGLE_ACCESS_TOKEN") || undefined,
    refresh_token: driveEnvValue("GLOBAL_GOOGLE_REFRESH_TOKEN", "GOOGLE_REFRESH_TOKEN"),
  });

  return google.drive({
    version: "v3",
    auth: oauth2Client,
  });
}

async function createFolder(drive, name, parentId) {
  const safeName = escapeDriveQueryValue(name);
  let query = `name='${safeName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const res = await drive.files.list({
    q: query,
    fields: "files(id, name)"
  });

  if (res.data.files.length > 0) {
    return res.data.files[0].id;
  }

  const fileMetadata = {
    name: String(name),
    mimeType: "application/vnd.google-apps.folder",
  };

  if (parentId) {
    fileMetadata.parents = [parentId];
  }

  const folder = await drive.files.create({
    resource: fileMetadata,
    fields: "id"
  });

  return folder.data.id;
}

module.exports = {
  buildGlobalDriveClient,
  createFolder,
  isGlobalDriveConfigured,
};
