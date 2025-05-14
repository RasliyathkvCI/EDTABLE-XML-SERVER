// api/update-xml.js

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import xml2js from "xml2js";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const apiKey = req.headers["x-api-key"];
  if (apiKey !== process.env.XML_UPDATE_SECRET) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const { type, adsTime, videoUrl } = req.body;

  if (!type || !adsTime || !videoUrl) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  const vmapPath = path.join(process.cwd(), "public", "vmap.xml");
  const typeFilePath = path.join(process.cwd(), "public", `${type}.xml`);

  try {
    const typeXmlData = fs.readFileSync(typeFilePath, "utf8");

    const typeResult = await xml2js.parseStringPromise(typeXmlData);
    const mediaFileNode =
      typeResult?.VAST?.Ad?.[0]?.InLine?.[0]?.Creatives?.[0]?.Creative?.[0]?.Linear?.[0]?.MediaFiles?.[0]?.MediaFile?.[0];

    if (!mediaFileNode || (typeof mediaFileNode !== "string" && !mediaFileNode._)) {
      return res.status(400).json({ error: `MediaFile not found or XML structure changed.` });
    }

    typeResult.VAST.Ad[0].InLine[0].Creatives[0].Creative[0].Linear[0].MediaFiles[0].MediaFile[0]._ = videoUrl;

    const builder = new xml2js.Builder();
    const updatedTypeXml = builder.buildObject(typeResult);
    fs.writeFileSync(typeFilePath, updatedTypeXml);

    // --- Update vmap.xml ---
    const vmapData = fs.readFileSync(vmapPath, "utf8");
    const vmapResult = await xml2js.parseStringPromise(vmapData);
    const adBreaks = vmapResult["vmap:VMAP"]["vmap:AdBreak"];

    const adBreakToUpdate = adBreaks.find((ab) => ab["$"]["breakId"] === type);
    if (!adBreakToUpdate) {
      return res.status(400).json({ error: `AdBreak ${type} not found in vmap.xml.` });
    }

    adBreakToUpdate["$"]["timeOffset"] = adsTime;

    const updatedVmapXml = builder.buildObject(vmapResult);
    fs.writeFileSync(vmapPath, updatedVmapXml);

    return res.status(200).json({
      message: `${type} updated successfully in both files.`,
    });
  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error", details: err.message });
  }
}
