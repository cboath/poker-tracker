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
import { Game, Result } from '../types';

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

interface RosterPlayerInput {
  playerId: string;
  playerName: string;
  buyIn: number;
}

function isValidRosterPlayer(p: unknown): p is RosterPlayerInput {
  const cand = p as Partial<RosterPlayerInput> | null | undefined;
  return (
    !!cand &&
    typeof cand.playerId === 'string' &&
    cand.playerId.length > 0 &&
    typeof cand.playerName === 'string' &&
    cand.playerName.length > 0 &&
    typeof cand.buyIn === 'number' &&
    Number.isFinite(cand.buyIn) &&
    cand.buyIn >= 0
  );
}

async function createGame(
  year: number,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body ?? '{}');

  // Optional roster: when the caller builds the game with a player-by-player
  // buy-in list up front (new "add players while creating the game" flow),
  // entrantsCount/totalPot are derived from it instead of being typed in
  // manually, and a Result row is created per roster player with no
  // `position` yet (see Result's docs in ../types.ts). Absent `players`,
  // this endpoint behaves exactly as it did before for existing callers.
  const hasRoster = Array.isArray(body.players) && body.players.length > 0;

  if (!body.date || !body.month) {
    return jsonResponse(400, { message: 'date and month are required' });
  }

  if (
    !hasRoster &&
    (body.entrantsCount === undefined || body.buyInAmount === undefined)
  ) {
    return jsonResponse(400, {
      message:
        'entrantsCount and buyInAmount are required when players is not provided',
    });
  }

  if (hasRoster && !body.players.every(isValidRosterPlayer)) {
    return jsonResponse(400, {
      message:
        'each entry in players requires a playerId, a playerName, and a non-negative numeric buyIn',
    });
  }

  if (hasRoster) {
    const uniquePlayerIds = new Set(
      body.players.map((p: RosterPlayerInput) => p.playerId)
    );
    if (uniquePlayerIds.size !== body.players.length) {
      return jsonResponse(400, {
        message: 'players must not contain duplicate playerIds',
      });
    }
  }

  const roster: RosterPlayerInput[] = hasRoster ? body.players : [];
  const entrantsCount = hasRoster ? roster.length : body.entrantsCount;
  const totalPot = hasRoster
    ? roster.reduce((sum, p) => sum + p.buyIn, 0)
    : body.totalPot;

  const gameId = randomUUID();
  const createdBy =
    (event.requestContext as any)?.authorizer?.claims?.email ?? 'unknown';

  const game: Game = {
    gameId,
    year,
    month: body.month,
    date: body.date,
    location: body.location,
    entrantsCount,
    buyInAmount: body.buyInAmount,
    totalPot,
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

  // Write one Result per roster player (buy-in recorded, position left
  // unset until the game is actually scored via upsertResult later).
  //
  // Plain Promise.all of individual PutCommands, not TransactWriteItems:
  // this matches the existing style already used in this file (see
  // deleteGame's Promise.all of DeleteCommands) rather than introducing a
  // second write pattern, avoids TransactWriteItems' 100-item cap (a large
  // buy-in tournament roster could exceed it), and the two prior writes
  // above (game + year marker) are already non-transactional in this
  // handler -- so this isn't giving up atomicity we previously had. If a
  // roster write fails partway through, the game still exists and any
  // missing player's result can be re-added idempotently via the existing
  // PUT /games/{gameId}/results/{playerId} endpoint.
  if (roster.length > 0) {
    await Promise.all(
      roster.map((p) => {
        const result: Result = {
          gameId,
          playerId: p.playerId,
          playerName: p.playerName,
          buyIn: p.buyIn,
          rebuys: 0,
          rebuyCount: 0,
          addOns: 0,
          winnings: 0,
          points: 0, // not yet scored; position is unset
        };
        return ddb.send(
          new PutCommand({
            TableName: TABLE_NAME,
            Item: {
              ...Keys.result(gameId, p.playerId),
              GSI1PK: `PLAYER#${p.playerId}`,
              GSI1SK: `YEAR#${year}#GAME#${gameId}`,
              ...result,
            },
          })
        );
      })
    );
  }

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
    buyInAmount: body.buyInAmount ?? existing.Item.buyInAmount,
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
