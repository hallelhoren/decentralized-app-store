import { NextResponse } from "next/server";
import crypto from "crypto";
import fs from "fs";
import path from "path";

let mockReviewsCache: any[] = [];
const AGGREGATION_THRESHOLD = 5; 


export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const appId = searchParams.get("appId");

    // Check if the parameter exists
    if (!appId) {
      return new Response(JSON.stringify({ error: "Missing appId parameter" }), { status: 400 });
    }

    // Filter the internal array to match the requested appId
    const appReviews = mockReviewsCache.filter((review: any) => review.appId === appId);

    // Return the matched reviews safely
    return new Response(JSON.stringify({ success: true, reviews: appReviews }), { status: 200 });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}


async function performAggregation() {
  console.log(`\n--- Threshold of ${AGGREGATION_THRESHOLD} reached! Starting automatic aggregation ---`);

  const fileContent = JSON.stringify(mockReviewsCache, null, 2);

  const filePath = path.join(process.cwd(), "latest_reviews.json");
  fs.writeFileSync(filePath, fileContent);
  console.log(`[+] File created successfully at: ${filePath}`);

  const hash = crypto.createHash("sha256").update(fileContent).digest("hex");
  const bytes32Hash = "0x" + hash; 

  console.log(`[+] New SHA256 Hash generated: ${bytes32Hash}`);

  const aggregatedCount = mockReviewsCache.length;
  mockReviewsCache = []; 

  console.log(`--- Aggregation complete. Cache cleared. ---\n`);
  
  return bytes32Hash;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { appId, rating, reviewText, reviewer } = body;

    // הוספת הביקורת למערך
    mockReviewsCache.push({
      appId,
      rating,
      reviewText,
      reviewer,
      timestamp: Date.now(),
    });

    console.log(`Review added! Current cache size: ${mockReviewsCache.length}/${AGGREGATION_THRESHOLD}`);

    let generatedHash = null;

    if (mockReviewsCache.length >= AGGREGATION_THRESHOLD) {

      generatedHash = await performAggregation();
      
      /*** כאן בעתיד תוכלו להוסיף את הקוד ששולח אוטומטית ***
       // במקום שקופץ חלון מטאמאסק, השרת יוצר לעצמו ארנק סודי:
        const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
        const serverWallet = new ethers.Wallet(process.env.SERVER_PRIVATE_KEY, provider);

        // השרת מתחבר לחוזה באמצעות הארנק שלו
        const contract = new ethers.Contract(contractAddress, contractABI, serverWallet);

        // השרת שולח את העסקה באופן אוטומטי!
        console.log("Server is signing the transaction to update reviews...");
        const tx = await contract.updateReviews(appId, generatedHash);
        await tx.wait(); 
        console.log("Blockchain successfully updated by the cache server!");
      // *** את ה- generatedHash לחוזה החכם בבלוקצ'יין! ***/
    }

    return NextResponse.json({ 
      success: true, 
      totalReviewsInCache: mockReviewsCache.length,
      wasAggregated: generatedHash !== null,
      latestHash: generatedHash
    });

  } catch (error) {
    console.error("Error in POST /api/reviews:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}