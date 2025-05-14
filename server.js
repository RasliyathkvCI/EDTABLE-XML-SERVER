import express from "express";
import updateXmlRouter from "./api/updateXml.js";

const app = express();

app.use(express.json());
app.use("/update-xml", updateXmlRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`XML-SERVER is running on port ${PORT}`);
});
