function escapeDriveQueryValue(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
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

module.exports = { createFolder };
