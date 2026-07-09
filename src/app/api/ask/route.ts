import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { answerQuestionWithOpenAI } from "@/lib/ai/openaiIntent";
import { loadLogisticsOrders } from "@/lib/data/logistics";

const askSchema = z.object({
  question: z.string().trim().min(1).max(500)
});

export async function POST(request: NextRequest) {
  try {
    const parsed = askSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Question is required and must be 500 characters or fewer" }, { status: 400 });
    }
    const rows = await loadLogisticsOrders();
    return NextResponse.json(await answerQuestionWithOpenAI(rows, parsed.data.question));
  } catch {
    return NextResponse.json({ error: "Unable to answer the question" }, { status: 500 });
  }
}
