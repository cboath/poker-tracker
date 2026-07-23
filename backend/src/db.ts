import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  DeleteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
export const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

export const TABLE_NAME = process.env.TABLE_NAME as string;

// ---- Single-table key helpers ----
// Player profile:   PK=PLAYER#<id>   SK=PROFILE          GSI1PK=PLAYERS        GSI1SK=PLAYER#<id>
// Game metadata:    PK=GAME#<id>     SK=METADATA          GSI1PK=YEAR#<year>    GSI1SK=GAME#<date>#<id>
// Result:           PK=GAME#<id>     SK=RESULT#<playerId> GSI1PK=PLAYER#<id>    GSI1SK=YEAR#<year>#GAME#<gameId>
// Year marker:       PK=YEARS         SK=YEAR#<year>

export const Keys = {
  player: (playerId: string) => ({ PK: `PLAYER#${playerId}`, SK: 'PROFILE' }),
  playersListGsi: () => ({ GSI1PK: 'PLAYERS' }),
  game: (gameId: string) => ({ PK: `GAME#${gameId}`, SK: 'METADATA' }),
  gamesInYearGsi: (year: number) => ({ GSI1PK: `YEAR#${year}` }),
  result: (gameId: string, playerId: string) => ({
    PK: `GAME#${gameId}`,
    SK: `RESULT#${playerId}`,
  }),
  resultsForGame: (gameId: string) => ({ PK: `GAME#${gameId}` }),
  resultsForPlayerGsi: (playerId: string) => ({ GSI1PK: `PLAYER#${playerId}` }),
  years: () => ({ PK: 'YEARS' }),
  yearMarker: (year: number) => ({ PK: 'YEARS', SK: `YEAR#${year}` }),
};

export { GetCommand, PutCommand, QueryCommand, DeleteCommand, UpdateCommand };

export function jsonResponse(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    },
    body: JSON.stringify(body),
  };
}
