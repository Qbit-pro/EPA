const { google } = require("googleapis");
const stream = require("stream");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs/promises");
const Expense = require("../models/Expense");
const Purchase = require("../models/Purchase");
const User = require("../models/User");
const { createFolder } = require("../services/googleDriveService");

const validPaidBy = new Set(["company", "self"]);

function sanitizeSegment(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "") || "receipt";
}

function receiptFolders(type, recordDate, paidBy) {
  const year = recordDate.getFullYear().toString();
  const month = recordDate.toLocaleString("en-US", { month: "long" });
  const folders = [type.toLowerCase(), year, sanitizeSegment(month)];

  if (type === "Purchase") {
    folders.push(sanitizeSegment(paidBy));
  }

  return folders;
}

function fileExtension(file) {
  const originalExtension = path.extname(file.originalname || "").toLowerCase();

  if (originalExtension) {
    return originalExtension;
  }

  const subtype = String(file.mimetype || "").split("/")[1];
  return subtype ? `.${sanitizeSegment(subtype)}` : ".jpg";
}

function fileFromBase64Body(body) {
  const base64 = String(body?.imageBase64 || "").trim();

  if (!base64) {
    return null;
  }

  const cleaned = base64.includes(",") ? base64.split(",").pop() : base64;

  if (!cleaned) {
    return null;
  }

  return {
    buffer: Buffer.from(cleaned, "base64"),
    originalname: String(body?.imageName || "receipt.jpg"),
    mimetype: String(body?.imageMimeType || "image/jpeg")
  };
}

function hasDriveAccess(user) {
  return Boolean(user?.googleDriveConnected && user?.googleRefreshToken);
}

function buildUploadUrl(req, relativePath) {
  const protocol = req.protocol || "http";
  const host = req.get("host");
  const webPath = relativePath.split(path.sep).join("/");
  return `${protocol}://${host}/${webPath}`;
}

async function uploadReceiptToLocal(req, file, type, recordDate, paidBy, title) {
  const folders = receiptFolders(type, recordDate, paidBy);
  const uploadRoot = path.join(__dirname, "..", "uploads", "receipts", ...folders);

  await fs.mkdir(uploadRoot, { recursive: true });

  const extension = fileExtension(file);
  const safeTitle = sanitizeSegment(title);
  const filename = `${Date.now()}-${safeTitle}-${crypto.randomUUID()}${extension}`;
  const absolutePath = path.join(uploadRoot, filename);
  const relativePath = path.join("uploads", "receipts", ...folders, filename);

  await fs.writeFile(absolutePath, file.buffer);

  return {
    fileId: filename,
    imageUrl: buildUploadUrl(req, relativePath),
    storage: "local"
  };
}

async function uploadReceiptToDrive(file, type, paidBy, title, recordDate, user) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URI
  );
  oauth2Client.setCredentials({
    access_token: user.googleAccessToken || undefined,
    refresh_token: user.googleRefreshToken
  });

  const drive = google.drive({
    version: "v3",
    auth: oauth2Client
  });

  const year = recordDate.getFullYear().toString();
  const month = recordDate.toLocaleString("en-US", { month: "long" });
  const appFolder = await createFolder(drive, "ExpenseApp", null);
  const typeFolder = await createFolder(drive, type, appFolder);
  const yearFolder = await createFolder(drive, year, typeFolder);
  const monthFolder = await createFolder(drive, month, yearFolder);

  let finalFolder = monthFolder;

  if (type === "Purchase") {
    finalFolder = await createFolder(drive, paidBy, monthFolder);
  }

  const bufferStream = new stream.PassThrough();
  bufferStream.end(file.buffer);

  const uploadedFile = await drive.files.create({
    resource: {
      name: title.trim(),
      parents: [finalFolder]
    },
    media: {
      mimeType: file.mimetype,
      body: bufferStream
    },
    fields: "id, webViewLink"
  });

  return {
    fileId: uploadedFile.data.id,
    imageUrl: uploadedFile.data.webViewLink || uploadedFile.data.id || "",
    storage: "drive"
  };
}

exports.createPurchase = async (req, res) => {
    try{
        const { title, description = "", date, imageUrl = "", paidBy } = req.body;

        if (!title || !date || !validPaidBy.has(paidBy)) {
            return res.status(400).json({
                message : "Title, date, and paid-by are required"
            });
        }

        const purchase = await Purchase.create({
            userId: req.user.id,
            title: title.trim(),
            description: description.trim(),
            date,
            imageUrl,
            paidBy
        });

        res.status(201).json({
            message : "Purchase saved",
            purchase
        });
    }
    catch(error){
        res.status(500).json({
            error : error.message
        });
    }
};

exports.getPurchases = async (req,res) => {
    try {
        const data = await Purchase.find({ userId: req.user.id }).sort({ date: -1, createdAt: -1 });
        res.json(data);
    } catch(error) {
        res.status(500).json({
            error : error.message
        });
    }
};

exports.deletePurchase = async (req, res) => {
    try {
        const purchase = await Purchase.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!purchase) {
            return res.status(404).json({
                message: "Purchase not found"
            });
        }

        res.json({
            message: "Purchase deleted"
        });
    } catch(error) {
        res.status(500).json({
            error: error.message
        });
    }
};

exports.uploadToDrive = async (req, res) => {
  try {
    const { type, paidBy, title, description = "", date } = req.body;

    if (!["Expense", "Purchase"].includes(type)) {
      return res.status(400).json({ message: "Record type must be Expense or Purchase" });
    }

    if (!title || !date) {
      return res.status(400).json({ message: "Title and date are required" });
    }

    if (type === "Purchase" && !validPaidBy.has(paidBy)) {
      return res.status(400).json({ message: "Paid-by is required for purchases" });
    }

    const uploadFile = req.file || fileFromBase64Body(req.body);

    if (!uploadFile) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const recordDate = new Date(date);

    if (Number.isNaN(recordDate.getTime())) {
      return res.status(400).json({ message: "Invalid date" });
    }
    let uploaded;
    const driveConnected = hasDriveAccess(user);

    if (driveConnected) {
      try {
        uploaded = await uploadReceiptToDrive(uploadFile, type, paidBy, title, recordDate, user);
      } catch (driveError) {
        console.error("Google Drive upload failed:", driveError?.response?.data || driveError?.message || driveError);
        uploaded = await uploadReceiptToLocal(req, uploadFile, type, recordDate, paidBy, title);
      }
    } else {
      uploaded = await uploadReceiptToLocal(req, uploadFile, type, recordDate, paidBy, title);
    }

    const imageUrl = uploaded.imageUrl;
    const recordData = {
      userId: req.user.id,
      title: title.trim(),
      description: description.trim(),
      date: recordDate,
      imageUrl
    };

    const record = type === "Purchase"
      ? await Purchase.create({ ...recordData, paidBy })
      : await Expense.create(recordData);

    const uploadMessage = uploaded.storage === "drive"
      ? "Uploaded to Google Drive"
      : driveConnected
        ? "Google Drive upload failed, saved locally instead"
        : "Drive not connected, saved locally instead";

    res.status(201).json({
      message: uploadMessage,
      fileId: uploaded.fileId,
      imageUrl,
      record,
      storage: uploaded.storage
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
