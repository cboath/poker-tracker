import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import {
  ddb,
  TABLE_NAME,
  Keys,
  GetCommand,
  PutCommand,
  QueryCommand,
  DeleteCommand,
  jsonResponse,
} from '../db';
import { Game } from '../types';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const method = event.httpMethod;
  const resource = event.resource; // e.g. /years, /years/{year}/games, /games/{gameId}
  const year = event.pathParameters?.year;
  const gameId = event.pathParameters?.gameId;

  try {
    if (resource === '/years' && method === 'GET') return await listYears();
    if (resource === '/years/{year}/games' && method === 'GET' && year)
      return await listGamesForYear(Number(year));
    if (resource === '/years/{year}/games' && method === 'POST' && year)
      return await createGame(Number(year), event);
    if (resource === '/games/{gameId}' && method === 'GET' && gameId)
      return await getGameWithResults(gameId);
    if (resource === '/games/{gameId}' && method === 'PUT' && gameId)
      return await updateGame(gameId, event);
    if (resource === '/games/{gameId}' && method === 'DELETE' && gameId)
      return await deleteGame(gameId);

    return jsonResponse(404, { message: 'Not found' });
  } catch (err) {
    console.error(err);
    return jsonResponse(500, { message: 'Internal server error' });
  }
};

async function listYears(): Promise<APIGatewayProxyResult> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': 'YEARS' },
      ScanIndexForward: false, // most recent year first
    })
  );
  return jsonResponse(
    200,
    (result.Items ?? []).map((i) => i.year)
  );
}

async function listGamesForYear(year: number): Promise<APIGatewayProxyResult> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': `YEAR#${year}` },
    })
  );
  return jsonResponse(200, result.Items ?? []);
}

async function createGame(
  year: number,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body ?? '{}');
  if (!body.date || !body.month || !body.entrantsCount) {
    return jsonResponse(400, {
      message: 'date, month, and entrantsCount are required',
    });
  }

  const gameId = randomUUID();
  const createdBy =
    (event.requestContext as any)?.authorizer?.claims?.email ?? 'unknown';

  const game: Game = {
    gameId,
    year,
    month: body.month,
    date: body.date,
    location: body.location,
    entrantsCount: body.entrantsCount,
    totalPot: body.totalPot,
    notes: body.notes,
    createdBy,
    createdAt: new Date().toISOString(),
  };

  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...Keys.game(gameId),
        GSI1PK: `YEAR#${year}`,
        GSI1SK: `GAME#${body.date}#${gameId}`,
        ...game,
      },
    })
  );

  // Ensure a year marker exists so the year shows up in /years
  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...Keys.yearMarker(year), year },
    })
  );

  return jsonResponse(201, game);
}

async function getGameWithResults(gameId: string): Promise<APIGatewayProxyResult> {
  const [gameRes, resultsRes] = await Promise.all([
    ddb.send(new GetCommand({ TableName: TABLE_NAME, Key: Keys.game(gameId) })),
    ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `GAME#${gameId}`,
          ':sk': 'RESULT#',
        },
      })
    ),
  ]);

  if (!gameRes.Item) return jsonResponse(404, { message: 'Game not found' });

  return jsonResponse(200, {
    ...gameRes.Item,
    results: resultsRes.Items ?? [],
  });
}

async function updateGame(
  gameId: string,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body ?? '{}');
  const existing = await ddb.send(
    new GetCommand({ TableName: TABLE_NAME, Key: Keys.game(gameId) })
  );
  if (!existing.Item) return jsonResponse(404, { message: 'Game not found' });

  const updated = {
    ...existing.Item,
    location: body.location ?? existing.Item.location,
    totalPot: body.totalPot ?? existing.Item.totalPot,
    notes: body.notes ?? existing.Item.notes,
    // Changing entrantsCount does NOT retroactively recompute existing results'
    // points -- re-save each result via the results endpoint if you need that.
    entrantsCount: body.entrantsCount ?? existing.Item.entrantsCount,
  };

  await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: updated }));
  return jsonResponse(200, updated);
}

async function deleteGame(gameId: string): Promise<APIGatewayProxyResult> {
  const resultsRes = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': `GAME#${gameId}` },
    })
  );

  await Promise.all(
    (resultsRes.Items ?? []).map((item) =>
      ddb.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: { PK: item.PK, SK: item.SK },
        })
      )
    )
  );

  return jsonResponse(200, { message: 'Game and its results deleted' });
}
