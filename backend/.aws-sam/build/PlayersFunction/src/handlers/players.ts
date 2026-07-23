import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import {
  ddb,
  TABLE_NAME,
  Keys,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  jsonResponse,
} from '../db';
import { Player } from '../types';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const method = event.httpMethod;
  const playerId = event.pathParameters?.playerId;

  try {
    if (method === 'GET' && !playerId) return await listPlayers();
    if (method === 'GET' && playerId) return await getPlayer(playerId);
    if (method === 'POST') return await createPlayer(event);
    if (method === 'PUT' && playerId) return await updatePlayer(playerId, event);
    if (method === 'DELETE' && playerId) return await deactivatePlayer(playerId);

    return jsonResponse(404, { message: 'Not found' });
  } catch (err) {
    console.error(err);
    return jsonResponse(500, { message: 'Internal server error' });
  }
};

async function listPlayers(): Promise<APIGatewayProxyResult> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': 'PLAYERS' },
    })
  );
  return jsonResponse(200, result.Items ?? []);
}

async function getPlayer(playerId: string): Promise<APIGatewayProxyResult> {
  const result = await ddb.send(
    new GetCommand({ TableName: TABLE_NAME, Key: Keys.player(playerId) })
  );
  if (!result.Item) return jsonResponse(404, { message: 'Player not found' });
  return jsonResponse(200, result.Item);
}

async function createPlayer(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body ?? '{}');
  if (!body.firstName || !body.lastName) return jsonResponse(400, { message: 'firstName and lastName are required' });

  const playerId = randomUUID();
  const player: Player = {
    playerId,
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email,
    joinedDate: body.joinedDate ?? new Date().toISOString().slice(0, 10),
    active: true,
  };

  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...Keys.player(playerId),
        ...Keys.playersListGsi(),
        GSI1SK: `PLAYER#${playerId}`,
        ...player,
      },
    })
  );

  return jsonResponse(201, player);
}

async function updatePlayer(
  playerId: string,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body ?? '{}');
  const existing = await ddb.send(
    new GetCommand({ TableName: TABLE_NAME, Key: Keys.player(playerId) })
  );
  if (!existing.Item) return jsonResponse(404, { message: 'Player not found' });

  const updated = {
    ...existing.Item,
    firstName: body.firstName ?? existing.Item.firstName,
    lastName: body.lastName ?? existing.Item.lastName,
    email: body.email ?? existing.Item.email,
    active: body.active ?? existing.Item.active,
  };

  await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: updated }));
  return jsonResponse(200, updated);
}

// Soft delete: mark inactive rather than removing, so historical results still resolve names
async function deactivatePlayer(playerId: string): Promise<APIGatewayProxyResult> {
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: Keys.player(playerId),
      UpdateExpression: 'SET active = :false',
      ExpressionAttributeValues: { ':false': false },
    })
  );
  return jsonResponse(200, { message: 'Player deactivated' });
}
