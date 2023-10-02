// import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
// import { BaseEntity } from '@cupo/backend/storage';
//
// @Entity({ name: 'trading_signal', schema: 'public' })
// export class TradeSignalEntity extends BaseEntity {
//   @PrimaryGeneratedColumn('uuid')
//   id?: string;
//
//   @Column({ type: 'varchar', length: 34 })
//   exchangeId: string;
//
//   @Column({ type: 'varchar', length: 12 })
//   symbol: string;
//
//   @Column({ type: 'varchar', length: 8 })
//   timeframe: string;
//
//   @UpdateDateColumn({ type: 'timestamptz' })
//   time: Date;
//
//   @Column({ type: 'varchar', length: 34 })
//   type: string;
// }
//
// // SQL:
// // CREATE TABLE "tradeSignal".tradesignal (
// //   id integer NOT NULL GENERATED ALWAYS AS IDENTITY,
// //   isArchived boolean NULL DEFAULT false,
// //   isDeleted boolean NULL DEFAULT false,
// //   created timestamptz NOT NULL,
// //   updated timestamptz NOT NULL,
// //   "comment" varchar NULL,
// //   client int NOT NULL DEFAULT 0,
// //   exchangeid varchar NOT NULL,
// //   symbol varchar NOT NULL,
// //   timeframe varchar NOT NULL,
// //   "time" timestamptz NOT NULL,
// //   "type" varchar NOT NULL,
// //   description varchar NULL
// // );
// //
// // -- Column comments
// //
// // COMMENT ON COLUMN "tradeSignal".tradesignal."time" IS 'Candle time';
// // COMMENT ON COLUMN "tradeSignal".tradesignal."type" IS 'Signal types';
