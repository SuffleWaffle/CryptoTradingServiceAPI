// import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
// import { BaseEntity } from '@cupo/backend/storage';
//
// @Entity({ name: 'trading_log', schema: 'public' })
// export class TradeLogEntity extends BaseEntity {
//   @PrimaryGeneratedColumn('increment', { type: 'bigint' })
//   id?: number;
//
//   @Column({ type: 'varchar', length: 2048, nullable: true })
//   message?: string | null;
//
//   @Column({ type: 'varchar', length: 34, nullable: true })
//   exchangeId: string;
//
//   @Column({ type: 'varchar', length: 12, nullable: true })
//   symbol: string;
//
//   @Column({ type: 'varchar', length: 8, nullable: true })
//   timeframe: string;
//
//   @Column({ type: 'varchar', length: 34 })
//   type: string;
// }
