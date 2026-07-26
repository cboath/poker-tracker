import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ddb, TABLE_NAME, QueryCommand, jsonResponse } from '../db';
import { StandingRow } from '../types';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const year = event.pathParameters?.year;
  if (!year) return jsonResponse(400, { message: 'year is required' });

  try {
    return await computeStandings(Number(year));
  } catch (err) {
    console.error(err);
    return jsonResponse(500, { message: 'Internal server error' });
  }
};

async function computeStandings(year: number): Promise<APIGatewayProxyResult> {
  // 1. Get all games in the year
  const gamesRes = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': `YEAR#${year}` },
    })
  );
  const games = gamesRes.Items ?? [];

  // 2. Get all results for each game
  const resultsPerGame = await Promise.all(
    games.map((g) =>
      ddb.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: { ':pk': `GAME#${g.gameId}`, ':sk': 'RESULT#' },
        })
      )
    )
  );

  // 3. Aggregate per player
  //
  // Policy for Results with no `position` yet (roster entrants added at game
  // creation whose game hasn't been scored, or a no-show never given a
  // finish -- see Result's docs in ../types.ts): they still count toward
  // `gamesPlayed`, `totalBuyIns`, and `totalWinnings` (money changed hands /
  // they showed up and bought in), but are excluded from every finish-based
  // aggregate -- `totalPoints`, `bestFinish`, `firstPlaceFinishes`, and the
  // numerator/denominator of `avgFinish` -- since there is no finish to rank
  // them by yet. This is the "partial roster still shows up as attendance"
  // reading; once a position is recorded via upsertResult, that same row
  // flows into the finish-based numbers on the next standings computation.
  // A player who has only ever had position-less results gets avgFinish: 0
  // (no divide-by-zero) and is left out of bestFinish/firstPlaceFinishes.
  const byPlayer = new Map<
    string,
    StandingRow & { finishSum: number; scoredGamesCount: number; headToHead: Record<string, number> }
  >();

  resultsPerGame.forEach((res) => {
    (res.Items ?? []).forEach((r) => {
      const existing = byPlayer.get(r.playerId) ?? {
        playerId: r.playerId,
        playerName: r.playerName,
        gamesPlayed: 0,
        totalPoints: 0,
        totalWinnings: 0,
        totalBuyIns: 0,
        firstPlaceFinishes: 0,
        bestFinish: Infinity,
        avgFinish: 0,
        finishSum: 0,
        scoredGamesCount: 0,
        headToHead: {},
      };

      const hasPosition = typeof r.position === 'number';

      existing.gamesPlayed += 1;
      existing.totalWinnings += r.winnings ?? 0;
      existing.totalBuyIns += (r.buyIn ?? 0) + (r.rebuys ?? 0) + (r.addOns ?? 0);

      if (hasPosition) {
        existing.totalPoints += r.points ?? 0;
        existing.finishSum += r.position;
        existing.scoredGamesCount += 1;
        existing.bestFinish = Math.min(existing.bestFinish, r.position);
        if (r.position === 1) existing.firstPlaceFinishes += 1;
      }

      byPlayer.set(r.playerId, existing);
    });
  });

  const standings: StandingRow[] = Array.from(byPlayer.values()).map((p) => ({
    playerId: p.playerId,
    playerName: p.playerName,
    gamesPlayed: p.gamesPlayed,
    totalPoints: p.totalPoints,
    totalWinnings: Math.round(p.totalWinnings * 100) / 100,
    totalBuyIns: Math.round(p.totalBuyIns * 100) / 100,
    firstPlaceFinishes: p.firstPlaceFinishes,
    bestFinish: p.bestFinish === Infinity ? 0 : p.bestFinish,
    avgFinish:
      p.scoredGamesCount === 0
        ? 0
        : Math.round((p.finishSum / p.scoredGamesCount) * 100) / 100,
  }));

  // Sort: total points desc, then most 1st-place finishes, then total winnings.
  // True tie-breaks that need head-to-head review are flagged for the admin
  // rather than resolved silently.
  standings.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.firstPlaceFinishes !== a.firstPlaceFinishes)
      return b.firstPlaceFinishes - a.firstPlaceFinishes;
    return b.totalWinnings - a.totalWinnings;
  });

  const ranked = standings.map((s, idx) => {
    const tiedWithPrevious =
      idx > 0 && standings[idx - 1].totalPoints === s.totalPoints;
    return { ...s, rank: idx + 1, tied: tiedWithPrevious };
  });

  return jsonResponse(200, { year, gameCount: games.length, standings: ranked });
}
