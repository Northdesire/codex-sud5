import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// ─── In-memory iCal cache (15 min TTL) ─────────────────
const icalCache = new Map<string, { data: string; fetchedAt: number }>();
const CACHE_TTL = 15 * 60 * 1000;

async function fetchIcal(url: string): Promise<string> {
  const cached = icalCache.get(url);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.data;
  }

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`iCal fetch failed: ${res.status}`);
  const data = await res.text();

  icalCache.set(url, { data, fetchedAt: Date.now() });
  return data;
}

// ─── Simple iCal VEVENT parser ──────────────────────────
interface IcalEvent {
  start: Date;
  end: Date;
  summary?: string;
}

function parseIcalEvents(ical: string): IcalEvent[] {
  const events: IcalEvent[] = [];
  const blocks = ical.split("BEGIN:VEVENT");

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split("END:VEVENT")[0];

    const dtStart = block.match(/DTSTART[^:]*:(\d{8}(?:T\d{6}Z?)?)/);
    const dtEnd = block.match(/DTEND[^:]*:(\d{8}(?:T\d{6}Z?)?)/);
    const summary = block.match(/SUMMARY:(.*)/);

    if (dtStart) {
      const start = parseIcalDate(dtStart[1]);
      const end = dtEnd ? parseIcalDate(dtEnd[1]) : start;
      events.push({
        start,
        end,
        summary: summary?.[1]?.trim(),
      });
    }
  }

  return events;
}

function parseIcalDate(str: string): Date {
  // Format: 20260715 or 20260715T120000Z
  const y = parseInt(str.substring(0, 4));
  const m = parseInt(str.substring(4, 6)) - 1;
  const d = parseInt(str.substring(6, 8));

  if (str.length > 8) {
    const h = parseInt(str.substring(9, 11));
    const min = parseInt(str.substring(11, 13));
    const s = parseInt(str.substring(13, 15));
    return new Date(Date.UTC(y, m, d, h, min, s));
  }

  return new Date(y, m, d);
}

function hasOverlap(events: IcalEvent[], von: Date, bis: Date): { overlaps: boolean; konflikt?: string } {
  for (const ev of events) {
    // Overlap: von < eventEnd && bis > eventStart
    if (von < ev.end && bis > ev.start) {
      return {
        overlaps: true,
        konflikt: ev.summary || `${ev.start.toLocaleDateString("de-DE")} – ${ev.end.toLocaleDateString("de-DE")}`,
      };
    }
  }
  return { overlaps: false };
}

// ─── GET handler ────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const vonStr = searchParams.get("von");
    const bisStr = searchParams.get("bis");

    if (!vonStr || !bisStr) {
      return NextResponse.json({ error: "von und bis Parameter erforderlich" }, { status: 400 });
    }

    const von = new Date(vonStr);
    const bis = new Date(bisStr);

    // Load all Unterkünfte with icalUrl
    const unterkuenfte = await prisma.unterkunft.findMany({
      where: {
        firmaId: user.firmaId,
        icalUrl: { not: null },
      },
      select: { id: true, icalUrl: true, name: true },
    });

    const result: Record<string, { verfuegbar: boolean; konflikt?: string }> = {};

    await Promise.allSettled(
      unterkuenfte.map(async (u) => {
        if (!u.icalUrl) return;
        try {
          const ical = await fetchIcal(u.icalUrl);
          const events = parseIcalEvents(ical);
          const { overlaps, konflikt } = hasOverlap(events, von, bis);
          result[u.id] = { verfuegbar: !overlaps, konflikt };
        } catch {
          // If fetch fails, assume available (don't block booking)
          result[u.id] = { verfuegbar: true };
        }
      })
    );

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}
