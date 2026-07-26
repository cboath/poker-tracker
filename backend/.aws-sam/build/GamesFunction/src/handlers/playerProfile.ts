import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ddb, TABLE_NAME, Keys, GetCommand, QueryCommand, jsonResponse } from '../db';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const playerId = event.pathParameters?.playerId;
  if (!playerId) return jsonResponse(400, { message: 'playerId is required' });

  try {
    const [playerRes, resultsRes] = await Promise.all([
      ddb.send(new GetCommand({ TableName: TABLE_NAME, Key: Keys.player(playerId) })),
      ddb.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :pk',
          ExpressionAttributeValues: { ':pk': `PLAYER#${playerId}` },
          ScanIndexForward: true, // oldest to newest
        })
      ),
    ]);

    if (!playerRes.Item) return jsonResponse(404, { message: 'Player not found' });

    const results = resultsRes.Items ?? [];
    const gamesPlayed = results.length;
    const totalPoints = results.reduce((s, r) => s + (r.points ?? 0), 0);
    const totalWinnings = results.reduce((s, r) => s + (r.winnings ?? 0), 0);
    const totalBuyIns = results.reduce(
      (s, r) => s + (r.buyIn ?? 0) + (r.rebuys ?? 0) + (r.addOns ?? 0),
      0
    );
    const firstPlaceFinishes = results.filter((r) => r.position === 1).length;
    const scoredPositions = results
      .map((r) => r.position)
      .filter((p): p is number => typeof p === 'number');
    const bestFinish = scoredPositions.length ? Math.min(...scoredPositions) : null;

    return jsonResponse(200, {
      player: playerRes.Item,
      careerStats: {
        gamesPlayed,
        totalPoints,
        totalWinnings: Math.round(totalWinnings * 100) / 100,
        totalBuyIns: Math.round(totalBuyIns * 100) / 100,
        netProfit: Math.round((totalWinnings - totalBuyIns) * 100) / 100,
        firstPlaceFinishes,
        bestFinish,
      },
      history: results, // chronological, one row per game played
    });
  } catch (err) {
    console.error(err);
    return jsonResponse(500, { message: 'Internal server error' });
  }
};
