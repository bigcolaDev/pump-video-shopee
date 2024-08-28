import express from "express";
import cors from "cors";
import morgan from "morgan";
import puppeteer from "puppeteer";
import path from "path";
import { fileURLToPath } from "url"; // Import the fileURLToPath function
import PQueue from "p-queue"; // Add p-queue library
import dotenv from "dotenv";
dotenv.config();
// Create __dirname equivalent for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.use(express.json());
app.use(cors());
app.use(morgan("dev"));
// Serve the HTML file
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../index.html"));
});
// Create a queue with a concurrency limit
const queue = new PQueue({ concurrency: 5 }); // Set concurrency limit to 5
// Route to perform the view actions
app.post("/view", async (req, res, next) => {
    const { url, rounds, delay } = req.body;
    if (!url || !rounds || !delay) {
        return res.status(400).send({
            status: "error",
            message: "Invalid request body. Make sure `url`, `rounds`, and `delay` are provided!",
        });
    }
    if (!url.includes("sv.shopee.co.th") && !url.includes("th.shp.ee")) {
        return res
            .status(400)
            .send({ status: "error", message: "URL ไม่ถูกต้อง!" });
    }
    if (typeof rounds !== "number" || typeof delay !== "number") {
        return res
            .status(400)
            .send({ status: "error", message: "รูปแบบข้อมูลไม่ถูกต้อง!" });
    }
    // Function to handle viewing action
    const sendRequest = async () => {
        let browser;
        try {
            browser = await puppeteer.launch({
                headless: true,
                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--single-process",
                    "--no-zygote",
                ],
                executablePath: process.env.NODE_ENV === "production"
                    ? process.env.PUPPETEER_EXECUTABLE_PATH
                    : "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
                timeout: 0, // Disable timeout to rely on individual page timeout
            });
            const page = await browser.newPage();
            // Set navigation timeout to 60 seconds
            page.setDefaultNavigationTimeout(60000);
            await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
            const playButtonSelector = "#__next > div > div.single-media_singleMediaWrapper__vcYBa > div:nth-child(2) > div.videoPlayer_videoContainer__E9mli > div > div.videoPlayer_videoPlayer__rl3_b.videoPlayer_videoPlayIcon__6H_mJ > span > img";
            await page.waitForSelector(playButtonSelector, { timeout: 60000 });
            await page.click(playButtonSelector);
            console.log("Play button clicked successfully!");
            // Wait for the specified delay after clicking the button
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
        catch (error) {
            console.error("Error interacting with the page:", error.message);
        }
        finally {
            if (browser) {
                try {
                    await browser.close();
                }
                catch (closeError) {
                    console.error("Error closing browser:", closeError.message);
                }
            }
        }
    };
    // Running sendRequest in parallel for each round using the queue
    const tasks = Array.from({ length: rounds }, (_, i) => {
        console.log(`Starting round ${i + 1} for URL: ${url}`);
        return queue.add(() => sendRequest());
    });
    try {
        await Promise.all(tasks);
        res.send({
            status: "success",
            message: `ยิงยอดวิวทั้งหมด ${rounds} รอบ โดยมีดีเลย์ ${delay} ms`,
        });
    }
    catch (error) {
        next(error);
    }
});
// Middleware for error handling
app.use((err, req, res, next) => {
    console.error(`Error Name: ${err.name}`);
    console.error(`Error Message: ${err.message}`);
    console.error(`Error Stack: ${err.stack}`);
    res.status(500).json({
        status: 500,
        message: err.message,
        stack: err.stack || "No stack trace available",
    });
});
// Start the server
app.listen(5000, () => {
    console.log(`Server running at http://localhost:${5000}`);
});
