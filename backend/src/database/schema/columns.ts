import { bigint, int, smallint } from "drizzle-orm/mysql-core";

export function bigId(columnName = "id") {
  return bigint(columnName, { mode: "number", unsigned: true })
    .autoincrement()
    .primaryKey();
}

export function bigReference(columnName: string) {
  return bigint(columnName, { mode: "number", unsigned: true });
}

export function entityId(columnName = "id") {
  return int(columnName, { unsigned: true }).autoincrement().primaryKey();
}

export function entityReference(columnName: string) {
  return int(columnName, { unsigned: true });
}

export function masterId(columnName = "id") {
  return smallint(columnName, { unsigned: true }).autoincrement().primaryKey();
}

export function masterReference(columnName: string) {
  return smallint(columnName, { unsigned: true });
}
