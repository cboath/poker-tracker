import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  ddb,
  TABLE_NAME,
  Keys,
  GetCommand,
  PutCommand,
  DeleteCommand,
  UpdateCommand,
  jsonResponse,
} from '../db';
import { Result, calculatePoints } from '../types';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const method = event.httpMethod;
  const resource = event.resource; // e.g. /games/{gameId}/results/{playerId}, .../rebuy
  const gameId = event.pathParameters?.gameId;
  const playerId = event.pathParameters?.playerId;

  if (!gameId) return jsonResponse(400, { message: 'gameId is required' });

  try {
    if (
      resource === '/games/{gameId}/results/{playerId}/rebuy' &&
      method === 'POST' &&
      playerId
    )
      return await addRebuy(gameId, playerId, event);
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

  const [gameRes, existingResultRes] = await Promise.all([
    ddb.send(new GetCommand({ TableName: TABLE_NAME, Key: Keys.game(gameId) })),
    ddb.send(new GetCommand({ TableName: TABLE_NAME, Key: Keys.result(gameId, playerId) })),
  ]);
  if (!gameRes.Item) return jsonResponse(404, { message: 'Game not found' });

  const entrantsCount = gameRes.Item.entrantsCount as number;
  const year = gameRes.Item.year as number;
  const points = calculatePoints(entrantsCount, body.position);
  const existing = existingResultRes.Item as Result | undefined;

  const result: Result = {
    gameId,
    playerId,
    playerName: body.playerName,
    position: body.position,
    buyIn: body.buyIn ?? 0,
    rebuys: body.rebuys ?? 0,
    rebuyCount: body.rebuyCount ?? existing?.rebuyCount ?? 0,
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

async function addRebuy(
  gameId: string,
  playerId: string,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body ?? '{}');

  const gameRes = await ddb.send(
    new GetCommand({ TableName: TABLE_NAME, Key: Keys.game(gameId) })
  );
  if (!gameRes.Item) return jsonResponse(404, { message: 'Game not found' });

  if (body.amount === undefined && !gameRes.Item.buyInAmount) {
    return jsonResponse(400, {
      message:
        'This game has no buy-in amount set; pass an explicit amount to record a rebuy.',
    });
  }

  const amount = body.amount ?? gameRes.Item.buyInAmount;

  try {
    const updated = await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: Keys.result(gameId, playerId),
        UpdateExpression: 'ADD rebuys :amt, rebuyCount :one',
        ExpressionAttributeValues: { ':amt': amount, ':one': 1 },
        ConditionExpression: 'attribute_exists(PK)',
        ReturnValues: 'ALL_NEW',
      })
    );

    return jsonResponse(200, updated.Attributes);
  } catch (err: any) {
    if (err?.name === 'ConditionalCheckFailedException') {
      return jsonResponse(404, {
        message:
          'Player has no result recorded for this game yet — add a result first before logging a rebuy.',
      });
    }
    throw err;
  }
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
