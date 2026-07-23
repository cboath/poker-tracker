import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ddb, TABLE_NAME, Keys, GetCommand, PutCommand, DeleteCommand, jsonResponse } from '../db';
import { Result, calculatePoints } from '../types';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const method = event.httpMethod;
  const gameId = event.pathParameters?.gameId;
  const playerId = event.pathParameters?.playerId;

  if (!gameId) return jsonResponse(400, { message: 'gameId is required' });

  try {
    if (method === 'PUT' && playerId) return await upsertResult(gameId, playerId, event);
    if (method === 'DELETE' && playerId) return await deleteResult(gameId, playerId);

    return jsonResponse(404, { message: 'Not found' });
  } catch (err) {
    console.error(err);
    return jsonResponse(500, { message: 'Internal server error' });
  }
};

async function upsertResult(
  gameId: string,
  playerId: string,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body ?? '{}');
  if (!body.position || !body.playerName) {
    return jsonResponse(400, { message: 'position and playerName are required' });
  }

  const gameRes = await ddb.send(
    new GetCommand({ TableName: TABLE_NAME, Key: Keys.game(gameId) })
  );
  if (!gameRes.Item) return jsonResponse(404, { message: 'Game not found' });

  const entrantsCount = gameRes.Item.entrantsCount as number;
  const year = gameRes.Item.year as number;
  const points = calculatePoints(entrantsCount, body.position);

  const result: Result = {
    gameId,
    playerId,
    playerName: body.playerName,
    position: body.position,
    buyIn: body.buyIn ?? 0,
    rebuys: body.rebuys ?? 0,
    addOns: body.addOns ?? 0,
    winnings: body.winnings ?? 0,
    points,
    notes: body.notes,
  };

  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...Keys.result(gameId, playerId),
        GSI1PK: `PLAYER#${playerId}`,
        GSI1SK: `YEAR#${year}#GAME#${gameId}`,
        ...result,
      },
    })
  );

  return jsonResponse(200, result);
}

async function deleteResult(
  gameId: string,
  playerId: string
): Promise<APIGatewayProxyResult> {
  await ddb.send(
    new DeleteCommand({ TableName: TABLE_NAME, Key: Keys.result(gameId, playerId) })
  );
  return jsonResponse(200, { message: 'Result removed' });
}
